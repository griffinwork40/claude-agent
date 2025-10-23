/**
 * File: components/ui/Button.test.tsx
 * Purpose: Tests the Button component behavior when rendering children via the asChild prop.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import type { MouseEvent } from 'react';

describe('Button asChild behavior', () => {
  it('retains forwarded attributes on the rendered child element', () => {
    render(
      <Button asChild aria-label="open dialog" data-testid="as-child-button">
        <a href="#test">Open</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: /open/i });
    expect(link).toHaveAttribute('aria-label', 'open dialog');
    expect(link).toHaveAttribute('data-testid', 'as-child-button');
    expect(link).toHaveAttribute('href', '#test');
  });

  it('composes event handlers from the button and the child element', async () => {
    const user = userEvent.setup();
    const parentHandler = vi.fn();
    const childHandler = vi.fn();

    render(
      <Button asChild onClick={parentHandler} onKeyDown={parentHandler}>
        <a href="#test" onClick={childHandler} onKeyDown={childHandler}>
          Compose
        </a>
      </Button>
    );

    const link = screen.getByRole('link', { name: /compose/i });
    await user.click(link);
    link.focus();
    await user.keyboard('{Enter}');

    expect(childHandler).toHaveBeenCalled();
    expect(parentHandler).toHaveBeenCalled();
    expect(childHandler.mock.calls.length).toBeGreaterThan(1);
    expect(parentHandler.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not call parent handler when the child prevents default', async () => {
    const user = userEvent.setup();
    const parentHandler = vi.fn();
    const childHandler = vi.fn((event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
    });

    render(
      <Button asChild onClick={parentHandler}>
        <a href="#test" onClick={childHandler}>
          Cancel
        </a>
      </Button>
    );

    const link = screen.getByRole('link', { name: /cancel/i });
    await user.click(link);

    expect(childHandler).toHaveBeenCalledTimes(1);
    expect(parentHandler).not.toHaveBeenCalled();
  });
});
