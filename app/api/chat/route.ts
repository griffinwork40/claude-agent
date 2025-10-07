// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Message } from '@/types';
import { runClaudeAgent } from '@/lib/claude-agent';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Store user message in database
    const { data: userMessage, error: userMessageError } = await supabase
      .from('messages')
      .insert([{ 
        content: message, 
        sender: 'user',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    // Run Claude Agent to process the message
    const agentResponse = await runClaudeAgent(message, userMessage.id);

    // Store bot response in database
    const { data: botMessage, error: botMessageError } = await supabase
      .from('messages')
      .insert([{
        content: agentResponse.content,
        sender: 'bot',
        job_opportunity: agentResponse.jobOpportunity || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (botMessageError) {
      console.error('Error saving bot message:', botMessageError);
      return NextResponse.json({ error: 'Failed to save bot response' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: botMessage,
      jobOpportunity: agentResponse.jobOpportunity 
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
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