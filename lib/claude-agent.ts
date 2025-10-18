// lib/claude-agent.ts
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, TextBlockParam, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browserTools } from './browser-tools';
import { getOrCreateUserProfile } from './user-profile';
import { ToolUse, ToolResult, BrowserToolResult, JobOpportunity } from '@/types';
import { getUserContextForPrompt } from './user-data-compiler';

// Import modular components
import { gmailToolDefinitions } from './claude/gmail-tools';
import { handleClaudeStream } from './claude/stream-handler';
import { executeTools } from './claude/tool-executor';
import { buildJobSummaryFromResults } from './claude/utils';

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
      ...(process.env.ANTHROPIC_BASE_URL && { baseURL: process.env.ANTHROPIC_BASE_URL }),
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

// Removed: saveAssistantTextChunk - text is now accumulated and saved once at completion



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

    if (!sessionId) {
      throw new Error('Failed to resolve session ID for streaming agent run');
    }

    const resolvedSessionId = sessionId;

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
        await handleClaudeStream(
          client,
          messages,
          instructions,
          agentTools,
          userId,
          resolvedSessionId,
          session,
          controller
        );
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

          case 'find_company_careers_page':
            console.log('🔍 Finding company careers page:', input);
            try {
              const careersResult = await browserService.findCompanyCareersPage({
                companyName: input.companyName,
                jobTitle: input.jobTitle
              });
              result = {
                success: true,
                data: careersResult,
                message: `Found careers page: ${careersResult.careersUrl}`
              };
            } catch (error: unknown) {
              const errMessage = error instanceof Error ? error.message : String(error);
              result = {
                success: false,
                error: errMessage,
                message: `Failed to find careers page: ${errMessage}`
              };
            }
            break;

          case 'extract_company_application_url':
            console.log('🔍 Extracting company application URL:', input);
            try {
              const extractResult = await browserService.extractCompanyApplicationUrl({
                jobBoardUrl: input.jobBoardUrl
              });
              
              if (extractResult.companyApplicationUrl) {
                result = {
                  success: true,
                  data: extractResult,
                  message: `Found company application URL: ${extractResult.companyApplicationUrl}`
                };
              } else {
                result = {
                  success: false,
                  data: extractResult,
                  message: `This job requires applying through the job board (no direct company application available)`
                };
              }
            } catch (error: unknown) {
              const errMessage = error instanceof Error ? error.message : String(error);
              result = {
                success: false,
                error: errMessage,
                message: `Failed to extract company URL: ${errMessage}`
              };
            }
            break;

          case 'search_jobs_greenhouse':
            console.log('🔍 Executing search_jobs_greenhouse:', input);
            try {
              const greenhouseJobsResult = await browserService.searchJobsGreenhouse({
                keywords: input.keywords,
                location: input.location,
                experience_level: input.experience_level,
                remote: input.remote
              });
              console.log(`✓ Greenhouse search completed: ${greenhouseJobsResult.length} jobs found`);
              result = {
                success: true,
                data: greenhouseJobsResult,
                message: `Found ${greenhouseJobsResult.length} jobs on Greenhouse`
              };
            } catch (error: unknown) {
              const errMessage = error instanceof Error ? error.message : String(error);
              console.error('❌ Greenhouse search tool failed:', errMessage);
              result = {
                success: false,
                error: `Greenhouse search failed: ${errMessage}`,
                message: `Failed to search Greenhouse: ${errMessage}`
              };
            }
            break;

          case 'apply_to_greenhouse_job':
            console.log('📝 Executing apply_to_greenhouse_job:', input);
            try {
              const applyResult = await browserService.applyToGreenhouseJob({
                boardToken: input.boardToken,
                jobId: input.jobId,
                userProfile: input.userProfile
              });
              console.log(`✓ Greenhouse application completed: ${applyResult.success ? 'SUCCESS' : 'FAILED'}`);
              result = {
                success: applyResult.success,
                data: applyResult,
                message: applyResult.message
              };
            } catch (error: unknown) {
              const errMessage = error instanceof Error ? error.message : String(error);
              console.error('❌ Greenhouse application tool failed:', errMessage);
              result = {
                success: false,
                error: `Greenhouse application failed: ${errMessage}`,
                message: `Failed to apply to Greenhouse job: ${errMessage}`
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
