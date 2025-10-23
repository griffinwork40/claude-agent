// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@supabase/supabase-js';

type AuthCallbackEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'
  | 'INITIAL_SESSION';

interface AuthCallbackPayload {
  event: AuthCallbackEvent;
  session: Session | null;
}

export async function GET(req: NextRequest) {
  // auth-helpers middleware already updates cookies; just redirect to settings or redirect param
  const redirectParam = req.nextUrl.searchParams.get('redirect');
  const url = req.nextUrl.clone();
  url.pathname = redirectParam || '/dashboard';
  url.search = '';
  return NextResponse.redirect(url);
}

export async function POST(req: NextRequest) {
  let payload: AuthCallbackPayload;
  try {
    payload = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { event, session } = payload;

  try {
    if (event === 'SIGNED_OUT') {
      await supabase.auth.signOut();
    } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
      await supabase.auth.setSession(session);
    }
  } catch (error) {
    console.error('Failed to sync Supabase session from callback:', error);
    return NextResponse.json({ error: 'Session sync failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}


