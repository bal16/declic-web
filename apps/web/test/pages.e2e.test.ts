import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { bootWebServer, stopWebServer } from './e2e/setup';
import { expectOkWithMarker } from './helpers/pages.dsl';

// Page smoke: every existing route opens (200 + marker). Auth pages run
// against the real Better Auth client; the redirect matrix is enforced
// by beforeLoad guards. Unknown routes 404 (covered in home.e2e.test.ts).
const PAGES: Array<{ path: string; marker: string }> = [
  { path: '/', marker: 'Dclic' },
  { path: '/about', marker: '/about' },
  { path: '/archive', marker: '/archive' },
  { path: '/login', marker: 'Masuk ke Akun' },
  { path: '/exhibition/demo-slug', marker: '/exhibition/' },
  { path: '/post/demo123', marker: '/post/' },
  { path: '/og/demo123', marker: '/og/' },
  { path: '/dashboard', marker: 'Masuk ke Akun' },
  { path: '/dashboard/upload', marker: 'Masuk ke Akun' },
  {
    path: '/dashboard/edit/demo123',
    marker: 'Masuk ke Akun',
  },
  { path: '/moderation', marker: 'Masuk ke Akun' },
  { path: '/curate', marker: 'Masuk ke Akun' },
  { path: '/comments', marker: 'Masuk ke Akun' },
  { path: '/exhibitions', marker: 'Masuk ke Akun' },
  { path: '/users', marker: 'Masuk ke Akun' },
  { path: '/settings', marker: 'Masuk ke Akun' },
  { path: '/403', marker: 'Akses Ditolak' },
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
    expect(PAGES).toHaveLength(17);
  });
});
