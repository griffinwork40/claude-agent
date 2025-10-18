/**
 * File: app/api/conversations/route.ts
 * Purpose: Get conversations for a user with optional archived filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Build query
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', session.user.id);

    // Filter by archived status if not including archived
    if (!includeArchived) {
      query = query.eq('archived', false);
    }

    const { data: conversations, error } = await query
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch conversations' 
      }, { status: 500 });
    }

    return NextResponse.json({ conversations });

  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, agentId, name, description } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json({ 
        error: 'sessionId is required' 
      }, { status: 400 });
    }

    // Create or update conversation
    const { data, error } = await supabase
      .from('conversations')
      .upsert({
        user_id: session.user.id,
        session_id: sessionId,
        agent_id: agentId || 'default-agent',
        name: name || `Conversation ${new Date().toLocaleDateString()}`,
        description,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,session_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating conversation:', error);
      return NextResponse.json({ 
        error: 'Failed to create conversation' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      conversation: data 
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
