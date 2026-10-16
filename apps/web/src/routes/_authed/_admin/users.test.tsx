import { mock } from 'bun:test';

let sessionRole: string | null = 'ADMIN';

void mock.module('@/features/shared/auth/client', () => ({
  authClient: {
    getSession: () =>
      Promise.resolve(
        sessionRole === null
          ? { data: null }
          : { data: { user: { role: sessionRole } } },
      ),
  },
}));

import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';

import { Route } from './users';

afterEach(() => {
  cleanup();
  sessionRole = 'ADMIN';
});

describe('admin users route', () => {
  it('renders the placeholder', () => {
    const Component = Route.options.component as ComponentType;
    const { getByText } = render(<Component />);
    expect(getByText('Hello "/_admin/users"!')).not.toBeNull();
  });

  it('beforeLoad resolves for admin', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    sessionRole = 'ADMIN';
    return expect(beforeLoad()).resolves.toEqual({ role: 'ADMIN' });
  });

  it('beforeLoad redirects anonymous', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    sessionRole = null;
    return expect(beforeLoad()).rejects.toBeInstanceOf(Response);
  });
});
