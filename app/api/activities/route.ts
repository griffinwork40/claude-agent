/**
 * File: app/api/activities/route.ts
 * Purpose: API endpoints for activity persistence and retrieval (Phase 2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Activity, DatabaseActivity, convertDatabaseActivityToActivity } from '@/components/agents/types';

// Helper function to get Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not set');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Redact sensitive data before persisting
function redactActivity(activity: Partial<Activity>): Partial<Activity> {
  if (!activity.params && !activity.result) {
    return { ...activity, isRedacted: false };
  }

  const redacted: Partial<Activity> = { ...activity, isRedacted: true };

  // Redact sensitive parameters
  if (activity.params) {
    const paramsStr = JSON.stringify(activity.params);
    if (paramsStr.includes('password') ||
        paramsStr.includes('token') ||
        paramsStr.includes('key') ||
        paramsStr.includes('secret') ||
        paramsStr.includes('credential')) {
      redacted.params = '[REDACTED: Contains sensitive data]';
    } else {
      // Truncate large parameter objects (>10KB)
      const paramsSize = new Blob([paramsStr]).size;
      if (paramsSize > 10240) {
        redacted.params = JSON.stringify(activity.params).substring(0, 5000) + '... [TRUNCATED]';
      } else {
        redacted.params = activity.params;
      }
    }
  }

  // Redact sensitive results
  if (activity.result) {
    const resultStr = JSON.stringify(activity.result);
    if (resultStr.includes('password') ||
        resultStr.includes('token') ||
        resultStr.includes('key') ||
        resultStr.includes('secret') ||
        resultStr.includes('credential')) {
      redacted.result = '[REDACTED: Contains sensitive data]';
    } else {
      // Truncate large result objects (>10KB)
      const resultSize = new Blob([resultStr]).size;
      if (resultSize > 10240) {
        redacted.result = JSON.stringify(activity.result).substring(0, 5000) + '... [TRUNCATED]';
      } else {
        redacted.result = activity.result;
      }
    }
  }

  return redacted;
}

// GET /api/activities - Fetch activities for a user/agent
export async function GET(request: NextRequest) {
  console.log('=== Activities API GET Request Started ===');

  try {
    // Check authentication
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();

    if (!session) {
      console.error('❌ Unauthorized: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✓ User authenticated:', session.user.id);

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');

    console.log('Query parameters:', { agentId, limit, offset, type });

    // Validate pagination
    if (limit > 100) {
      return NextResponse.json({ error: 'Limit cannot exceed 100' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('activities')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by agent if specified
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    // Filter by type if specified
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Error fetching activities:', error);
      return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
    }

    const activities = (data || []).map(convertDatabaseActivityToActivity);
    const hasMore = offset + limit < (count || 0);

    console.log(`✓ Fetched ${activities.length} activities, total: ${count}, hasMore: ${hasMore}`);

    return NextResponse.json({
      activities,
      hasMore,
      total: count,
      limit,
      offset
    });

  } catch (error) {
    console.error('❌ Error in activities GET API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/activities - Create a new activity (called by chat route)
export async function POST(request: NextRequest) {
  console.log('=== Activities API POST Request Started ===');

  try {
    // Check authentication
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();

    if (!session) {
      console.error('❌ Unauthorized: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✓ User authenticated:', session.user.id);

    const body = await request.json();
    const { activity } = body;

    if (!activity) {
      return NextResponse.json({ error: 'Activity data is required' }, { status: 400 });
    }

    console.log('Creating activity:', {
      type: activity.type,
      tool: activity.tool,
      agentId: activity.agentId,
      batchId: activity.batchId
    });

    // Validate activity structure
    if (!activity.type || !activity.agentId) {
      return NextResponse.json({ error: 'Activity type and agentId are required' }, { status: 400 });
    }

    // Redact sensitive data
    const redactedActivity = redactActivity(activity);

    // Convert to database format
    const dbActivity: Partial<DatabaseActivity> = {
      user_id: session.user.id,
      session_id: activity.agentId, // Use agentId as sessionId for activities
      agent_id: activity.agentId,
      type: activity.type,
      tool: activity.tool,
      tool_id: activity.toolId,
      batch_id: activity.batchId,
      batch_total: activity.batchTotal,
      batch_completed: activity.batchCompleted,
      params: redactedActivity.params,
      result: redactedActivity.result,
      content: activity.content,
      message: activity.message,
      error: activity.error,
      success: activity.success,
      started_at: activity.startedAt,
      completed_at: activity.completedAt,
      is_redacted: redactedActivity.isRedacted,
    };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('activities')
      .insert([dbActivity])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating activity:', error);
      return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
    }

    console.log('✓ Activity created:', data.id);

    return NextResponse.json({
      id: data.id,
      created_at: data.created_at,
      success: true
    });

  } catch (error) {
    console.error('❌ Error in activities POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/activities - Clean up old activities (admin only)
export async function DELETE(request: NextRequest) {
  console.log('=== Activities API DELETE Request Started ===');

  try {
    // Check authentication
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();

    if (!session) {
      console.error('❌ Unauthorized: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get('id');
    const olderThan = searchParams.get('olderThan'); // days

    const supabase = getSupabaseAdmin();

    if (activityId) {
      // Delete specific activity
      console.log('Deleting specific activity:', activityId);

      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId)
        .eq('user_id', session.user.id);

      if (error) {
        console.error('❌ Error deleting activity:', error);
        return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
      }

      console.log('✓ Activity deleted:', activityId);
      return NextResponse.json({ success: true });

    } else if (olderThan) {
      // Delete activities older than X days
      const days = parseInt(olderThan);
      if (isNaN(days) || days < 1) {
        return NextResponse.json({ error: 'Invalid olderThan parameter' }, { status: 400 });
      }

      console.log('Deleting activities older than', days, 'days');

      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('user_id', session.user.id)
        .lt('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('❌ Error deleting old activities:', error);
        return NextResponse.json({ error: 'Failed to delete old activities' }, { status: 500 });
      }

      console.log('✓ Old activities deleted');
      return NextResponse.json({ success: true });

    } else {
      return NextResponse.json({ error: 'Either id or olderThan parameter is required' }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in activities DELETE API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}