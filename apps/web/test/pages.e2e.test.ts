import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { bootWebServer, stopWebServer } from './e2e/setup';
import { expectOkWithMarker } from './helpers/pages.dsl';

// Page smoke: every existing route opens (200 + marker). No data or
// integration exists yet, so dynamic params use dummies — placeholders
// ignore them. Auth pages pass via the compiled-in ADMIN stub; the
// redirect matrix stays manual until real auth lands. Unknown routes
// 404 (covered in home.e2e.test.ts).
const PAGES: Array<{ path: string; marker: string }> = [
  { path: '/', marker: 'Dclic' },
  { path: '/about', marker: '/about' },
  { path: '/archive', marker: '/archive' },
  { path: '/login', marker: '/login' },
  { path: '/exhibition/demo-slug', marker: '/exhibition/' },
  { path: '/post/demo123', marker: '/post/' },
  { path: '/og/demo123', marker: '/og/' },
  { path: '/dashboard', marker: 'Pengunjung' },
  { path: '/dashboard/upload', marker: '/_authed/dashboard/upload' },
  {
    path: '/dashboard/edit/demo123',
    marker: '/dashboard/edit',
  },
  { path: '/moderation', marker: '/moderation' },
  { path: '/curate', marker: '/curate' },
  { path: '/comments', marker: '/comments' },
  { path: '/exhibitions', marker: '/exhibitions' },
  { path: '/users', marker: '/users' },
  { path: '/settings', marker: '/settings' },
];

describe('Web pages e2e', () => {
  let server: ReturnType<typeof Bun.spawn> | undefined;

  beforeAll(async () => {
    server = await bootWebServer();
  });

  afterAll(() => {
    stopWebServer(server);
  });

  for (const { path, marker } of PAGES) {
    it(`GET ${path} opens`, async () => {
      await expectOkWithMarker(path, marker);
    });
  }

  it('lists every route file exactly once', () => {
    // Intentionally brittle: adding a page without its smoke row above
    // MUST fail here, forcing PAGES to stay in sync. Update both together.
    // Route files (excluding layouts/root): keep in sync with PAGES.
    expect(PAGES).toHaveLength(16);
  });
});
