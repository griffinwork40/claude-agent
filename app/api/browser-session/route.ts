/**
 * File: app/api/browser-session/route.ts
 * Purpose: Next.js route for provisioning persistent browser sessions with preview metadata.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getBrowserService } from '@/lib/browser-tools';

interface CreateSessionRequest {
  sessionId?: string;
  headful?: boolean;
}

/**
 * Create or resume a persistent browser session and return preview credentials.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSessionRequest;
    const desiredSessionId = body.sessionId ?? randomUUID();
    const headful = body.headful ?? true;

    const browserService = getBrowserService();
    const response = await browserService.createSession({ sessionId: desiredSessionId, headful });
    const preview = response.preview ?? (await browserService.getSessionPreview(desiredSessionId));

    return NextResponse.json({
      success: true,
      data: {
        sessionId: desiredSessionId,
        preview,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to create browser session', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Fetch preview metadata for an existing session.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const browserService = getBrowserService();
    const preview = await browserService.getSessionPreview(sessionId);
    if (!preview) {
      return NextResponse.json({ success: false, error: 'Preview not available' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { sessionId, preview } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch session preview', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
