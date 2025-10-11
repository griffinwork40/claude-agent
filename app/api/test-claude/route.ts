// app/api/test-claude/route.ts
import { NextResponse } from 'next/server';
import { initializeAgent } from '@/lib/claude-agent';

export async function GET() {
  console.log('=== Testing Claude Agent SDK ===');
  
  try {
    // Check environment variables
    console.log('Environment check:');
    console.log('- ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ 
        error: 'ANTHROPIC_API_KEY not set',
        status: 'error'
      }, { status: 400 });
    }

    // Try to initialize the agent
    console.log('Attempting to initialize agent...');
    await initializeAgent();
    console.log('✓ Agent initialized successfully');
    
    return NextResponse.json({ 
      status: 'success',
      message: 'Claude Agent SDK is working correctly',
      agentName: 'Job Application Assistant'
    });
    
  } catch (error: unknown) {
    console.error('❌ Claude Agent test failed:', error);
    return NextResponse.json({ 
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
