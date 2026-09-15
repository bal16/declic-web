import { describe, expect, it } from 'bun:test';

import {
  BLUE_FIXTURE,
  RED_FIXTURE,
  fixtureBytes,
} from '../../test/helpers/fixtures';
import { BlurhashService } from './blurhash.service';

describe('BlurhashService', () => {
  it('encodes a non-empty 4x3 hash', async () => {
    const hash = await new BlurhashService().encode(
      await fixtureBytes(RED_FIXTURE),
    );
    expect(hash.length).toBe(28);
  });

  it('is deterministic for the same input', async () => {
    const svc = new BlurhashService();
    const bytes = await fixtureBytes(RED_FIXTURE);
    expect(await svc.encode(bytes)).toBe(await svc.encode(bytes));
  });

  it('distinguishes different images', async () => {
    const svc = new BlurhashService();
    const red = await svc.encode(await fixtureBytes(RED_FIXTURE));
    const blue = await svc.encode(await fixtureBytes(BLUE_FIXTURE));
    expect(red).not.toBe(blue);
  });
});
