// app/api/integrations/gmail/start/route.ts
// Purpose: Initiate the Gmail OAuth flow by generating a consent URL and redirecting the authenticated user.

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { buildOAuthConsentUrl } from '@/lib/gmail/client';

const STATE_COOKIE_NAME = 'gmail_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const routeClient = createRouteHandlerClient({ cookies });
  const { data: { session } } = await routeClient.auth.getSession();

  if (!session) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', '/dashboard');
    return NextResponse.redirect(redirectUrl);
  }

  const state = crypto.randomBytes(16).toString('hex');
  const consentUrl = buildOAuthConsentUrl(state);

  const response = NextResponse.redirect(consentUrl);
  response.cookies.set({
    name: STATE_COOKIE_NAME,
    value: state,
    maxAge: STATE_TTL_SECONDS,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  });

  return response;
}
