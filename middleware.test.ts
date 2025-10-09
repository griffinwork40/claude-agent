// middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

vi.mock('@supabase/auth-helpers-nextjs', async () => ({
  updateSession: vi.fn(async () => {}),
  createServerClient: vi.fn(() => ({
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  })),
  createMiddlewareClient: vi.fn(() => ({
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  })),
}));

function makeRequest(pathname: string) {
  // next/server NextRequest is complex; construct with URL
  const url = new URL(`http://localhost:3000${pathname}`);
  // @ts-expect-error - minimal init for tests
  return new NextRequest(url);
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated user from /agent to /login', async () => {
    const req = makeRequest('/agent');
    const res = await middleware(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toContain('/login');
  });

  it('allows public path /login', async () => {
    const req = makeRequest('/login');
    const res = await middleware(req);
    // public path should pass through (undefined or NextResponse.next)
    expect(res?.headers.get('location') || '').not.toContain('/login?');
  });
});


