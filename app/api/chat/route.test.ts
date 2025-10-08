import { describe, it, expect, vi } from 'vitest';
import * as route from './route';

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));

describe('chat route guards', () => {
  it('rejects unauthenticated POST', async () => {
    // @ts-expect-error minimal request mock
    const res = await route.POST({ json: async () => ({ message: 'hi' }) });
    expect(res.status).toBe(401);
  });
});


