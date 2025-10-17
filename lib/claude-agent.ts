// lib/claude-agent.ts
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, TextBlockParam, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browserTools, getBrowserService } from './browser-tools';
import { listGmailThreads, sendGmailMessage, markGmailThreadRead } from '@/lib/gmail/client';
import { getOrCreateUserProfile } from './user-profile';
import { ToolUse, ToolResult, BrowserToolResult } from '@/types';
import { getUserContextForPrompt } from './user-data-compiler';

// Debug: Log SDK import
console.log('Anthropic SDK imported successfully');
console.log('Anthropic class:', Anthropic);

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

// Initialize the Anthropic client
let anthropic: Anthropic | null = null;
let agentInstructions: string | null = null;

const gmailToolDefinitions = [
  {
    name: 'gmail_list_threads',
    description: 'List recent Gmail threads for the authenticated user with optional query filters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Optional Gmail search query (e.g., "from:recruiter@example.com is:unread")'
        },
        labelIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional Gmail label IDs to filter by.'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of threads to return (1-50).'
        }
      }
    }
  },
  {
    name: 'gmail_send_email',
    description: 'Send a plain text email using the connected Gmail account.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string', description: 'Recipient email address(es). Separate multiple with commas.' },
        subject: { type: 'string', description: 'Email subject line.' },
        body: { type: 'string', description: 'Email body as plain text.' },
        cc: { type: 'string', description: 'Optional CC recipients (comma separated).' },
        bcc: { type: 'string', description: 'Optional BCC recipients (comma separated).' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'gmail_mark_thread_read',
    description: 'Remove the UNREAD label from a Gmail thread.',
    input_schema: {
      type: 'object' as const,
      properties: {
        threadId: { type: 'string', description: 'The Gmail thread ID to mark as read.' }
      },
      required: ['threadId']
    }
  }
];

const agentTools = [...browserTools, ...gmailToolDefinitions];

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

async function saveAssistantTextChunk({
  supabase,
  content,
  userId,
  agentId,
  session,
  context,
}: {
  supabase: SupabaseClient;
  content: string;
  userId: string;
  agentId?: string | null;
  session: AgentSession;
  context: string;
}): Promise<void> {
  if (!content.trim()) {
    return;
  }

  try {
    const { data: textMessage, error } = await supabase
      .from('messages')
      .insert([
        {
          content,
          sender: 'bot',
          user_id: userId,
          session_id: agentId || 'default-agent',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(`❌ Error saving ${context} text chunk:`, error);
      return;
    }

    console.log(`✓ ${context} text chunk saved:`, textMessage?.id);
    session.messages.push({ role: 'assistant', content });
  } catch (saveError) {
    console.error(`❌ Failed to save ${context} text chunk:`, saveError);
  }
}

interface GmailListThreadsToolInput {
  query?: string;
  labelIds?: string[];
  maxResults?: number;
}

interface GmailSendEmailToolInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

interface GmailMarkThreadReadToolInput {
  threadId: string;
}

function sanitizeString(value: string, maxLength: number, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} cannot be empty`);
  }
  return trimmed.slice(0, maxLength);
}

function rejectHeaderInjection(value: string, field: string): void {
  if (value.includes('\r') || value.includes('\n')) {
    throw new Error(`${field} cannot contain newline characters`);
  }
}

function validateListThreadsInput(raw: Record<string, unknown>): GmailListThreadsToolInput {
  const input: GmailListThreadsToolInput = {};

  if (raw.query !== undefined) {
    if (typeof raw.query !== 'string') {
      throw new Error('gmail_list_threads.query must be a string');
    }
    input.query = raw.query.trim().slice(0, 1024);
  }

  if (raw.labelIds !== undefined) {
    if (!Array.isArray(raw.labelIds) || raw.labelIds.some(label => typeof label !== 'string')) {
      throw new Error('gmail_list_threads.labelIds must be an array of strings');
    }
    input.labelIds = (raw.labelIds as string[]).slice(0, 10).map(label => label.trim()).filter(Boolean);
  }

  if (raw.maxResults !== undefined) {
    const parsed = Number(raw.maxResults);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      throw new Error('gmail_list_threads.maxResults must be an integer between 1 and 50');
    }
    input.maxResults = parsed;
  }

  return input;
}

function validateSendEmailInput(raw: Record<string, unknown>): GmailSendEmailToolInput {
  const to = sanitizeString(String(raw.to ?? ''), 512, 'gmail_send_email.to');
  rejectHeaderInjection(to, 'gmail_send_email.to');
  if (!to.includes('@')) {
    throw new Error('gmail_send_email.to must contain at least one email address');
  }

  const subject = sanitizeString(String(raw.subject ?? ''), 256, 'gmail_send_email.subject');
  rejectHeaderInjection(subject, 'gmail_send_email.subject');
  const bodyValue = sanitizeString(String(raw.body ?? ''), 5000, 'gmail_send_email.body');

  const cc = raw.cc ? sanitizeString(String(raw.cc), 512, 'gmail_send_email.cc') : undefined;
  if (cc) {
    rejectHeaderInjection(cc, 'gmail_send_email.cc');
  }
  const bcc = raw.bcc ? sanitizeString(String(raw.bcc), 512, 'gmail_send_email.bcc') : undefined;
  if (bcc) {
    rejectHeaderInjection(bcc, 'gmail_send_email.bcc');
  }

  return {
    to,
    subject,
    body: bodyValue,
    cc,
    bcc
  };
}

function validateMarkThreadReadInput(raw: Record<string, unknown>): GmailMarkThreadReadToolInput {
  const threadId = sanitizeString(String(raw.threadId ?? ''), 256, 'gmail_mark_thread_read.threadId');
  return { threadId };
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
  sessionId?: string,
  agentId?: string
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

    // Create messages array for the API call using full conversation history
    const messages = session.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    console.log('Starting Claude streaming with tools...');
    
    // Get Supabase admin client for saving message chunks
    const supabase = getSupabaseAdmin();
    
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
          
          // Get user context and inject into system prompt
          const userContext = await getUserContextForPrompt(userId);
          const systemPromptWithContext = `${instructions}\n\n${userContext}`;
          
          const stream = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            system: systemPromptWithContext,
            messages: messages,
            tools: agentTools, // Add tools support
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
          
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_start') {
              if (chunk.content_block.type === 'text') {
                // Start of text block
                assistantMessageContent.push({
                  type: 'text' as const,
                  text: ''
                });
              } else if (chunk.content_block.type === 'tool_use') {
                // Before starting tool use, save any accumulated text as a message
                await saveAssistantTextChunk({
                  supabase,
                  content: currentTextChunk,
                  userId,
                  agentId,
                  session,
                  context: 'pre-tool',
                });
                currentTextChunk = ''; // Reset for next chunk

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
            } else if (chunk.type === 'message_stop') {
              console.log('✓ Stream completed, executing tools...');
              
              // Execute tools if any were requested - use iterative approach instead of recursion
              if (toolUses.length > 0) {
                console.log(`🔧 Executing ${toolUses.length} tools...`);
                sendActivity('thinking', {
                  content: `Executing ${toolUses.length} tool${toolUses.length > 1 ? 's' : ''}...`
                });
                const toolResults = await executeTools(toolUses, userId, sendActivity);
                
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
                
                // Iteratively continue conversation until Claude stops using tools or we hit max iterations
                const MAX_TOOL_ITERATIONS = 10;
                let iteration = 0;
                let shouldContinue = true;
                
                while (shouldContinue && iteration < MAX_TOOL_ITERATIONS) {
                  iteration++;
                  console.log(`🔄 Starting continuation iteration ${iteration}/${MAX_TOOL_ITERATIONS}...`);
                  
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
                        // Before starting tool use in continuation, save any accumulated text
                        await saveAssistantTextChunk({
                          supabase,
                          content: currentTextChunk,
                          userId,
                          agentId,
                          session,
                          context: `continuation ${iteration}`,
                        });
                        currentTextChunk = ''; // Reset for next chunk

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
                    } else if (chunk.type === 'message_stop') {
                      console.log(`✓ Continuation ${iteration} completed. Text: ${hasText}, Tools: ${continuationToolUses.length}`);
                      
                      // Check if we should continue looping
                      if (continuationToolUses.length > 0) {
                        // Execute the tools from this continuation
                        console.log(`🔧 Executing ${continuationToolUses.length} tools from continuation ${iteration}...`);
                        sendActivity('thinking', {
                          content: `Executing ${continuationToolUses.length} more tool${continuationToolUses.length > 1 ? 's' : ''}...`
                        });
                        const continuationToolResults = await executeTools(continuationToolUses, userId, sendActivity);
                        
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
              
              // Save any remaining text that hasn't been saved yet
              await saveAssistantTextChunk({
                supabase,
                content: currentTextChunk,
                userId,
                agentId,
                session,
                context: 'final',
              });
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

  // Generate batch ID for multiple tools (Phase 2)
  const batchId = toolUses.length > 1 ? `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}` : undefined;

  // Send batch start event if multiple tools
  if (batchId && sendActivity) {
    sendActivity('batch_start', {
      batchId,
      batchTotal: toolUses.length,
      tools: toolUses.map(t => t.name),
      content: `Starting batch execution of ${toolUses.length} tools...`
    });
  }

  let completedCount = 0;

  const buildBatchContext = (completed: number) => (
    batchId ? {
      batchId,
      batchTotal: toolUses.length,
      batchCompleted: completed
    } : {}
  );

  for (const toolUse of toolUses) {
    // Add batch context to tool activities
    const executingBatchContext = buildBatchContext(completedCount);

    console.log(`🔧 Executing tool: ${toolUse.name}`, toolUse.input);

    // Send activity event for tool execution start
    if (sendActivity) {
      sendActivity('tool_executing', {
        tool: toolUse.name,
        toolId: toolUse.id,
        params: toolUse.input,
        ...executingBatchContext
      });
    }

    completedCount++;
    const resultBatchContext = buildBatchContext(completedCount);

    try {
        let result: BrowserToolResult;
        const input = toolUse.input as Record<string, any>;
        
        switch (toolUse.name) {
          case 'gmail_list_threads': {
            const listInput = validateListThreadsInput(input);
            const threads = await listGmailThreads(userId, listInput);
            result = {
              success: true,
              data: {
                count: threads.length,
                threads: threads.map(thread => ({
                  id: thread.id,
                  historyId: thread.historyId,
                  snippet: thread.snippet
                }))
              },
              message: `Retrieved ${threads.length} Gmail thread${threads.length === 1 ? '' : 's'}`
            };
            break;
          }
          case 'gmail_send_email': {
            const emailInput = validateSendEmailInput(input);
            const sendResult = await sendGmailMessage(userId, emailInput);
            result = {
              success: true,
              data: { id: sendResult.id },
              message: 'Email sent with Gmail'
            };
            break;
          }
          case 'gmail_mark_thread_read': {
            const markInput = validateMarkThreadReadInput(input);
            await markGmailThreadRead(userId, markInput.threadId);
            result = {
              success: true,
              data: { threadId: markInput.threadId },
              message: 'Thread marked as read'
            };
            break;
          }
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
            
          case 'search_jobs_indeed':
            console.log('🔍 Executing search_jobs_indeed:', input);
            try {
              const indeedJobsResult = await browserService.searchJobsIndeed({
                keywords: input.keywords,
                location: input.location,
                experience_level: input.experience_level,
                remote: input.remote
              });
              console.log(`✓ Indeed search completed: ${indeedJobsResult.length} jobs found`);
              result = {
                success: true,
                data: indeedJobsResult,
                message: `Found ${indeedJobsResult.length} jobs on Indeed`
              };
            } catch (error: unknown) {
              const errMessage = error instanceof Error ? error.message : String(error);
              console.error('❌ Indeed search tool failed:', errMessage);
              result = {
                success: false,
                error: `Indeed search failed: ${errMessage}`,
                message: `Failed to search Indeed: ${errMessage}`
              };
            }
            break;
            
          case 'search_jobs_google':
            console.log('🔍 Executing search_jobs_google:', input);
            try {
              const googleJobsResult = await browserService.searchJobsGoogle({
                keywords: input.keywords,
                location: input.location,
                experience_level: input.experience_level,
                remote: input.remote
              });
              console.log(`✓ Google Jobs search completed: ${googleJobsResult.length} jobs found`);
              result = {
                success: true,
                data: googleJobsResult,
                message: `Found ${googleJobsResult.length} jobs on Google Jobs`
              };
            } catch (error: unknown) {
              const errMessage = error instanceof Error ? error.message : String(error);
              console.error('❌ Google Jobs search tool failed:', errMessage);
              result = {
                success: false,
                error: `Google Jobs search failed: ${errMessage}`,
                message: `Failed to search Google Jobs: ${errMessage}`
              };
            }
            break;
            
          case 'search_jobs_linkedin':
            console.log('🔍 Executing search_jobs_linkedin:', input);
            try {
              const linkedinJobsResult = await browserService.searchJobsLinkedIn({
                keywords: input.keywords,
                location: input.location,
                experience_level: input.experience_level,
                remote: input.remote,
                userId: input.userId || userId
              });
              console.log(`✓ LinkedIn search completed: ${linkedinJobsResult.length} jobs found`);
              result = {
                success: true,
                data: linkedinJobsResult,
                message: `Found ${linkedinJobsResult.length} jobs on LinkedIn`
              };
            } catch (error: unknown) {
              const errMessage = error instanceof Error ? error.message : String(error);
              console.error('❌ LinkedIn search tool failed:', errMessage);
              result = {
                success: false,
                error: `LinkedIn search failed: ${errMessage}`,
                message: `Failed to search LinkedIn: ${errMessage}`
              };
            }
            break;
            
          case 'research_company':
            console.log('🔍 Executing research_company:', input);
            try {
              const companyResult = await browserService.researchCompany(input.company_name);
              console.log(`✓ Company research completed for ${input.company_name}`);
              result = {
                success: true,
                data: companyResult,
                message: `Company research completed for ${input.company_name}`
              };
            } catch (error: unknown) {
              const errMessage = error instanceof Error ? error.message : String(error);
              console.error('❌ Company research tool failed:', errMessage);
              result = {
                success: false,
                error: `Company research failed: ${errMessage}`,
                message: `Failed to research company: ${errMessage}`
              };
            }
            break;
            
          case 'get_salary_data':
            console.log('💰 Executing get_salary_data:', input);
            try {
              const salaryResult = await browserService.getSalaryData({
                job_title: input.job_title,
                location: input.location,
                experience_level: input.experience_level
              });
              console.log(`✓ Salary data retrieved for ${input.job_title} in ${input.location}`);
              result = {
                success: true,
                data: salaryResult,
                message: `Salary data retrieved for ${input.job_title} in ${input.location}`
              };
            } catch (error: unknown) {
              const errMessage = error instanceof Error ? error.message : String(error);
              console.error('❌ Salary data tool failed:', errMessage);
              result = {
                success: false,
                error: `Salary data retrieval failed: ${errMessage}`,
                message: `Failed to get salary data: ${errMessage}`
              };
            }
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
        
        // Send activity event for tool execution complete with batch context
        if (sendActivity) {
          sendActivity('tool_result', {
            tool: toolUse.name,
            toolId: toolUse.id,
            success: result.success,
            result: result,
            message: result.message,
            ...resultBatchContext
          });
          if (batchId) {
            sendActivity('batch_progress', {
              ...resultBatchContext,
              content: `Completed ${completedCount} of ${toolUses.length} tools`
            });
          }
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
        
        // Send activity event for tool error with batch context
        if (sendActivity) {
          sendActivity('tool_result', {
            tool: toolUse.name,
            toolId: toolUse.id,
            success: false,
            error: errorMessage,
            message: `Failed: ${errorMessage}`,
            ...resultBatchContext
          });
          if (batchId) {
            sendActivity('batch_progress', {
              ...resultBatchContext,
              content: `Completed ${completedCount} of ${toolUses.length} tools (latest failed)`
            });
          }
        }
      }
    }

  // Send batch completion event if this was a batch execution
  if (batchId && sendActivity) {
    const successCount = results.filter(r => !r.is_error).length;
    const failureCount = results.length - successCount;

    sendActivity('batch_complete', {
      batchId,
      batchTotal: toolUses.length,
      batchCompleted: completedCount,
      success: failureCount === 0,
      content: failureCount === 0
        ? `Completed ${toolUses.length} tools successfully`
        : `Completed ${toolUses.length} tools with ${failureCount} error${failureCount > 1 ? 's' : ''}`
    });
  }

  return results;
}

// Legacy function for backward compatibility (non-streaming)
export async function runClaudeAgent(userMessage: string) {
  try {
    const { client, instructions } = await initializeAgent();
    
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
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