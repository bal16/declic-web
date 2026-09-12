import { describe, expect, it } from 'bun:test';

import { BlurhashService } from './blurhash.service';

async function fixtureBytes(name: string): Promise<Uint8Array> {
  // Cwd-relative: tests always run from the package dir (package scripts,
  // root --filter sets cwd per package).
  const file = Bun.file(`test/fixtures/${name}`);
  return new Uint8Array(await file.arrayBuffer());
}

describe('BlurhashService', () => {
  it('encodes a non-empty 4x3 hash', async () => {
    const hash = await new BlurhashService().encode(
      await fixtureBytes('red-64x48.png'),
    );
    expect(hash.length).toBe(28);
  });

  it('is deterministic for the same input', async () => {
    const svc = new BlurhashService();
    const bytes = await fixtureBytes('red-64x48.png');
    expect(await svc.encode(bytes)).toBe(await svc.encode(bytes));
  });

  it('distinguishes different images', async () => {
    const svc = new BlurhashService();
    const red = await svc.encode(await fixtureBytes('red-64x48.png'));
    const blue = await svc.encode(await fixtureBytes('blue-48x64.png'));
    expect(red).not.toBe(blue);
  });
});
