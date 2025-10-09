import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthForm from './AuthForm';
import { vi } from 'vitest';

const signInWithOAuthMock = vi.fn(async () => ({}));

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => ({
    auth: {
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
      signUp: vi.fn(async () => ({ data: {}, error: null })),
      signInWithOAuth: signInWithOAuthMock,
    },
  }),
}));

vi.mock('next/navigation', async (orig) => {
  const actual = await orig();
  return {
    ...(actual as Record<string, unknown>),
    useRouter: () => ({ replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
  };
});

describe('AuthForm', () => {
  it('logs in with email and password', async () => {
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(screen.queryByText(/please wait/i)).toBeNull());
  });

  it('signs up with email and password', async () => {
    render(<AuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    await waitFor(() => expect(screen.queryByText(/please wait/i)).toBeNull());
  });

  it('renders LinkedIn button and triggers LinkedIn OAuth', async () => {
    render(<AuthForm mode="login" />);
    const btn = await screen.findByRole('button', { name: /continue with linkedin/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'linkedin' })
      );
    });
  });
});


