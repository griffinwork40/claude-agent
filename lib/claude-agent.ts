/**
 * Claude agent orchestration entry point.
 *
 * Provides helpers for initializing the Anthropic client, managing chat sessions,
 * and exposing streaming as well as legacy non-streaming agent executions.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { browserTools } from './browser-tools';
import type { JobOpportunity } from '@/types';

// Import modular components
import { gmailToolDefinitions } from './claude/gmail-tools';
import { handleClaudeStream } from './claude/stream-handler';

// Debug: Log SDK import
console.log('Anthropic SDK imported successfully');
console.log('Anthropic class:', Anthropic);

// Initialize the Anthropic client
let anthropic: Anthropic | null = null;
let agentInstructions: string | null = null;


const agentTools = [...browserTools, ...gmailToolDefinitions];

/**
 * Initialize the Anthropic client and load agent instructions.
 *
 * @returns A promise resolving to the Anthropic client instance and agent instructions.
 * @throws If required configuration or API keys are missing.
 */
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

/**
 * Create a new agent session for a user.
 *
 * @param userId - Identifier for the user starting a session.
 * @returns A promise resolving to the generated session identifier.
 */
export async function createAgentSession(userId: string): Promise<string> {
  const sessionId = `session_${Date.now()}_${userId}`;
  agentSessions.set(sessionId, { userId, messages: [] });
  return sessionId;
}

/**
 * Retrieve an existing agent session by identifier.
 *
 * @param sessionId - Identifier of the session to fetch.
 * @returns A promise resolving to the stored agent session or undefined if not found.
 */
export async function getAgentSession(sessionId: string) {
  return agentSessions.get(sessionId);
}

/**
 * Execute the Claude agent with streaming support for tool use.
 *
 * @param userMessage - The latest user message to add to the conversation.
 * @param userId - Identifier for the requesting user.
 * @param sessionId - Optional existing session identifier to continue.
 * @param agentId - Optional agent identifier for analytics.
 * @returns A promise resolving to the session identifier and a readable stream of model output.
 */
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

// Legacy function for backward compatibility (non-streaming)
/**
 * Execute the Claude agent without streaming for backward compatibility.
 *
 * @param userMessage - The user message to process.
 * @returns A promise resolving to the generated response content and optional job opportunity summary.
 */
export async function runClaudeAgent(userMessage: string): Promise<{ content: string; jobOpportunity: JobOpportunity | null }> {
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
