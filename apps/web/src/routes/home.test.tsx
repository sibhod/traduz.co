import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const authState = { signedIn: true };

vi.mock('@clerk/react', () => ({
  Show: ({ when, children }: { when: 'signed-in' | 'signed-out'; children: ReactNode }) =>
    (when === 'signed-in') === authState.signedIn ? children : null,
  RedirectToSignIn: () => <div data-testid="redirect-to-sign-in" />,
  UserButton: () => <div data-testid="user-button" />,
}));

import { HomeRoute, HomePage } from './home';

describe('/home', () => {
  beforeEach(() => {
    cleanup();
    authState.signedIn = true;
  });

  it('signed in: renders the user button and the Mata el Torre card', () => {
    render(<HomeRoute />);
    expect(screen.getByTestId('user-button')).toBeDefined();
    const torre = screen.getByRole('link', { name: /Mata el Torre/ });
    expect(torre.getAttribute('href')).toBe('/mata-el-torre/');
  });

  it('signed out: redirects to sign-in instead of rendering content', () => {
    authState.signedIn = false;
    render(<HomeRoute />);
    expect(screen.getByTestId('redirect-to-sign-in')).toBeDefined();
    expect(screen.queryByTestId('user-button')).toBeNull();
  });
});
