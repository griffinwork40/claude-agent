// lib/claude-agent.ts
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, TextBlockParam, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { browserTools, getBrowserService } from './browser-tools';
import { getOrCreateUserProfile } from './user-profile';
import { ToolUse, ToolResult, BrowserToolResult } from '@/types';

// Debug: Log SDK import
console.log('Anthropic SDK imported successfully');
console.log('Anthropic class:', Anthropic);

// Initialize the Anthropic client
let anthropic: Anthropic | null = null;
let agentInstructions: string | null = null;

export async function initializeAgent(): Promise<{ client: Anthropic; instructions: string }> {
  if (anthropic && agentInstructions) {
    console.log('Using cached Anthropic client and instructions');
    return { client: anthropic, instructions: agentInstructions };
  }

  try {
    console.log('Initializing Anthropic client...');
    
    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    console.log('✓ Anthropic API key found');

    // Initialize Anthropic client
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    console.log('✓ Anthropic client initialized');

    // Read agent instructions from the markdown file
    const instructionsPath = join(process.cwd(), '.claude/agents/job-assistant-agent.md');
    console.log('Reading instructions from:', instructionsPath);
    
    const instructions = readFileSync(instructionsPath, 'utf-8');
    console.log('✓ Agent instructions loaded, length:', instructions.length);

    agentInstructions = instructions;
    console.log('✓ Claude agent initialized successfully');
    return { client: anthropic, instructions: instructions };
  } catch (error: unknown) {
    console.error('Failed to initialize Claude agent:', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', {
      message: errMessage,
      stack: errStack,
      cwd: process.cwd(),
      hasApiKey: !!process.env.ANTHROPIC_API_KEY
    });
    throw new Error(`Failed to initialize Claude agent: ${errMessage}`);
  }
}

interface AgentSession {
  userId: string;
  messages: Array<{ role: string; content: string }>;
}

// Session management for agent conversations
const agentSessions = new Map<string, AgentSession>();

export async function createAgentSession(userId: string): Promise<string> {
  const sessionId = `session_${Date.now()}_${userId}`;
  agentSessions.set(sessionId, { userId, messages: [] });
  return sessionId;
}

export async function getAgentSession(sessionId: string) {
  return agentSessions.get(sessionId);
}

export async function runClaudeAgentStream(
  userMessage: string, 
  userId: string, 
  sessionId?: string
): Promise<{ sessionId: string; stream: ReadableStream }> {
  try {
    console.log('Starting Claude agent stream with tool calling...', {
      userMessage: userMessage.substring(0, 100) + '...',
      userId,
      sessionId,
      hasExistingSession: sessionId ? agentSessions.has(sessionId) : false
    });

    // Initialize agent
    const { client, instructions } = await initializeAgent();
    console.log('✓ Agent initialized for streaming with tools');
    
    // Get or create session
    let session: AgentSession;
    if (sessionId && agentSessions.has(sessionId)) {
      console.log('Using existing session:', sessionId);
      session = agentSessions.get(sessionId)!;
    } else {
      console.log('Creating new session...');
      session = { userId, messages: [] };
      sessionId = `session_${Date.now()}_${userId}`;
      agentSessions.set(sessionId, session);
      console.log('✓ New session created:', sessionId);
    }

    // Add user message to session
    session.messages.push({ role: 'user', content: userMessage });

    // Create messages array for the API call
    const messages = [
      { role: 'user' as const, content: userMessage }
    ];

    console.log('Starting Claude streaming with tools...');
    
    // Create a readable stream from the Anthropic streaming API
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting Anthropic streaming with tool calling...');
          
          // Helper to send activity events
          const sendActivity = (type: string, data: any) => {
            const event = JSON.stringify({ type, ...data });
            const marker = `__ACTIVITY__${event}__END__`;
            controller.enqueue(new TextEncoder().encode(marker));
          };
          
          const stream = await client.messages.create({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 4096,
            system: instructions,
            messages: messages,
            tools: browserTools, // Add tools support
            stream: true
          });

          console.log('✓ Anthropic stream with tools started');
          
          const toolUses: ToolUse[] = [];
          let currentToolUse: ToolUse | null = null;
          let toolInputJson = '';
          
          // IMPORTANT: Capture the full assistant message content
          const assistantMessageContent: Array<TextBlockParam | ToolUseBlockParam> = [];
          
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_start') {
              if (chunk.content_block.type === 'text') {
                // Start of text block
                assistantMessageContent.push({
                  type: 'text' as const,
                  text: ''
                });
              } else if (chunk.content_block.type === 'tool_use') {
                // Start of a tool use
                currentToolUse = {
                  id: chunk.content_block.id,
                  name: chunk.content_block.name,
                  input: {}
                };
                toolInputJson = '';
                console.log(`🔧 Tool use started: ${chunk.content_block.name}`);
                
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
                  const encoded = new TextEncoder().encode(content);
                  controller.enqueue(encoded);
                  
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
            } else if (chunk.type === 'message_stop') {
              console.log('✓ Stream completed, executing tools...');
              
              // Execute tools if any were requested
              if (toolUses.length > 0) {
                console.log(`🔧 Executing ${toolUses.length} tools...`);
                sendActivity('thinking', {
                  content: `Executing ${toolUses.length} tool${toolUses.length > 1 ? 's' : ''}...`
                });
                const toolResults = await executeTools(toolUses, userId, sendActivity);
                
                // Build the proper continuation messages
                // 1. User's original message (already in messages array)
                // 2. Assistant's message with tool_use blocks
                // 3. User message with tool_result blocks
                
                const continuationMessages = [
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
                
                // Continue conversation with tool results
                const continuationStream = await client.messages.create({
                  model: 'claude-3-5-sonnet-latest',
                  max_tokens: 4096,
                  system: instructions,
                  messages: continuationMessages,
                  tools: browserTools,
                  stream: true
                });
                
                // Stream the continuation response
                for await (const chunk of continuationStream) {
                  if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                    const content = chunk.delta.text;
                    if (content) {
                      const encoded = new TextEncoder().encode(content);
                      controller.enqueue(encoded);
                    }
                  } else if (chunk.type === 'message_stop') {
                    break;
                  }
                }
              }
              
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
    });
    
    return {
      sessionId,
      stream
    };
  } catch (error: unknown) {
    console.error('Error running Claude agent stream:', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', {
      message: errMessage,
      stack: errStack,
      userMessage: userMessage.substring(0, 100),
      userId,
      sessionId
    });
    throw new Error(`Failed to run Claude agent: ${errMessage}`);
  }
}

// Execute browser tools
async function executeTools(
  toolUses: ToolUse[], 
  userId: string, 
  sendActivity?: (type: string, data: any) => void
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  const browserService = getBrowserService();
    
    for (const toolUse of toolUses) {
      console.log(`🔧 Executing tool: ${toolUse.name}`, toolUse.input);
      
      // Send activity event for tool execution start
      if (sendActivity) {
        sendActivity('tool_executing', {
          tool: toolUse.name,
          toolId: toolUse.id,
          params: toolUse.input
        });
      }
      
      try {
        let result: BrowserToolResult;
        const input = toolUse.input as Record<string, any>;
        
        switch (toolUse.name) {
          case 'browser_navigate':
            const navResult = await browserService.navigate(input.sessionId, input.url);
            result = {
              success: true,
              data: navResult,
              message: `Navigated to ${navResult.url}`
            };
            break;
            
          case 'browser_snapshot':
            const snapshotResult = await browserService.snapshot(input.sessionId);
            result = {
              success: true,
              data: snapshotResult,
              message: 'Page snapshot captured'
            };
            break;
            
          case 'browser_screenshot':
            const screenshotResult = await browserService.screenshot(input.sessionId, input.fullPage);
            result = {
              success: true,
              data: { screenshot: screenshotResult.screenshot.slice(0, 100) + '... (truncated)' },
              message: 'Screenshot captured'
            };
            break;
            
          case 'browser_click':
            const clickResult = await browserService.click(input.sessionId, input.selector);
            result = {
              success: true,
              data: clickResult,
              message: clickResult.message
            };
            break;
            
          case 'browser_type':
            const typeResult = await browserService.type(input.sessionId, input.selector, input.text, input.submit);
            result = {
              success: true,
              data: typeResult,
              message: typeResult.message
            };
            break;
            
          case 'browser_select':
            const selectResult = await browserService.select(input.sessionId, input.selector, input.value);
            result = {
              success: true,
              data: selectResult,
              message: selectResult.message
            };
            break;
            
          case 'browser_wait':
            const waitResult = await browserService.waitFor(input.sessionId, input.selector, input.timeout);
            result = {
              success: true,
              data: waitResult,
              message: waitResult.message
            };
            break;
            
          case 'browser_evaluate':
            const evalResult = await browserService.evaluate(input.sessionId, input.script);
            result = {
              success: true,
              data: evalResult,
              message: 'JavaScript executed successfully'
            };
            break;
            
          case 'browser_get_content':
            const contentResult = await browserService.getContent(input.sessionId);
            result = {
              success: true,
              data: {
                url: contentResult.url,
                textLength: contentResult.text.length,
                htmlLength: contentResult.html.length,
                textPreview: contentResult.text.slice(0, 500)
              },
              message: 'Page content retrieved'
            };
            break;
            
          case 'browser_close_session':
            const closeResult = await browserService.closeSession(input.sessionId);
            result = {
              success: true,
              data: closeResult,
              message: closeResult.message
            };
            break;
            
          default:
            result = {
              success: false,
              error: `Unknown tool: ${toolUse.name}`
            };
        }
        
        results.push({
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
          is_error: !result.success
        });
        
        console.log(`✓ Tool ${toolUse.name} executed:`, result.success ? 'SUCCESS' : 'FAILED');
        
        // Send activity event for tool execution complete
        if (sendActivity) {
          sendActivity('tool_result', {
            tool: toolUse.name,
            toolId: toolUse.id,
            success: result.success,
            result: result,
            message: result.message
          });
        }
        
      } catch (error: unknown) {
        console.error(`❌ Error executing tool ${toolUse.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        const errorResult = {
          success: false,
          error: `Tool execution failed: ${errorMessage}`,
          details: process.env.NODE_ENV === 'development' ? errorStack : undefined
        };
        
        results.push({
          tool_use_id: toolUse.id,
          content: JSON.stringify(errorResult),
          is_error: true
        });
        
        // Send activity event for tool error
        if (sendActivity) {
          sendActivity('tool_result', {
            tool: toolUse.name,
            toolId: toolUse.id,
            success: false,
            error: errorMessage,
            message: `Failed: ${errorMessage}`
          });
        }
      }
    }
  
  return results;
}

// Legacy function for backward compatibility (non-streaming)
export async function runClaudeAgent(userMessage: string) {
  try {
    const { client, instructions } = await initializeAgent();
    
    const result = await client.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1000,
      system: instructions,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });
    
    interface ContentBlock {
      type: string;
      text?: string;
    }
    
    // Extract plain text from content blocks
    const text = result.content
      .map((block: ContentBlock) => (block.type === 'text' ? block.text : ''))
      .join('');
    
    return {
      content: text,
      jobOpportunity: null // Will be extracted from content if present
    };
  } catch (error) {
    console.error('Error running Claude agent:', error);
    return {
      content: "I'm sorry, I encountered an error processing your request. Please try again.",
      jobOpportunity: null
    };
  }
}