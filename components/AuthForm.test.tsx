import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthForm from './AuthForm';
import { vi } from 'vitest';

const signInWithOAuthMock = vi.fn(async () => ({}));
const signInWithPasswordMock = vi.fn(async () => ({ data: {}, error: null }));
const signUpMock = vi.fn(async () => ({ data: {}, error: null }));

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
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
  beforeEach(() => {
    signInWithOAuthMock.mockClear();
    signInWithPasswordMock.mockClear();
    signUpMock.mockClear();
  });

  it('logs in with email and password', async () => {
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'supersecret' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(screen.queryByText(/please wait/i)).toBeNull());
  });

  it('requires accepting the terms of service before signing up', async () => {
    render(<AuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'supersecret' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(await screen.findByText(/you must agree to the terms of service/i)).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/i agree to the terms of service/i));
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    await waitFor(() => expect(signUpMock).toHaveBeenCalledTimes(1));
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

  it('requires ToS acceptance before starting OAuth signup', async () => {
    render(<AuthForm mode="signup" />);
    const oauthBtn = await screen.findByRole('button', { name: /continue with google/i });
    fireEvent.click(oauthBtn);

    expect(
      await screen.findByText(/you must agree to the terms of service/i)
    ).toBeInTheDocument();
    expect(signInWithOAuthMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/i agree to the terms of service/i));
    fireEvent.click(oauthBtn);

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' })
      );
    });
  });
});


