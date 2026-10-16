import { mock } from 'bun:test';

void mock.module('@/features/shared/auth/client', () => ({
  authClient: {
    useSession: () => ({
      data: { user: { role: 'ADMIN' } },
      isPending: false,
    }),
    getSession: () => Promise.resolve({ data: { user: { role: 'ADMIN' } } }),
  },
}));

import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup } from '@testing-library/react';
import type { ComponentType } from 'react';

import { sampleBrandName } from '@/features/shared/panel/sample-data';

import { renderRouteComponent } from '../../test/render-route';
import { Route } from './_authed';

afterEach(() => {
  cleanup();
});

describe('authed layout route', () => {
  it('renders the panel shell with the brand fallback title', async () => {
    const Component = Route.options.component as ComponentType;
    const { findAllByText } = await renderRouteComponent(Component, '/');
    expect(await findAllByText(sampleBrandName)).toHaveLength(2);
  });

  it('beforeLoad resolves for a signed-in session', () => {
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>;
    return expect(beforeLoad()).resolves.toEqual({ role: 'ADMIN' });
  });
});
