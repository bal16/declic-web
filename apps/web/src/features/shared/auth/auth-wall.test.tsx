import { describe, it, expect, mock } from 'bun:test';

import { render } from '@testing-library/react';
import React from 'react';

void mock.module('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => () => {},
}));

let mockGoogleId = '';
let mockGithubId = '';

void mock.module('@/lib/env', () => ({
  getGoogleClientId: () => mockGoogleId,
  getGithubClientId: () => mockGithubId,
}));

import { AuthWall } from './auth-wall';

describe('AuthWall Component Tests', () => {
  it('renders disabled banner and hides login link when both client IDs are empty', () => {
    mockGoogleId = '';
    mockGithubId = '';

    const { getByText, queryByRole, unmount } = render(
      <AuthWall open={true} onOpenChange={() => {}} />,
    );
    const banner = getByText(/Login saat ini dinonaktifkan/i);
    expect(banner).toBeDefined();

    const loginLink = queryByRole('button', { name: /Masuk/i });
    expect(loginLink).toBeNull();
    unmount();
  });

  it('renders login link and hides banner when at least one client ID is present', () => {
    mockGoogleId = 'some-google-client-id';
    mockGithubId = '';

    const { getByRole, queryByText, unmount } = render(
      <AuthWall open={true} onOpenChange={() => {}} />,
    );
    const loginLink = getByRole('button', { name: /Masuk/i });
    expect(loginLink).toBeDefined();

    const banner = queryByText(/Login saat ini dinonaktifkan/i);
    expect(banner).toBeNull();
    unmount();
  });
});
