import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const authState = { signedIn: false };

vi.mock('@clerk/react', () => ({
  Show: ({ when, children }: { when: 'signed-in' | 'signed-out'; children: ReactNode }) =>
    (when === 'signed-in') === authState.signedIn ? children : null,
  SignInButton: ({ children }: { children: ReactNode }) => children,
  SignUpButton: ({ children }: { children: ReactNode }) => children,
}));

import { LandingPage } from './index';

describe('LandingPage', () => {
  beforeEach(() => {
    cleanup();
    authState.signedIn = false;
  });

  it('signed out: shows tagline and both auth buttons', () => {
    render(<LandingPage />);
    expect(screen.getByText('Spanish, played — not studied.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
  });

  it('signed in: shows the home link instead of auth buttons', () => {
    authState.signedIn = true;
    render(<LandingPage />);
    const homeLink = screen.getByRole('link', { name: 'Go to home' });
    expect(homeLink.getAttribute('href')).toBe('/home');
    expect(screen.queryByRole('button', { name: 'Sign up' })).toBeNull();
  });
});
