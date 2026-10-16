import { mock } from 'bun:test';

let sessionRole: string | null = 'CURATOR';

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

import { cleanup } from '@testing-library/react';
import type { ComponentType } from 'react';

import { renderRouteComponent } from '../../../test/render-route';
import { Route } from './_admin';

afterEach(() => {
  cleanup();
  sessionRole = 'CURATOR';
});

describe('admin layout route', () => {
  it('renders the outlet', async () => {
    const Component = Route.options.component as ComponentType;
    const { container } = await renderRouteComponent(Component, '/');
    expect(container).not.toBeNull();
  });

  it('beforeLoad resolves for staff', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    sessionRole = 'CURATOR';
    return expect(beforeLoad()).resolves.toEqual({ role: 'CURATOR' });
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
