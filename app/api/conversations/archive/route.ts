/**
 * File: app/api/conversations/archive/route.ts
 * Purpose: Archive/unarchive conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, archived } = await request.json();
    
    if (!sessionId || typeof archived !== 'boolean') {
      return NextResponse.json({ 
        error: 'sessionId and archived (boolean) are required' 
      }, { status: 400 });
    }

    // Update the conversation's archived status
    const { data, error } = await supabase
      .from('conversations')
      .update({ 
        archived,
        archived_at: archived ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', session.user.id)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error archiving conversation:', error);
      return NextResponse.json({ 
        error: 'Failed to archive conversation' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      conversation: data 
    });

  } catch (error) {
    console.error('Archive conversation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
