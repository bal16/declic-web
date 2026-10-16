import { mock } from 'bun:test';

let sessionRole: string | null = 'PHOTOGRAPHER';

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

import { Route } from './index';

afterEach(() => {
  cleanup();
  sessionRole = 'PHOTOGRAPHER';
});

describe('dashboard route', () => {
  it('renders the sample chart and table', () => {
    const Component = Route.options.component as ComponentType;
    const { getByText } = render(<Component />);
    expect(getByText('Pengunjung')).not.toBeNull();
  });

  it('beforeLoad resolves for photographers', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    sessionRole = 'PHOTOGRAPHER';
    return expect(beforeLoad()).resolves.toEqual({ role: 'PHOTOGRAPHER' });
  });

  it('beforeLoad redirects the wrong role', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    sessionRole = 'VIEWER';
    return expect(beforeLoad()).rejects.toBeInstanceOf(Response);
  });

  it('beforeLoad redirects anonymous', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    sessionRole = null;
    return expect(beforeLoad()).rejects.toBeInstanceOf(Response);
  });
});
