/**
 * File: app/api/browser-session/control/route.ts
 * Purpose: Proxy endpoints for claiming and releasing manual browser control from the Next.js app.
 */
import { NextResponse } from 'next/server';
import { getBrowserService } from '@/lib/browser-tools';

interface ControlRequestBody {
  sessionId: string;
  reason?: string;
  timeoutMs?: number;
}

/**
 * Claim control from the automation loop so the user can interact with the browser directly.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ControlRequestBody;
    if (!body.sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId is required' }, { status: 400 });
    }

    const browserService = getBrowserService();
    const response = await browserService.requestUserControl(body.sessionId);
    return NextResponse.json({ success: true, data: response });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to request control', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Release control back to the AI automation system.
 */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as ControlRequestBody;
    if (!body.sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId is required' }, { status: 400 });
    }

    const browserService = getBrowserService();
    const response = await browserService.releaseUserControl(body.sessionId);
    return NextResponse.json({ success: true, data: response });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to release control', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
