// middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

vi.mock('@supabase/auth-helpers-nextjs', async () => {
  return {
    updateSession: vi.fn(async () => {}),
    createServerClient: vi.fn(() => ({
      auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    })),
    createMiddlewareClient: vi.fn(() => ({
      auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    })),
  };
});

function makeRequest(pathname: string) {
  // next/server NextRequest is complex; construct with URL
  const url = new URL(`http://localhost:3000${pathname}`);
  return new NextRequest(url);
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated user from /agent to /login', async () => {
    // Mock environment variables to enable auth checks
    const originalEnv = process.env;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    
    const req = makeRequest('/agent');
    const res = await middleware(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toContain('/login');
    
    // Restore original environment
    process.env = originalEnv;
  });

  it('redirects unauthenticated user from /dashboard to /login', async () => {
    // Mock environment variables to enable auth checks
    const originalEnv = process.env;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    
    const req = makeRequest('/dashboard');
    const res = await middleware(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toContain('/login');
    
    // Restore original environment
    process.env = originalEnv;
  });

  it('allows public path /login', async () => {
    const req = makeRequest('/login');
    const res = await middleware(req);
    // public path should pass through (undefined or NextResponse.next)
    expect(res?.headers.get('location') || '').not.toContain('/login?');
  });
});


