// app/api/integrations/gmail/start/route.ts
// Purpose: Initiate Gmail OAuth flow by redirecting the user to Google's consent screen.

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { buildGmailConsentUrl } from '@/lib/gmail/buildConsentUrl';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/gmail/start
 * Redirect the authenticated user to Google's OAuth consent page with a CSRF-protected state token.
 */
export async function GET(request: NextRequest) {
  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const state = randomBytes(16).toString('hex');
    const consentUrl = buildGmailConsentUrl(state);
    const response = NextResponse.redirect(consentUrl);

    response.cookies.set({
      name: 'gmail_oauth_state',
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/'
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error starting Gmail OAuth.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
