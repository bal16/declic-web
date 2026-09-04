import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

// End-to-end: serves the production Nitro build (.output/server) on an
// ephemeral port and fetches the skeleton home page over real HTTP.
// Requires `bun run build` first (CI builds before testing).
// Run: bun run test:e2e
describe('Web e2e', () => {
  const PORT = '3213';
  let server: ReturnType<typeof Bun.spawn> | undefined;

  async function waitForReady(tries = 50): Promise<void> {
    for (let i = 0; i < tries; i += 1) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/`);
        if (res.status === 200) return;
      } catch {
        // not listening yet
      }
      await Bun.sleep(200);
    }
    throw new Error('prod server never became ready');
  }

  beforeAll(async () => {
    server = Bun.spawn(['bun', '.output/server/index.mjs'], {
      env: { ...process.env, PORT, HOST: '127.0.0.1' },
      stdout: 'ignore',
      stderr: 'ignore',
    });
    await waitForReady();
  });

  afterAll(() => {
    server?.kill();
  });

  it('GET / serves the skeleton home page', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Dclic');
  });

  it('unknown routes 404', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/no-such-page`);
    expect(res.status).toBe(404);
  });
});
