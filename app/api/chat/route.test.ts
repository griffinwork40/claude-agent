import { describe, it, expect, vi } from 'vitest';
import * as route from './route';

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'test-id' }, error: null })
        })
      })
    })
  })
}));

vi.mock('@/lib/claude-agent', () => ({
  runClaudeAgentStream: vi.fn(() => Promise.resolve({
    sessionId: 'test-session',
    stream: new ReadableStream()
  }))
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({}))
}));

describe('chat route guards', () => {
  it('rejects unauthenticated POST', async () => {
    // @ts-expect-error minimal request mock
    const res = await route.POST({ json: async () => ({ message: 'hi' }) });
    expect(res.status).toBe(401);
  });
});


