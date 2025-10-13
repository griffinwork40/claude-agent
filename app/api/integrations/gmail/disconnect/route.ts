// app/api/integrations/gmail/disconnect/route.ts
// Purpose: Remove stored Gmail credentials so the user can disconnect the integration.

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { deleteGmailCredentials } from '@/lib/supabase/gmail/deleteGmailCredentials';

export const dynamic = 'force-dynamic';

/**
 * POST /api/integrations/gmail/disconnect
 * Delete Gmail credentials for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await routeClient.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteGmailCredentials(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disconnect Gmail integration.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
