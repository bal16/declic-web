/**
 * Fixture factories for panel component tests (worker-style `given*`
 * with overrides). Defaults are minimal and inline — deliberately
 * independent from `sample-data.ts` so demo-copy edits never break
 * behavior tests. Shape drift is guarded by the schema-conformance
 * test in `sample-data.test.ts`, not by sharing literals.
 */
import {
  CameraIcon,
  FileDocIcon,
  GearIcon,
  SignOutIcon,
  SquaresFourIcon,
  UserCircleIcon,
} from '@phosphor-icons/react';

import type { ChartConfig } from '@/components/ui/chart';

import type { Role } from '../../src/features/shared/auth/session';
import type { ChartPoint } from '../../src/features/shared/panel/components/chart-area';
import type { TableRow } from '../../src/features/shared/panel/components/data-table/table-schema';
import type {
  PanelUser,
  UserMenuItem,
} from '../../src/features/shared/panel/components/nav-user';
import type {
  SidebarDocumentItem,
  SidebarNavItem,
} from '../../src/features/shared/panel/components/sidebar';

export function givenUser(overrides?: Partial<PanelUser>): PanelUser {
  return {
    name: 'Uji Pengguna',
    email: 'uji@example.com',
    avatar: '/avatars/uji.jpg',
    ...overrides,
  };
}

export function givenNav(role: Role = 'ADMIN'): {
  navMain: SidebarNavItem[];
  navSecondary: SidebarNavItem[];
  documents: SidebarDocumentItem[];
} {
  const dashboard = {
    title: 'Dasbor',
    url: '/dashboard',
    icon: SquaresFourIcon,
  };
  const gallery = { title: 'Galeri', url: '/', icon: CameraIcon };
  const settings = { title: 'Pengaturan', url: '/settings', icon: GearIcon };
  const guide = { name: 'Panduan', url: '#', icon: FileDocIcon };
  switch (role) {
    case 'ADMIN':
      return {
        navMain: [dashboard, gallery],
        navSecondary: [settings],
        documents: [guide],
      };
    case 'CURATOR':
    case 'PHOTOGRAPHER':
      return { navMain: [dashboard, gallery], navSecondary: [], documents: [] };
    case 'VIEWER':
      return { navMain: [gallery], navSecondary: [], documents: [] };
  }
}

export function givenUserMenuItems(
  overrides?: Partial<UserMenuItem>,
): UserMenuItem[] {
  return [
    { title: 'Akun', icon: UserCircleIcon, ...overrides },
    { title: 'Keluar', icon: SignOutIcon, destructive: true, ...overrides },
  ];
}

export function givenBrandName(): string {
  return 'Uji Panel';
}

export function givenTableRow(overrides?: Partial<TableRow>): TableRow {
  return {
    id: 1,
    header: 'Alpha',
    type: 'SINGLE',
    status: 'Live',
    target: '-',
    limit: '-',
    reviewer: '-',
    ...overrides,
  };
}

export function givenTableRows(): TableRow[] {
  return [givenTableRow(), givenTableRow({ id: 2, header: 'Beta' })];
}

export function givenChart(): { data: ChartPoint[]; config: ChartConfig } {
  return {
    data: [
      { date: '2026-01-01', desktop: 10, mobile: 5 },
      { date: '2026-01-02', desktop: 20, mobile: 15 },
    ],
    config: {
      visitors: { label: 'Pengunjung' },
      desktop: { label: 'Desktop', color: 'var(--primary)' },
      mobile: { label: 'Mobile', color: 'var(--primary)' },
    },
  };
}
