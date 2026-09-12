import { describe, expect, it } from 'bun:test';

import { ImageTransformerService } from './image-transformer.service';
import { IMAGE_PROCESSING_VARIANTS } from './variants';

async function fixtureBytes(name: string): Promise<Uint8Array> {
  // Cwd-relative: tests always run from the package dir (package scripts,
  // root --filter sets cwd per package).
  const file = Bun.file(`test/fixtures/${name}`);
  return new Uint8Array(await file.arrayBuffer());
}

function isWebp(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.slice(0, 4));
  const fmt = new TextDecoder().decode(bytes.slice(8, 12));
  return head === 'RIFF' && fmt === 'WEBP';
}

describe('ImageTransformerService', () => {
  it('scales landscape keeping aspect per variant', async () => {
    const svc = new ImageTransformerService();
    const input = await fixtureBytes('red-64x48.png');
    const expected: Array<[number, number]> = [
      [400, 300],
      [1200, 900],
      [2048, 1536],
    ];
    for (const [i, spec] of IMAGE_PROCESSING_VARIANTS.entries()) {
      const out = await svc.transform(input, spec);
      expect([out.width, out.height]).toEqual(expected[i]);
      expect(isWebp(out.bytes)).toBe(true);
    }
  });

  it('scales portrait keeping aspect', async () => {
    const svc = new ImageTransformerService();
    const input = await fixtureBytes('blue-48x64.png');
    const out = await svc.transform(input, IMAGE_PROCESSING_VARIANTS[0]);
    expect([out.width, out.height]).toEqual([300, 400]);
    expect(isWebp(out.bytes)).toBe(true);
  });
});
