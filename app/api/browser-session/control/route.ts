// app/api/browser-session/control/route.ts
// Next.js API route for browser session control (take/release control)
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

// Take control of a browser session
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, action } = await request.json();

    if (!sessionId || !action) {
      return NextResponse.json({ error: 'sessionId and action are required' }, { status: 400 });
    }

    if (!['take_control', 'release_control'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be take_control or release_control' }, { status: 400 });
    }

    const clientId = `user_${user.id}_${Date.now()}`;
    console.log(`🎮 ${action} for session ${sessionId} by user ${user.id}`);

    const endpoint = action === 'take_control' 
      ? '/api/browser/session/take-control'
      : '/api/browser/session/release-control';

    const result = await makeBrowserServiceRequest(endpoint, {
      sessionId,
      clientId
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`❌ Browser session control error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to control browser session' },
      { status: 500 }
    );
  }
}