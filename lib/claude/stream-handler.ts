/**
 * Stream Handler Module
 * 
 * Handles Claude streaming with tool calling for the agent.
 * Extracted from claude-agent.ts for better modularity and maintainability.
 */

import type { MessageParam, TextBlockParam, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import type Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ToolUse, ToolResult } from '@/types';
import { executeTools } from './tool-executor';
import { buildJobSummaryFromResults } from './utils';
import { getUserContextForPrompt } from '../user-data-compiler';

// Helper to get Supabase admin client
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not set');
  }

  supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  return supabaseAdmin;
}

interface AgentSession {
  userId: string;
  messages: Array<{ role: string; content: string }>;
}

/**
 * Handle Claude streaming with tool calling
 */
export async function handleClaudeStream(
  client: Anthropic,
  messages: MessageParam[],
  instructions: string,
  agentTools: any[],
  userId: string,
  sessionId: string,
  session: AgentSession,
  controller: ReadableStreamDefaultController
): Promise<void> {
  // Get Supabase admin client for saving message chunks
  const supabase = getSupabaseAdmin();
  
  try {
    console.log('Starting Anthropic streaming with tool calling...');
    
    // Helper to send activity events
    const sendActivity = (type: string, data: any) => {
      const event = JSON.stringify({ type, ...data });
      const marker = `__ACTIVITY__${event}__END__`;
      controller.enqueue(new TextEncoder().encode(marker));
    };
    
    // Get user context and inject into system prompt
    const userContext = await getUserContextForPrompt(userId);
    const systemPromptWithContext = `${instructions}\n\n${userContext}`;
    
    const stream = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPromptWithContext,
      messages: messages,
      tools: agentTools,
      stream: true
    });

    console.log('✓ Anthropic stream with tools started');
        
        const toolUses: ToolUse[] = [];
        let currentToolUse: ToolUse | null = null;
        let toolInputJson = '';
        
        // IMPORTANT: Capture the full assistant message content
        const assistantMessageContent: Array<TextBlockParam | ToolUseBlockParam> = [];
        
        // Track text chunks separately - save to DB when tool usage interrupts
        let currentTextChunk = '';
        
        // Track token usage for the initial stream
        let initialStopReason: string | null = null;
        let initialInputTokens = 0;
        let initialOutputTokens = 0;
        
        // Token limits for Claude Haiku 4.5 (200K context window - stop at 95%)
        const CONTEXT_LIMIT = 200000;
        const CONTEXT_THRESHOLD = 0.95;
        const MAX_TOKENS = Math.floor(CONTEXT_LIMIT * CONTEXT_THRESHOLD);
        
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_start') {
            if (chunk.content_block.type === 'text') {
              // Start of text block
              assistantMessageContent.push({
                type: 'text' as const,
                text: ''
              });
            } else if (chunk.content_block.type === 'tool_use') {
              // Don't save text chunk yet - accumulate all text until final completion
              // currentTextChunk persists across tool boundaries for single final save

              // Start of a tool use
              currentToolUse = {
                id: chunk.content_block.id,
                name: chunk.content_block.name,
                input: {}
              };
              toolInputJson = '';
              console.log(`🔧 Tool use started: ${chunk.content_block.name}`);

              // Send thought preview before tool start (Phase 2)
              sendActivity('thinking_preview', {
                content: `Planning to use ${chunk.content_block.name.replace(/_/g, ' ')}...`,
                tool: chunk.content_block.name,
                toolId: chunk.content_block.id
              });

              // Small delay to let the thought preview be visible
              await new Promise(resolve => setTimeout(resolve, 200));

              // Send activity event for tool start
              sendActivity('tool_start', {
                tool: chunk.content_block.name,
                toolId: chunk.content_block.id
              });
            }
          } else if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') {
              // Regular text content
              const content = chunk.delta.text;
              if (content) {
                console.log(`✓ Streaming chunk: ${content.length} chars`);
                
                // Send ONLY as raw text bytes - no activity event to avoid duplication
                const encoded = new TextEncoder().encode(content);
                controller.enqueue(encoded);
                
                // Accumulate in current text chunk
                currentTextChunk += content;
                
                // Add to the last text block in assistant message
                const lastBlock = assistantMessageContent[assistantMessageContent.length - 1];
                if (lastBlock && lastBlock.type === 'text') {
                  lastBlock.text += content;
                }
              }
            } else if (chunk.delta.type === 'input_json_delta') {
              // Collect tool input JSON
              toolInputJson += chunk.delta.partial_json;
            }
          } else if (chunk.type === 'content_block_stop' && currentToolUse) {
            // End of tool use, parse input and save
            try {
              currentToolUse.input = JSON.parse(toolInputJson);
              toolUses.push(currentToolUse);
              
              // Add to assistant message content
              assistantMessageContent.push({
                type: 'tool_use' as const,
                id: currentToolUse.id,
                name: currentToolUse.name,
                input: currentToolUse.input
              });
              
              console.log(`🔧 Tool use completed: ${currentToolUse.name}`, currentToolUse.input);
              
              // Send activity event with tool parameters
              sendActivity('tool_params', {
                tool: currentToolUse.name,
                toolId: currentToolUse.id,
                params: currentToolUse.input
              });
            } catch (error) {
              console.error('Error parsing tool input JSON:', error);
            }
            currentToolUse = null;
            toolInputJson = '';
          } else if (chunk.type === 'message_delta') {
            // Capture usage and stop_reason from message_delta
            if (chunk.delta.stop_reason) {
              initialStopReason = chunk.delta.stop_reason;
              console.log(`📊 Initial stop reason: ${initialStopReason}`);
            }
            if (chunk.usage) {
              initialOutputTokens = chunk.usage.output_tokens || 0;
              console.log(`📊 Initial usage: output_tokens=${initialOutputTokens}`);
            }
          } else if (chunk.type === 'message_start') {
            // Capture input tokens from message_start
            if (chunk.message?.usage) {
              initialInputTokens = chunk.message.usage.input_tokens || 0;
              console.log(`📊 Initial usage: input_tokens=${initialInputTokens}`);
            }
          } else if (chunk.type === 'message_stop') {
            console.log('✓ Stream completed, executing tools...');
            
            // Initialize cumulative token tracking with initial stream usage
            let cumulativeInputTokens = initialInputTokens;
            let cumulativeOutputTokens = initialOutputTokens;
            const initialTotalTokens = cumulativeInputTokens + cumulativeOutputTokens;
            const initialContextPercentage = (initialTotalTokens / CONTEXT_LIMIT) * 100;
            
            console.log(`📊 Initial tokens: ${initialTotalTokens} (${initialContextPercentage.toFixed(1)}% of ${CONTEXT_LIMIT})`);
            
            // Send initial context usage event
            sendActivity('context_usage', {
              content: `Context: ${initialContextPercentage.toFixed(1)}% (${initialTotalTokens.toLocaleString()}/${CONTEXT_LIMIT.toLocaleString()} tokens)`,
              inputTokens: cumulativeInputTokens,
              outputTokens: cumulativeOutputTokens,
              totalTokens: initialTotalTokens,
              contextPercentage: initialContextPercentage,
              iteration: 0
            });
            
            const textBeforeTools = currentTextChunk;
            const aggregatedToolResults: ToolResult[] = [];

            // Execute tools if any were requested - use iterative approach instead of recursion
            if (toolUses.length > 0) {
              console.log(`🔧 Executing ${toolUses.length} tools...`);
              sendActivity('thinking', {
                content: `Executing ${toolUses.length} tool${toolUses.length > 1 ? 's' : ''}...`
              });
              const toolResults = await executeTools(toolUses, userId, sendActivity);
              aggregatedToolResults.push(...toolResults);
              
              // Build conversation history with tool use and results
              let continuationMessages: MessageParam[] = [
                ...messages,  // Original user message
                {
                  role: 'assistant' as const,
                  content: assistantMessageContent  // Text + tool_use blocks
                },
                {
                  role: 'user' as const,
                  content: toolResults.map(result => ({
                    type: 'tool_result' as const,
                    tool_use_id: result.tool_use_id,
                    content: result.content,
                    is_error: result.is_error
                  }))
                }
              ];
              
              // Iteratively continue conversation until natural completion or context limit
              let iteration = 0;
              let shouldContinue = true;
              
              while (shouldContinue) {
                iteration++;
                console.log(`🔄 Starting continuation iteration ${iteration}...`);
                
                const continuationStream = await client.messages.create({
                  model: 'claude-haiku-4-5-20251001',
                  max_tokens: 4096,
                  system: systemPromptWithContext,
                  messages: continuationMessages,
                  tools: agentTools,
                  stream: true
                });
                
                // Track tool uses and text in this continuation
                const continuationToolUses: ToolUse[] = [];
                let continuationCurrentToolUse: ToolUse | null = null;
                let continuationToolInputJson = '';
                const continuationAssistantContent: Array<TextBlockParam | ToolUseBlockParam> = [];
                let hasText = false;
                let stopReason: string | null = null;
                let iterationInputTokens = 0;
                let iterationOutputTokens = 0;
              
                // Stream the continuation response
                for await (const chunk of continuationStream) {
                  if (chunk.type === 'content_block_start') {
                    if (chunk.content_block.type === 'text') {
                      continuationAssistantContent.push({
                        type: 'text' as const,
                        text: ''
                      });
                      console.log(`📝 Continuation ${iteration}: text block started`);
                    } else if (chunk.content_block.type === 'tool_use') {
                      // Don't save text chunk yet - accumulate all text until final completion
                      // currentTextChunk persists across tool boundaries for single final save

                      continuationCurrentToolUse = {
                        id: chunk.content_block.id,
                        name: chunk.content_block.name,
                        input: {}
                      };
                      continuationToolInputJson = '';
                      console.log(`🔧 Continuation ${iteration} tool use started: ${chunk.content_block.name}`);

                      // Send thought preview before tool start (Phase 2)
                      sendActivity('thinking_preview', {
                        content: `Planning to use ${chunk.content_block.name.replace(/_/g, ' ')}...`,
                        tool: chunk.content_block.name,
                        toolId: chunk.content_block.id
                      });

                      // Small delay to let the thought preview be visible
                      await new Promise(resolve => setTimeout(resolve, 200));

                      sendActivity('tool_start', {
                        tool: chunk.content_block.name,
                        toolId: chunk.content_block.id
                      });
                    }
                  } else if (chunk.type === 'content_block_delta') {
                    if (chunk.delta.type === 'text_delta') {
                      const content = chunk.delta.text;
                      if (content) {
                        hasText = true;
                        const encoded = new TextEncoder().encode(content);
                        controller.enqueue(encoded);
                        
                        // Accumulate continuation text in current chunk
                        currentTextChunk += content;
                            
                        // Add to last text block
                        const lastBlock = continuationAssistantContent[continuationAssistantContent.length - 1];
                        if (lastBlock && lastBlock.type === 'text') {
                          lastBlock.text += content;
                        }
                      }
                    } else if (chunk.delta.type === 'input_json_delta') {
                      continuationToolInputJson += chunk.delta.partial_json;
                    }
                  } else if (chunk.type === 'content_block_stop' && continuationCurrentToolUse) {
                    try {
                      continuationCurrentToolUse.input = JSON.parse(continuationToolInputJson);
                      continuationToolUses.push(continuationCurrentToolUse);
                      
                      continuationAssistantContent.push({
                        type: 'tool_use' as const,
                        id: continuationCurrentToolUse.id,
                        name: continuationCurrentToolUse.name,
                        input: continuationCurrentToolUse.input
                      });
                      
                      console.log(`🔧 Continuation ${iteration} tool use completed: ${continuationCurrentToolUse.name}`, continuationCurrentToolUse.input);
                      
                      sendActivity('tool_params', {
                        tool: continuationCurrentToolUse.name,
                        toolId: continuationCurrentToolUse.id,
                        params: continuationCurrentToolUse.input
                      });
                    } catch (error) {
                      console.error('Error parsing continuation tool input JSON:', error);
                    }
                    continuationCurrentToolUse = null;
                    continuationToolInputJson = '';
                  } else if (chunk.type === 'message_delta') {
                    // Capture usage and stop_reason from message_delta
                    if (chunk.delta.stop_reason) {
                      stopReason = chunk.delta.stop_reason;
                      console.log(`📊 Stop reason: ${stopReason}`);
                    }
                    if (chunk.usage) {
                      iterationOutputTokens = chunk.usage.output_tokens || 0;
                      console.log(`📊 Usage: output_tokens=${iterationOutputTokens}`);
                    }
                  } else if (chunk.type === 'message_start') {
                    // Capture input tokens from message_start
                    if (chunk.message?.usage) {
                      iterationInputTokens = chunk.message.usage.input_tokens || 0;
                      console.log(`📊 Usage: input_tokens=${iterationInputTokens}`);
                    }
                  } else if (chunk.type === 'message_stop') {
                    console.log(`✓ Continuation ${iteration} completed. Text: ${hasText}, Tools: ${continuationToolUses.length}`);
                    
                    // Update cumulative token counts
                    cumulativeInputTokens += iterationInputTokens;
                    cumulativeOutputTokens += iterationOutputTokens;
                    const totalTokens = cumulativeInputTokens + cumulativeOutputTokens;
                    const contextPercentage = (totalTokens / CONTEXT_LIMIT) * 100;
                    
                    console.log(`📊 Cumulative tokens: ${totalTokens} (${contextPercentage.toFixed(1)}% of ${CONTEXT_LIMIT})`);
                    console.log(`   Input: ${cumulativeInputTokens}, Output: ${cumulativeOutputTokens}`);
                    
                    // Send context usage event
                    sendActivity('context_usage', {
                      content: `Context: ${contextPercentage.toFixed(1)}% (${totalTokens.toLocaleString()}/${CONTEXT_LIMIT.toLocaleString()} tokens)`,
                      inputTokens: cumulativeInputTokens,
                      outputTokens: cumulativeOutputTokens,
                      totalTokens: totalTokens,
                      contextPercentage: contextPercentage,
                      iteration: iteration
                    });
                    
                    // Check termination conditions
                    if (totalTokens >= MAX_TOKENS) {
                      console.log(`⚠️ Context limit reached (${totalTokens}/${MAX_TOKENS}), stopping`);
                      sendActivity('thinking', {
                        content: `Reached context limit (${contextPercentage.toFixed(0)}% used). Completing response...`
                      });
                      shouldContinue = false;
                      break;
                    }
                    
                    if (stopReason === 'end_turn') {
                      console.log(`✓ Natural completion (end_turn), stopping`);
                      shouldContinue = false;
                      break;
                    }
                    
                    if (stopReason === 'max_tokens') {
                      console.log(`⚠️ Hit max_tokens in response, stopping`);
                      shouldContinue = false;
                      break;
                    }
                    
                    // Check if we should continue looping
                    if (continuationToolUses.length > 0) {
                      // Execute the tools from this continuation
                      console.log(`🔧 Executing ${continuationToolUses.length} tools from continuation ${iteration}...`);
                      sendActivity('thinking', {
                        content: `Executing ${continuationToolUses.length} more tool${continuationToolUses.length > 1 ? 's' : ''}...`
                      });
                      const continuationToolResults = await executeTools(continuationToolUses, userId, sendActivity);
                      aggregatedToolResults.push(...continuationToolResults);
                      
                      // Update continuation messages for next iteration
                      continuationMessages = [
                        ...continuationMessages,
                        {
                          role: 'assistant' as const,
                          content: continuationAssistantContent
                        },
                        {
                          role: 'user' as const,
                          content: continuationToolResults.map(result => ({
                            type: 'tool_result' as const,
                            tool_use_id: result.tool_use_id,
                            content: result.content,
                            is_error: result.is_error
                          }))
                        }
                      ];
                      
                      // Continue loop for next iteration
                      console.log(`✓ Tools executed, will continue to iteration ${iteration + 1}`);
                    } else {
                      // No more tools - we're done
                      console.log(`✓ No more tools to execute, ending continuation loop`);
                      shouldContinue = false;
                    }
                    
                    break;
                  }
                }
              } // End of while loop
              
              console.log(`✓ Tool execution loop completed after ${iteration} iterations`);
            }

            const postToolText = currentTextChunk.slice(textBeforeTools.length).trim();
            if (aggregatedToolResults.length > 0 && postToolText.length === 0) {
              const fallbackSummary = buildJobSummaryFromResults(aggregatedToolResults);
              if (fallbackSummary) {
                console.log('ℹ️ No assistant summary generated, injecting fallback overview');
                const prefix = currentTextChunk.trim().length ? '\n\n' : '';
                const fallbackText = `${prefix}${fallbackSummary}`;
                const encodedFallback = new TextEncoder().encode(fallbackText);
                controller.enqueue(encodedFallback);
                currentTextChunk += fallbackText;

                const lastBlock = assistantMessageContent[assistantMessageContent.length - 1];
                if (lastBlock && lastBlock.type === 'text') {
                  lastBlock.text += fallbackText;
                } else {
                  assistantMessageContent.push({
                    type: 'text' as const,
                    text: fallbackSummary
                  });
                }
              }
            }
            
            // Save the complete accumulated assistant response as a single message
            if (currentTextChunk.trim()) {
              console.log(`💾 Saving complete assistant response (${currentTextChunk.length} chars)...`);
              try {
                const { data: assistantMessage, error } = await supabase
                  .from('messages')
                  .insert([
                    {
                      content: currentTextChunk,
                      sender: 'bot',
                      user_id: userId,
                      session_id: sessionId,
                      created_at: new Date().toISOString(),
                    },
                  ])
                  .select()
                  .single();

                if (error) {
                  console.error(`❌ Error saving complete assistant message:`, error);
                } else {
                  console.log(`✓ Complete assistant message saved:`, assistantMessage?.id);
                  session.messages.push({ role: 'assistant', content: currentTextChunk });
                }
              } catch (saveError) {
                console.error(`❌ Failed to save complete assistant message:`, saveError);
              }
            }
            currentTextChunk = '';
            
            controller.close();
            break;
          }
        }
        
    console.log('✓ Stream processing completed');
  } catch (error: unknown) {
    console.error('❌ Error in Anthropic streaming:', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    const errName = error instanceof Error ? error.name : undefined;
    console.error('Error details:', {
      message: errMessage,
      stack: errStack,
      name: errName
    });
    controller.error(error);
  }
}