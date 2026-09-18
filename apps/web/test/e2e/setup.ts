import { GlobalRegistrator } from '@happy-dom/global-registrator';

// The unit-test preload (bunfig `[test]`) registers a happy-dom DOM whose
// fetch enforces CORS. E2E needs real network access, so undo it here —
// once, for every test file under test/ (importing this module runs it).
await GlobalRegistrator.unregister();

export const E2E_PORT = '3213';
export const E2E_HOST = '127.0.0.1';

export function baseUrl(): string {
  return `http://${E2E_HOST}:${E2E_PORT}`;
}

async function waitForReady(tries = 50): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(`${baseUrl()}/`);
      if (res.status === 200) return;
    } catch {
      // not listening yet
    }
    await Bun.sleep(200);
  }
  throw new Error('prod server never became ready');
}

// Boots the production Nitro build (.output/server). Requires
// `bun run build` first. One server per test file (bun runs files
// sequentially); ports stay fixed, no cross-file sharing.
export async function bootWebServer(): Promise<ReturnType<typeof Bun.spawn>> {
  const server = Bun.spawn(['bun', '.output/server/index.mjs'], {
    env: { ...process.env, PORT: E2E_PORT, HOST: E2E_HOST },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  await waitForReady();
  return server;
}

export function stopWebServer(
  server: ReturnType<typeof Bun.spawn> | undefined,
): void {
  server?.kill();
}
