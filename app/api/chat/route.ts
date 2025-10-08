// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Message } from '@/types';
import { runClaudeAgent, runClaudeAgentStream } from '@/lib/claude-agent';

// Create Supabase client lazily to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
  console.log('=== Chat API Request Started ===');
  
  try {
    console.log('Checking authentication...');
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();
    
    if (!session) {
      console.error('❌ Unauthorized: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✓ User authenticated:', session.user.id);
    
    const { message, sessionId } = await request.json();
    console.log('Request data:', { 
      messageLength: message?.length, 
      sessionId,
      hasMessage: !!message,
      requestHeaders: Object.fromEntries(request.headers.entries())
    });
    
    if (!message) {
      console.error('❌ No message provided');
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Store user message in database
    console.log('Saving user message to database...');
    const supabase = getSupabaseClient();
    const { data: userMessage, error: userMessageError } = await supabase
      .from('messages')
      .insert([{ 
        content: message, 
        sender: 'user',
        user_id: session.user.id,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (userMessageError) {
      console.error('❌ Error saving user message:', userMessageError);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }
    console.log('✓ User message saved:', userMessage.id);

    // Run Claude Agent with streaming
    console.log('Starting Claude agent stream...');
    let agentSessionId: string;
    let stream: ReadableStream;
    
    try {
      const result = await runClaudeAgentStream(
        message, 
        session.user.id, 
        sessionId
      );
      agentSessionId = result.sessionId;
      stream = result.stream;
      console.log('✓ Agent stream started, sessionId:', agentSessionId);
    } catch (error: unknown) {
      console.error('❌ Failed to start agent stream:', error);
      const errMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ 
        error: 'Failed to start agent stream',
        details: process.env.NODE_ENV === 'development' ? errMessage : undefined
      }, { status: 500 });
    }

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder();
    let fullResponse = '';
    let preambleSent = false;

    const readableStream = new ReadableStream({
      async start(controller) {
        console.log('Starting stream processing...');
        // Ensure counters/state visible to catch scope
        let chunkCount = 0;
        try {
          // Immediately send a preamble SSE event so the client receives bytes even if downstream fails
          const preamble = `data: ${JSON.stringify({ type: 'status', content: 'starting' })}\n\n`;
          controller.enqueue(encoder.encode(preamble));
          preambleSent = true;
          console.log('✓ SSE preamble event sent');

          const reader = stream.getReader();
          // chunkCount declared above
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('✓ Stream completed, total chunks:', chunkCount);
              console.log('Saving complete response to database...');
              
              // Store the complete response in database
              const { data: botMessage, error: botMessageError } = await supabase
                .from('messages')
                .insert([{
                  content: fullResponse,
                  sender: 'bot',
                  user_id: session.user.id,
                  created_at: new Date().toISOString()
                }])
                .select()
                .single();

              if (botMessageError) {
                console.error('❌ Error saving bot message:', botMessageError);
              } else {
                console.log('✓ Bot message saved:', botMessage.id);
              }

              // Send final event with session ID
              const finalEvent = `data: ${JSON.stringify({ 
                type: 'complete', 
                sessionId: agentSessionId,
                messageId: botMessage?.id 
              })}\n\n`;
              controller.enqueue(encoder.encode(finalEvent));
              controller.close();
              console.log('✓ Stream closed successfully');
              break;
            }

            // Decode the chunk and add to full response
            const chunk = new TextDecoder().decode(value);
            console.log('Chunk received bytes:', value?.length ?? 0);
            fullResponse += chunk;
            chunkCount++;

            // Send chunk as SSE
            const event = `data: ${JSON.stringify({ 
              type: 'chunk', 
              content: chunk 
            })}\n\n`;
            controller.enqueue(encoder.encode(event));
            
            if (chunkCount % 10 === 0) {
              console.log(`Processed ${chunkCount} chunks, response length: ${fullResponse.length}`);
            }
          }
        } catch (error: unknown) {
          console.error('❌ Error in streaming:', error);
          const errMessage = error instanceof Error ? error.message : String(error);
          const errStack = error instanceof Error ? error.stack : undefined;
          console.error('Streaming error details:', {
            message: errMessage,
            stack: errStack,
            fullResponseLength: fullResponse.length,
            chunkCount
          });
          
          // Ensure client receives an error SSE event before closing
          try {
            const errorEvent = `data: ${JSON.stringify({ 
              type: 'error', 
              error: `Streaming error: ${errMessage}`,
              details: process.env.NODE_ENV === 'development' ? errStack : undefined
            })}\n\n`;
            controller.enqueue(encoder.encode(errorEvent));
            console.log('✓ SSE error event sent to client');
          } catch (enqueueErr) {
            console.error('❌ Failed to enqueue SSE error event:', enqueueErr);
          }
          controller.close();
        }
      }
    });

    console.log('✓ Returning streaming response');
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: unknown) {
    console.error('❌ Error in chat API:', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    const errName = error instanceof Error ? error.name : undefined;
    console.error('API Error details:', {
      message: errMessage,
      stack: errStack,
      name: errName
    });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errMessage : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET messages API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}