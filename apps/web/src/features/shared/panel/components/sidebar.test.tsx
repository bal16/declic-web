import { mock } from 'bun:test';

// NOTE: assertions below reflect the CURRENT AppSidebar structure and
// sample content. The panel is migrating from hardcoded sample data to
// real data wiring — update selectors/copy here alongside, but keep the
// behavior contracts (brand/nav/user render from props).

// Nav items use TanStack useLocation (active state) + Link. Stub both;
// real navigation is covered by e2e.
mock.module('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/dashboard' }),
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { afterEach, describe, expect, it } from 'bun:test';

import { FileDocIcon } from '@phosphor-icons/react';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { SidebarProvider } from '@/components/ui/sidebar';

import {
  givenBrandName,
  givenNav,
  givenUser,
  givenUserMenuItems,
} from '../../../../../test/factories/panel.factory';
import { AppSidebar } from './sidebar';

function setup() {
  const nav = givenNav('ADMIN');
  render(
    <SidebarProvider>
      <AppSidebar
        user={givenUser()}
        brandName={givenBrandName()}
        navMain={nav.navMain}
        navSecondary={nav.navSecondary}
        documents={nav.documents}
        userMenuItems={givenUserMenuItems()}
      />
    </SidebarProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('AppSidebar', () => {
  it('renders brand, role nav, documents, and user', () => {
    setup();
    expect(screen.getByText('Uji Panel')).not.toBeNull();
    expect(
      screen.getByRole('link', { name: 'Dasbor' }).getAttribute('href'),
    ).toBe('/dashboard');
    expect(
      screen.getByRole('link', { name: 'Galeri' }).getAttribute('href'),
    ).toBe('/');
    expect(
      screen.getByRole('link', { name: 'Pengaturan' }).getAttribute('href'),
    ).toBe('/settings');
    expect(screen.getByText('Uji Pengguna')).not.toBeNull();
    expect(screen.getByText('uji@example.com')).not.toBeNull();
  });

  it('renders documents from props, not hardcoded content', () => {
    const nav = givenNav('ADMIN');
    render(
      <SidebarProvider>
        <AppSidebar
          user={givenUser()}
          brandName={givenBrandName()}
          navMain={nav.navMain}
          navSecondary={nav.navSecondary}
          documents={[{ name: 'Doc Uji', url: '/doc-uji', icon: FileDocIcon }]}
          userMenuItems={givenUserMenuItems()}
        />
      </SidebarProvider>,
    );
    expect(screen.getByText('Doc Uji')).not.toBeNull();
    expect(screen.queryByText('Data Library')).toBeNull();
  });
});
