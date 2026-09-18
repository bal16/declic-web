import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { bootWebServer, stopWebServer } from './e2e/setup';
import { fetchPage } from './helpers/pages.dsl';

// End-to-end: serves the production Nitro build (.output/server) on an
// ephemeral port and fetches the skeleton home page over real HTTP.
// Requires `bun run build` first (CI builds before testing).
// Run: bun run test:e2e
describe('Web e2e', () => {
  let server: ReturnType<typeof Bun.spawn> | undefined;

  beforeAll(async () => {
    server = await bootWebServer();
  });

  afterAll(() => {
    stopWebServer(server);
  });

  it('GET / serves the skeleton home page', async () => {
    const res = await fetchPage('/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Dclic');
  });

  it('unknown routes 404', async () => {
    const res = await fetchPage('/no-such-page');
    expect(res.status).toBe(404);
  });
});
