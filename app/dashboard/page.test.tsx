// app/dashboard/page.test.tsx
// Purpose: Validates that the dashboard page surfaces Gmail integration errors to the user.

import { render, screen } from '@testing-library/react';
import DashboardPage from './page';
import { getServerSupabase } from '@/lib/supabase/server';
import { getGmailCredentials } from '@/lib/supabase/gmail-credentials';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/supabase/gmail-credentials', () => ({
  getGmailCredentials: vi.fn(),
}));

describe('DashboardPage', () => {
  const mockedGetServerSupabase = vi.mocked(getServerSupabase);
  const mockedGetGmailCredentials = vi.mocked(getGmailCredentials);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an alert when Gmail credentials cannot be fetched', async () => {
    mockedGetServerSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-123' },
            },
          },
        }),
      },
    } as unknown as ReturnType<typeof getServerSupabase>);

    mockedGetGmailCredentials.mockRejectedValue(new Error('Bad response from API'));

    const page = await DashboardPage();
    render(page);

    expect(screen.getByText("We couldn't check your Gmail status.")).toBeInTheDocument();
    const errorMessages = screen.getAllByText("We couldn't retrieve your Gmail status: Bad response from API");
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(screen.getByText('Please refresh the page to try again.')).toBeInTheDocument();
  });
});
