// app/api/integrations/gmail/disconnect/route.ts
// Purpose: Remove stored Gmail credentials for the authenticated user.

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { disconnectGmailAccount } from '@/lib/gmail/client';

export async function POST(): Promise<NextResponse> {
  // Validate required environment variables at runtime
  const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    return NextResponse.json(
      {
        error: 'Server configuration error',
        details: `Missing required environment variables: ${missingVars.join(', ')}`
      },
      { status: 500 }
    );
  }

  const routeClient = createRouteHandlerClient({ cookies });
  const { data: { session } } = await routeClient.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await disconnectGmailAccount(session.user.id);
  return NextResponse.json({ success: true });
}
