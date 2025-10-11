// app/api/test-stream/route.ts
import { NextResponse } from 'next/server';
import { initializeAgent } from '@/lib/claude-agent';

export async function GET() {
  console.log('=== Testing Claude Agent Streaming ===');
  
  try {
    // Check environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ 
        error: 'ANTHROPIC_API_KEY not set',
        status: 'error'
      }, { status: 400 });
    }

    console.log('Testing Claude agent initialization...');
    const { client, instructions } = await initializeAgent();
    
    console.log('✓ Claude agent initialized successfully');
    console.log('✓ Instructions loaded, length:', instructions.length);
    console.log('✓ Client ready for streaming');

    return NextResponse.json({ 
      status: 'success',
      message: 'Claude agent initialization test passed',
      details: {
        instructionsLength: instructions.length,
        clientReady: !!client
      }
    });
    
  } catch (error: unknown) {
    console.error('❌ Stream test failed:', error);
    return NextResponse.json({ 
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
