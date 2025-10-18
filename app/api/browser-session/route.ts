// app/api/browser-session/route.ts
// Next.js API route for browser session management with VNC support
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:3001';
const BROWSER_SERVICE_API_KEY = process.env.BROWSER_SERVICE_API_KEY || 'test-key-12345';

async function makeBrowserServiceRequest(endpoint: string, body: any) {
  const response = await fetch(`${BROWSER_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BROWSER_SERVICE_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Browser service error: ${error.error || response.statusText}`);
  }

  return response.json();
}

// Create a new browser session
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, headful = false } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    console.log(`🆕 Creating browser session for user ${user.id}: ${sessionId}`);

    const result = await makeBrowserServiceRequest('/api/browser/session/create', {
      sessionId,
      userId: user.id,
      headful
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ Create browser session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create browser session' },
      { status: 500 }
    );
  }
}

// Get session information
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const response = await fetch(`${BROWSER_SERVICE_URL}/api/browser/session/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${BROWSER_SERVICE_API_KEY}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      return NextResponse.json({ error: error.error || 'Session not found' }, { status: 404 });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ Get browser session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get browser session' },
      { status: 500 }
    );
  }
}