/**
 * File: app/api/sessions/route.ts
 * Purpose: API routes for managing conversation sessions (archive, unarchive, update metadata)
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

/**
 * GET /api/sessions - Fetch all sessions for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    console.log('=== GET Sessions API Request Started ===');
    
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
      .from('sessions')
      .select('*')
      .eq('user_id', session.user.id);
    
    if (!includeArchived) {
      query = query.eq('archived', false);
    }
    
    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    console.log(`✓ Fetched ${data?.length || 0} sessions for user`);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET sessions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/sessions - Create or update a session
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== POST Sessions API Request Started ===');
    
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();
    
    if (!session) {
      console.error('❌ Unauthorized: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { id, name, description } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();
    
    // Check if session exists
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();
    
    if (existingSession) {
      // Update existing session
      const { data, error } = await supabase
        .from('sessions')
        .update({
          name,
          description,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', session.user.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating session:', error);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, data });
    } else {
      // Create new session
      const { data, error } = await supabase
        .from('sessions')
        .insert([{
          id,
          user_id: session.user.id,
          name,
          description,
          archived: false
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating session:', error);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error('Error in POST sessions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/sessions - Update session archived status
 */
export async function PATCH(request: NextRequest) {
  try {
    console.log('=== PATCH Sessions API Request Started ===');
    
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();
    
    if (!session) {
      console.error('❌ Unauthorized: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { id, archived } = body;
    
    if (!id || typeof archived !== 'boolean') {
      return NextResponse.json({ 
        error: 'Session ID and archived status are required' 
      }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();
    
    // Check if session exists, create if it doesn't
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();
    
    if (!existingSession) {
      // Create the session first
      const { error: insertError } = await supabase
        .from('sessions')
        .insert([{
          id,
          user_id: session.user.id,
          name: id === 'default-agent' ? 'Job Application Assistant' : `Conversation ${id.slice(-6)}`,
          archived: archived,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      
      if (insertError) {
        console.error('Error creating session:', insertError);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }
    }
    
    // Update the archived status
    const { data, error } = await supabase
      .from('sessions')
      .update({
        archived,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating session archived status:', error);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }
    
    console.log(`✓ Session ${id} archived status updated to ${archived}`);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in PATCH sessions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
