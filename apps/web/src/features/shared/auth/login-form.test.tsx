import { mock } from 'bun:test';

let mockGoogleId = '';
let mockGithubId = '';
const socialCalls: Array<{ provider: string; callbackURL: string }> = [];

void mock.module('@/lib/env', () => ({
  getApiUrl: () => 'http://localhost:3001',
  getBetterAuthUrl: () => 'http://localhost:3001',
  getGoogleClientId: () => mockGoogleId,
  getGithubClientId: () => mockGithubId,
}));

void mock.module('./client', () => ({
  authClient: {
    signIn: {
      social: (args: { provider: string; callbackURL: string }) => {
        socialCalls.push(args);
        return Promise.resolve();
      },
    },
  },
}));

import { beforeEach, describe, expect, it } from 'bun:test';

import { fireEvent, render } from '@testing-library/react';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  beforeEach(() => {
    socialCalls.length = 0;
  });
  it('renders enabled provider buttons when client IDs are present', () => {
    mockGoogleId = 'some-google-client-id';
    mockGithubId = 'some-github-client-id';

    const { getByRole, queryByText, unmount } = render(<LoginForm />);
    try {
      const google = getByRole('button', { name: /Google/i });
      const github = getByRole('button', { name: /GitHub/i });
      expect(google).toBeDefined();
      expect(github).toBeDefined();
      expect(
        (google as HTMLButtonElement).disabled ||
          (github as HTMLButtonElement).disabled,
      ).toBe(false);
      expect(queryByText(/dinonaktifkan/i)).toBeNull();

      fireEvent.click(google);
      fireEvent.click(github);
      expect(socialCalls).toEqual([
        { provider: 'google', callbackURL: '/' },
        { provider: 'github', callbackURL: '/' },
      ]);
    } finally {
      unmount();
    }
  });

  it('renders disabled buttons and the banner when client IDs are empty', () => {
    mockGoogleId = '';
    mockGithubId = '';

    const { getByRole, getByText, unmount } = render(<LoginForm />);
    try {
      const google = getByRole('button', {
        name: /Google/i,
      }) as HTMLButtonElement;
      const github = getByRole('button', {
        name: /GitHub/i,
      }) as HTMLButtonElement;
      expect(google.disabled).toBe(true);
      expect(github.disabled).toBe(true);
      expect(google.title).not.toBe('');
      expect(github.title).not.toBe('');
      expect(getByText(/dinonaktifkan/i)).toBeDefined();
    } finally {
      unmount();
    }
  });
});
