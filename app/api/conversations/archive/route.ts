/**
 * File: app/api/conversations/archive/route.ts
 * Purpose: API endpoint for archiving/unarchiving conversations
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not set');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Archive Conversation API Request ===');
    
    // Check authentication
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();
    
    if (!session) {
      console.error('❌ Unauthorized: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { conversationId, archived } = await request.json();
    
    if (!conversationId || typeof archived !== 'boolean') {
      return NextResponse.json({ 
        error: 'conversationId and archived (boolean) are required' 
      }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();
    
    // Check if conversation exists
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single();
    
    if (existingConversation) {
      // Update existing conversation
      const { data, error } = await supabase
        .from('conversations')
        .update({ 
          archived,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .eq('user_id', session.user.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating conversation:', error);
        return NextResponse.json({ 
          error: 'Failed to update conversation' 
        }, { status: 500 });
      }
      
      console.log(`✓ Conversation ${archived ? 'archived' : 'unarchived'}:`, conversationId);
      return NextResponse.json({ success: true, data });
    } else {
      // Create new conversation record (for legacy conversations that don't have a record yet)
      const { data, error } = await supabase
        .from('conversations')
        .insert([{
          id: conversationId,
          user_id: session.user.id,
          archived,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating conversation:', error);
        return NextResponse.json({ 
          error: 'Failed to create conversation' 
        }, { status: 500 });
      }
      
      console.log(`✓ Conversation created and ${archived ? 'archived' : 'unarchived'}:`, conversationId);
      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error('Error in archive API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== Get Conversations API Request ===');
    
    // Check authentication
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();
    
    if (!session) {
      console.error('❌ Unauthorized: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', session.user.id);
    
    if (!includeArchived) {
      query = query.eq('archived', false);
    }
    
    const { data, error } = await query.order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch conversations' 
      }, { status: 500 });
    }
    
    console.log(`✓ Fetched ${data?.length || 0} conversations`);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in get conversations API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
