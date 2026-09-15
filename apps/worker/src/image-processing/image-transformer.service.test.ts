import { describe, expect, it } from 'bun:test';

import {
  BLUE_FIXTURE,
  RED_FIXTURE,
  fixtureBytes,
} from '../../test/helpers/fixtures';
import { ImageTransformerService } from './image-transformer.service';
import { IMAGE_PROCESSING_VARIANTS } from './variants';

function isWebp(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.slice(0, 4));
  const fmt = new TextDecoder().decode(bytes.slice(8, 12));
  return head === 'RIFF' && fmt === 'WEBP';
}

describe('ImageTransformerService', () => {
  it('scales landscape keeping aspect per variant', async () => {
    const svc = new ImageTransformerService();
    const input = await fixtureBytes(RED_FIXTURE);
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
    const input = await fixtureBytes(BLUE_FIXTURE);
    const out = await svc.transform(input, IMAGE_PROCESSING_VARIANTS[0]);
    expect([out.width, out.height]).toEqual([300, 400]);
    expect(isWebp(out.bytes)).toBe(true);
  });
});
