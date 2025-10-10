// components/__tests__/HeaderNavigation.test.tsx
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUsePathname = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    usePathname: () => mockUsePathname(),
    useRouter: () => ({ replace: mockReplace }),
  };
});

import HeaderNavigation from '../HeaderNavigation';

afterEach(() => {
  mockUsePathname.mockReset();
  mockReplace.mockReset();
});

describe('HeaderNavigation', () => {
  it('renders desktop navigation with responsive classes', () => {
    mockUsePathname.mockReturnValue('/');
    render(<HeaderNavigation isAuthenticated={false} />);

    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(nav).toHaveClass('hidden');
    expect(nav).toHaveClass('md:flex');

    const desktopLinks = screen.getAllByRole('link', { name: /home|agents|docs/i });
    expect(desktopLinks).toHaveLength(3);
  });

  it('toggles the mobile menu dialog with correct aria attributes', async () => {
    mockUsePathname.mockReturnValue('/agent');
    render(<HeaderNavigation isAuthenticated />);
    const user = userEvent.setup();

    const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    const controlsId = toggleButton.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();

    await user.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    const dialog = await screen.findByRole('dialog', { name: /menu/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('id', controlsId || undefined);

    const agentLink = within(dialog).getByRole('link', { name: 'Agents' });
    expect(agentLink).toHaveAttribute('aria-current', 'page');
  });

  it('highlights the active route for internal links', () => {
    mockUsePathname.mockReturnValue('/');
    render(<HeaderNavigation isAuthenticated={false} />);

    const homeLink = screen.getByRole('link', { name: 'Home' });
    expect(homeLink).toHaveAttribute('aria-current', 'page');

    const docsLink = screen.getByRole('link', { name: 'Docs' });
    expect(docsLink).not.toHaveAttribute('aria-current');
  });
});
