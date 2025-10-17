// app/api/testing/gmail/disconnect/route.ts
// Purpose: Mock API route returning a successful Gmail disconnect response for automated tests.

import { NextResponse } from 'next/server';

/**
 * Simulates a Gmail disconnect endpoint for test purposes.
 *
 * @returns {Promise<NextResponse>} A JSON response representing a successful disconnect.
 */
export async function POST(): Promise<NextResponse> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return NextResponse.json({ success: true });
}
