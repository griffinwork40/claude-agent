// lib/supabase/gmail-credentials.test.ts
// Purpose: Validate Supabase helpers for Gmail credential persistence.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => {
  const from = vi.fn();
  const createClient = vi.fn(() => ({ from }));
  return { from, createClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient
}));

import { deleteGmailCredentials, getGmailCredentials, upsertGmailCredentials } from './gmail-credentials';
import { resetSupabaseServiceRoleClient } from './service-client';

function setupEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
}

describe('gmail credential supabase helpers', () => {
  beforeEach(() => {
    setupEnv();
    resetSupabaseServiceRoleClient();
    supabaseMocks.from.mockReset();
    supabaseMocks.createClient.mockClear();
  });

  it('retrieves a credential record', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        user_id: 'user-1',
        access_token: 'access',
        refresh_token: 'refresh',
        expiry: new Date().toISOString()
      },
      error: null
    });

    const select = vi.fn(() => ({
      eq: () => ({ maybeSingle })
    }));

    supabaseMocks.from.mockImplementation(() => ({ select }));

    const record = await getGmailCredentials('user-1');

    expect(supabaseMocks.from).toHaveBeenCalledWith('gmail_credentials');
    expect(select).toHaveBeenCalledWith('*');
    expect(record?.access_token).toBe('access');
    expect(maybeSingle).toHaveBeenCalled();
  });

  it('upserts credential data with updated timestamp', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    supabaseMocks.from.mockImplementation(() => ({ upsert }));

    await upsertGmailCredentials({
      userId: 'user-2',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiry: '2030-01-01T00:00:00.000Z'
    });

    expect(supabaseMocks.from).toHaveBeenCalledWith('gmail_credentials');
    expect(upsert).toHaveBeenCalledTimes(1);
    const payload = upsert.mock.calls[0][0];
    expect(payload).toMatchObject({
      user_id: 'user-2',
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expiry: '2030-01-01T00:00:00.000Z'
    });
    expect(typeof payload.updated_at).toBe('string');
  });

  it('deletes credential records', async () => {
    const deleteCall = vi.fn().mockResolvedValue({ error: null });
    supabaseMocks.from.mockImplementation(() => ({
      delete: () => ({ eq: deleteCall })
    }));

    await deleteGmailCredentials('user-3');

    expect(supabaseMocks.from).toHaveBeenCalledWith('gmail_credentials');
    expect(deleteCall).toHaveBeenCalledWith('user_id', 'user-3');
  });
});
