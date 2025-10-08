// app/api/test-stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

export async function GET(request: NextRequest) {
  console.log('=== Testing Claude Agent Streaming ===');
  
  try {
    // Check environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ 
        error: 'ANTHROPIC_API_KEY not set',
        status: 'error'
      }, { status: 400 });
    }

    console.log('Testing query function with streaming...');
    const queryResult = query({
      prompt: 'Hello, can you help me find a job?',
      options: {
        systemPrompt: 'You are a helpful job search assistant.',
        stream: true
      }
    });

    console.log('Query result created:', {
      hasSdkMessages: !!queryResult.sdkMessages,
      keys: Object.keys(queryResult)
    });

    // Test reading a few messages
    let messageCount = 0;
    const messages = [];
    
    for await (const message of queryResult.sdkMessages) {
      messageCount++;
      messages.push({
        type: message.type,
        hasContent: !!message.content,
        contentLength: message.content?.length || 0
      });
      
      console.log(`Message ${messageCount}:`, message.type, message.content?.substring(0, 50) + '...');
      
      if (messageCount >= 5) {
        console.log('Stopping after 5 messages for testing');
        break;
      }
    }

    return NextResponse.json({ 
      status: 'success',
      message: 'Streaming test completed',
      messageCount,
      messages
    });
    
  } catch (error) {
    console.error('❌ Stream test failed:', error);
    return NextResponse.json({ 
      status: 'error',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
