// app/api/integrations/gmail/callback/route.ts
// Purpose: Handle the Gmail OAuth callback, persist tokens, and redirect the user back to the dashboard.

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { exchangeAuthorizationCode } from '@/lib/gmail/client';

const STATE_COOKIE_NAME = 'gmail_oauth_state';

function resolveRedirect(request: NextRequest, target: string): URL {
  try {
    return new URL(target);
  } catch {
    return new URL(target, request.url);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieStore = cookies();
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value;
  const successRedirect = process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT || '/dashboard';
  const redirectBase = resolveRedirect(request, successRedirect);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const routeClient = createRouteHandlerClient({ cookies });
  const { data: { session } } = await routeClient.auth.getSession();

  if (!session) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', '/dashboard');
    return NextResponse.redirect(redirectUrl);
  }

  if (error) {
    redirectBase.searchParams.set('gmail_error', error);
    const response = NextResponse.redirect(redirectBase);
    response.cookies.set({ name: STATE_COOKIE_NAME, value: '', maxAge: 0, path: '/' });
    return response;
  }

  if (!code || !state) {
    redirectBase.searchParams.set('gmail_error', 'missing_code');
    const response = NextResponse.redirect(redirectBase);
    response.cookies.set({ name: STATE_COOKIE_NAME, value: '', maxAge: 0, path: '/' });
    return response;
  }

  if (!storedState || storedState !== state) {
    redirectBase.searchParams.set('gmail_error', 'state_mismatch');
    const response = NextResponse.redirect(redirectBase);
    response.cookies.set({ name: STATE_COOKIE_NAME, value: '', maxAge: 0, path: '/' });
    return response;
  }

  try {
    await exchangeAuthorizationCode(session.user.id, code);
    redirectBase.searchParams.set('gmail', 'connected');
  } catch (tokenError) {
    const message = tokenError instanceof Error ? tokenError.message : 'token_exchange_failed';
    redirectBase.searchParams.set('gmail_error', message);
  }

  const response = NextResponse.redirect(redirectBase);
  response.cookies.set({ name: STATE_COOKIE_NAME, value: '', maxAge: 0, path: '/' });
  return response;
}
