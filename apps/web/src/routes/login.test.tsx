import { mock } from 'bun:test';

let session: { user: { role: string } } | null = null;
let offline = false;

void mock.module('@/lib/env', () => ({
  getApiUrl: () => 'http://localhost:3001',
  getBetterAuthUrl: () => 'http://localhost:3001',
  getGoogleClientId: () => '',
  getGithubClientId: () => '',
}));

void mock.module('@/features/shared/auth/client', () => ({
  authClient: {
    getSession: () => {
      if (offline) return Promise.reject(new Error('offline'));
      return Promise.resolve(
        session === null ? { data: null } : { data: session },
      );
    },
    useSession: () => ({ data: session, isPending: false }),
    signIn: { social: () => Promise.resolve() },
  },
}));

import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';

import { Route } from './login';

afterEach(() => {
  cleanup();
  session = null;
  offline = false;
});

describe('login route', () => {
  it('renders the login form', () => {
    const Component = Route.options.component as ComponentType;
    const { getByText } = render(<Component />);
    expect(getByText(/dinonaktifkan/i)).not.toBeNull();
  });

  it('beforeLoad redirects when already signed in', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    session = { user: { role: 'VIEWER' } };
    return expect(beforeLoad()).rejects.toBeInstanceOf(Response);
  });

  it('beforeLoad renders login when anonymous', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    session = null;
    return expect(beforeLoad()).resolves.toBeUndefined();
  });

  it('beforeLoad renders login when offline', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    offline = true;
    return expect(beforeLoad()).resolves.toBeUndefined();
  });
});
