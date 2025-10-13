// app/api/integrations/gmail/disconnect/route.ts
// Purpose: Remove stored Gmail credentials for the authenticated user.

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { disconnectGmailAccount } from '@/lib/gmail/client';

export async function POST(): Promise<NextResponse> {
  const routeClient = createRouteHandlerClient({ cookies });
  const { data: { session } } = await routeClient.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await disconnectGmailAccount(session.user.id);
  return NextResponse.json({ success: true });
}
