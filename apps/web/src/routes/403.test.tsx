import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup } from '@testing-library/react';
import type { ComponentType } from 'react';

import { renderRouteComponent } from '../../test/render-route';
import { Route } from './403';

afterEach(() => {
  cleanup();
});

describe('403 route', () => {
  it('renders the forbidden copy and a home link', async () => {
    const Component = Route.options.component as ComponentType;
    const { findByText, findByRole } = await renderRouteComponent(
      Component,
      '/403',
    );
    expect(await findByText('Akses Ditolak')).not.toBeNull();
    expect(
      await findByText('Anda tidak memiliki akses ke halaman ini'),
    ).not.toBeNull();
    const home = await findByRole('link', { name: 'Kembali ke Beranda' });
    expect(home.getAttribute('href')).toBe('/');
  });
});
