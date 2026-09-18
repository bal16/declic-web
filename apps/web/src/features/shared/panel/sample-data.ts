/**
 * Sample content for the panel shell (sidebar/header/table/chart).
 *
 * TEMPORARY: used only to exemplify the reusable panel components in one
 * route until TanStack Query loaders (exhibitions/posts) land. Do not
 * import from production features — delete once real data is wired.
 */
import {
  CameraIcon,
  // ChartBarIcon,
  ChatCircleIcon,
  // ClipboardTextIcon,
  DatabaseIcon,
  // FileDocIcon,
  GearIcon,
  ImagesIcon,
  // MagnifyingGlassIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SquaresFourIcon,
  StackIcon,
  UserCircleIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import * as z from 'zod';

import type { ChartConfig } from '@/components/ui/chart';

import type { Role } from '../auth/session';
import type { ChartPoint } from './components/chart-area';
import { schema } from './components/data-table';
import type { PanelUser, UserMenuItem } from './components/nav-user';
import type { SidebarDocumentItem, SidebarNavItem } from './components/sidebar';

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export const sampleUser: PanelUser = {
  name: 'Rani Fotografer',
  email: 'rani@clic.unnes.ac.id',
  avatar: '/avatars/rani.jpg',
};

export const sampleBrandName = 'Déclic';

export const sampleNavMain: SidebarNavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: SquaresFourIcon },
];

export const sampleNavSecondary: SidebarNavItem[] = [
  { title: 'Galeri', url: '/', icon: CameraIcon },
  { title: 'Arsip', url: '/archive', icon: DatabaseIcon },
  { title: 'Settings', url: '/settings', icon: GearIcon },
  // { title: 'Search', url: '/archive', icon: MagnifyingGlassIcon },
];

export const sampleDocuments: SidebarDocumentItem[] = [
  // { name: 'Panduan Kurasi', url: '#', icon: FileDocIcon },
  // { name: 'Laporan', url: '#', icon: ClipboardTextIcon },
  // { name: 'Analitik', url: '#', icon: ChartBarIcon },
];

export interface PanelNav {
  navMain: SidebarNavItem[];
  navSecondary: SidebarNavItem[];
  documents: SidebarDocumentItem[];
}

/** Role-driven nav for the shared shell (ADR-009). */
export const navByRole: Record<Role, PanelNav> = {
  VIEWER: {
    navMain: [{ title: 'Dashboard', url: '/dashboard', icon: SquaresFourIcon }],
    navSecondary: [
      { title: 'Galeri', url: '/', icon: CameraIcon },
      { title: 'Arsip', url: '/archive', icon: DatabaseIcon },
      // { title: 'Search', url: '/archive', icon: MagnifyingGlassIcon },
    ],
    documents: [],
  },
  PHOTOGRAPHER: {
    navMain: [{ title: 'Dashboard', url: '/dashboard', icon: SquaresFourIcon }],
    navSecondary: [
      { title: 'Galeri', url: '/', icon: CameraIcon },
      { title: 'Arsip', url: '/archive', icon: DatabaseIcon },
      // { title: 'Search', url: '/archive', icon: MagnifyingGlassIcon },
    ],
    documents: [
      // { name: 'Panduan Kurasi', url: '#', icon: FileDocIcon }
    ],
  },
  CURATOR: {
    navMain: [
      { title: 'Moderation', url: '/moderation', icon: ShieldCheckIcon },
      { title: 'Kurasi', url: '/curate', icon: StackIcon },
      { title: 'Komentar', url: '/comments', icon: ChatCircleIcon },
    ],
    navSecondary: [
      // { title: 'Search', url: '/archive', icon: MagnifyingGlassIcon },
      { title: 'Galeri', url: '/', icon: CameraIcon },
      { title: 'Arsip', url: '/archive', icon: DatabaseIcon },
    ],
    documents: [
      // { name: 'Panduan Kurasi', url: '#', icon: FileDocIcon },
      // { name: 'Laporan', url: '#', icon: ClipboardTextIcon },
    ],
  },
  ADMIN: {
    navMain: [
      { title: 'Dashboard', url: '/dashboard', icon: SquaresFourIcon },
      { title: 'Moderation', url: '/moderation', icon: ShieldCheckIcon },
      { title: 'Kurasi', url: '/curate', icon: StackIcon },
      { title: 'Komentar', url: '/comments', icon: ChatCircleIcon },
      { title: 'Exhibitions', url: '/exhibitions', icon: ImagesIcon },
      { title: 'Users', url: '/users', icon: UsersIcon },
    ],
    navSecondary: [
      { title: 'Galeri', url: '/', icon: CameraIcon },
      { title: 'Arsip', url: '/archive', icon: DatabaseIcon },
      { title: 'Settings', url: '/settings', icon: GearIcon },
      // { title: 'Search', url: '/archive', icon: MagnifyingGlassIcon },
    ],
    documents: [
      // { name: 'Panduan Kurasi', url: '#', icon: FileDocIcon },
      // { name: 'Laporan', url: '#', icon: ClipboardTextIcon },
      // { name: 'Analitik', url: '#', icon: ChartBarIcon },
    ],
  },
};

export const sampleUserMenuItems: UserMenuItem[] = [
  // TODO(F4): attach real handlers (account page, sign-out) when wiring.
  { title: 'Account', icon: UserCircleIcon },
  { title: 'Log out', icon: SignOutIcon, destructive: true },
];

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
export const sampleHeaderTitle = 'Dashboard';

// ---------------------------------------------------------------------------
// ChartAreaInteractive({ data, config })
// ---------------------------------------------------------------------------
export const sampleChartData: ChartPoint[] = [
  { date: '2026-08-24', desktop: 122, mobile: 90 },
  { date: '2026-08-25', desktop: 187, mobile: 140 },
  { date: '2026-08-26', desktop: 165, mobile: 175 },
  { date: '2026-08-27', desktop: 242, mobile: 210 },
  { date: '2026-08-28', desktop: 198, mobile: 260 },
  { date: '2026-08-29', desktop: 273, mobile: 290 },
  { date: '2026-08-30', desktop: 301, mobile: 340 },
];

export const sampleChartConfig = {
  visitors: { label: 'Pengunjung' },
  desktop: { label: 'Desktop', color: 'var(--primary)' },
  mobile: { label: 'Mobile', color: 'var(--primary)' },
} satisfies ChartConfig;

// ---------------------------------------------------------------------------
// DataTable({ data }). Rows MUST satisfy `schema`.
// ---------------------------------------------------------------------------
export const sampleTableRows: z.infer<typeof schema>[] = [
  {
    id: 1,
    header: 'Pameran Dies Natalis',
    type: 'SERIES',
    status: 'Live',
    target: '100 karya',
    limit: '10/seri',
    reviewer: 'Kurator A',
  },
  {
    id: 2,
    header: 'Lomba Foto Alam',
    type: 'SINGLE',
    status: 'Review',
    target: '50 karya',
    limit: '1/orang',
    reviewer: 'Kurator B',
  },
  {
    id: 3,
    header: 'Arsip 2025',
    type: 'SERIES',
    status: 'Archived',
    target: '200 karya',
    limit: '-',
    reviewer: 'Admin',
  },
];
