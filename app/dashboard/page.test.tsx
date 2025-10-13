import { describe, it, vi, expect } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));

describe('Dashboard page auth', () => {
  it('server check is mockable (example placeholder)', async () => {
    expect(true).toBe(true);
  });
});


