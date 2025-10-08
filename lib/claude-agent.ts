// lib/claude-agent.ts
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { browserTools, getBrowserJobService } from './browser-tools';
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
    return { client: anthropic, instructions: agentInstructions };
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
    let session;
    if (sessionId && agentSessions.has(sessionId)) {
      console.log('Using existing session:', sessionId);
      session = agentSessions.get(sessionId);
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
          
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
              // Start of a tool use
              currentToolUse = {
                id: chunk.content_block.id,
                name: chunk.content_block.name,
                input: {}
              };
              toolInputJson = '';
              console.log(`🔧 Tool use started: ${chunk.content_block.name}`);
            } else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'input_json_delta') {
              // Collect tool input JSON
              toolInputJson += chunk.delta.partial_json;
            } else if (chunk.type === 'content_block_stop' && currentToolUse) {
              // End of tool use, parse input and execute
              try {
                currentToolUse.input = JSON.parse(toolInputJson);
                toolUses.push(currentToolUse);
                console.log(`🔧 Tool use completed: ${currentToolUse.name}`, currentToolUse.input);
              } catch (error) {
                console.error('Error parsing tool input JSON:', error);
              }
              currentToolUse = null;
              toolInputJson = '';
            } else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              // Regular text content
              const content = chunk.delta.text;
              if (content) {
                console.log(`✓ Streaming chunk: ${content.length} chars`);
                const encoded = new TextEncoder().encode(content);
                controller.enqueue(encoded);
              }
            } else if (chunk.type === 'message_stop') {
              console.log('✓ Stream completed, executing tools...');
              
              // Execute tools if any were requested
              if (toolUses.length > 0) {
                console.log(`🔧 Executing ${toolUses.length} tools...`);
                const toolResults = await executeTools(toolUses, userId);
                
                // Add tool results to messages and continue conversation
                const toolResultMessages = toolResults.map(result => ({
                  role: 'user' as const,
                  content: [{
                    type: 'tool_result' as const,
                    tool_use_id: result.tool_use_id,
                    content: result.content,
                    is_error: result.is_error
                  }]
                }));
                
                // Continue conversation with tool results
                const continuationStream = await client.messages.create({
                  model: 'claude-3-5-sonnet-latest',
                  max_tokens: 4096,
                  system: instructions,
                  messages: [
                    ...messages,
                    ...toolResultMessages
                  ],
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
async function executeTools(toolUses: ToolUse[], userId: string): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  const browserService = getBrowserJobService();
  
  try {
    await browserService.initialize();
    
    for (const toolUse of toolUses) {
      console.log(`🔧 Executing tool: ${toolUse.name}`, toolUse.input);
      
      try {
        let result: BrowserToolResult;
        
        switch (toolUse.name) {
          case 'search_jobs_indeed':
            const indeedJobs = await browserService.searchJobsIndeed(toolUse.input as {
              keywords: string;
              location: string;
              experience_level?: string;
              remote?: boolean;
            });
            result = {
              success: true,
              data: indeedJobs,
              message: `Found ${indeedJobs.length} jobs on Indeed`
            };
            break;
            
          case 'search_jobs_linkedin':
            const linkedinJobs = await browserService.searchJobsLinkedIn({
              ...(toolUse.input as {
                keywords: string;
                location: string;
                experience_level?: string;
                remote?: boolean;
              }),
              userId
            });
            result = {
              success: true,
              data: linkedinJobs,
              message: `Found ${linkedinJobs.length} jobs on LinkedIn`
            };
            break;
            
          case 'get_job_details':
            const jobDetails = await browserService.getJobDetails((toolUse.input as { job_url: string }).job_url);
            result = {
              success: true,
              data: jobDetails,
              message: 'Job details retrieved successfully'
            };
            break;
            
          case 'apply_to_job':
            // Get user profile for application
            const userProfile = await getOrCreateUserProfile(userId);
            if (!userProfile) {
              result = {
                success: false,
                error: 'User profile not found. Please set up your profile first.'
              };
            } else {
              const applicationResult = await browserService.applyToJob(
                (toolUse.input as { job_url: string }).job_url,
                userProfile as unknown as Record<string, unknown>
              );
              result = {
                success: applicationResult.success,
                data: applicationResult.details,
                message: applicationResult.message
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
        
      } catch (error: unknown) {
        console.error(`❌ Error executing tool ${toolUse.name}:`, error);
        results.push({
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }),
          is_error: true
        });
      }
    }
    
  } catch (error: unknown) {
    console.error('❌ Error in executeTools:', error);
    // Return error for all tools
    for (const toolUse of toolUses) {
      results.push({
        tool_use_id: toolUse.id,
        content: JSON.stringify({
          success: false,
          error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        }),
        is_error: true
      });
    }
  } finally {
    // Don't close browser here as it might be needed for multiple tools
    // await browserService.close();
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