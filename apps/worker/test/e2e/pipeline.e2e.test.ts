import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { photoDerivatives, photoItems, posts } from '@declic/db';
import { eq, inArray } from 'drizzle-orm';

import { BLUE_FIXTURE, RED_FIXTURE } from '../helpers/fixtures';
import {
  expectDerivatives,
  expectObjectExists,
  expectPostBecomes,
  givenWork,
  newTracker,
  whenEnqueueFrame,
  whenEnqueueMalformed,
} from '../helpers/pipeline.dsl';
import type { E2EContext } from './setup';
import { setupE2E, sweepKeys, teardownE2E, waitFor } from './setup';

// Full acceptance proof, real infra (CI services or docker compose up):
// upload → enqueue → worker consumes → derivatives + PENDING/FAILED.
// Run: bun run test:e2e
describe('Pipeline e2e', () => {
  let ctx: E2EContext;
  const tracker = newTracker();

  beforeAll(async () => {
    ctx = await setupE2E();
  });

  afterAll(async () => {
    await sweepKeys(ctx.s3, [...tracker.keys]);
    if (tracker.items.length > 0) {
      await ctx.db
        .delete(photoDerivatives)
        .where(inArray(photoDerivatives.photoItemId, tracker.items));
      await ctx.db
        .delete(photoItems)
        .where(inArray(photoItems.id, tracker.items));
    }
    for (const id of tracker.posts) {
      await ctx.db.delete(posts).where(eq(posts.id, id));
    }
    await teardownE2E(ctx);
  });

  it('T1 SINGLE: upload → derivatives + PENDING', async () => {
    const { postId, items } = await givenWork(ctx, tracker, [
      { key: `raw-uploads/it-${crypto.randomUUID()}.png`, file: RED_FIXTURE },
    ]);
    await whenEnqueueFrame(ctx, postId, items[0]);
    await expectPostBecomes(ctx, postId, 'PENDING', 30000, 'single promotion');
    for (const k of await expectDerivatives(ctx, tracker, items[0].id, 3)) {
      await expectObjectExists(ctx, k);
    }
  }, 60000);

  it('T2 SERIES-3: promotes after all three frames', async () => {
    const { postId, items } = await givenWork(
      ctx,
      tracker,
      [RED_FIXTURE, BLUE_FIXTURE, RED_FIXTURE].map((file, i) => ({
        key: `raw-uploads/it-${crypto.randomUUID()}-${i}.png`,
        file,
      })),
    );
    await Promise.all(items.map((item) => whenEnqueueFrame(ctx, postId, item)));
    await expectPostBecomes(ctx, postId, 'PENDING', 45000, 'series promotion');
    let total = 0;
    for (const item of items) {
      total += (await expectDerivatives(ctx, tracker, item.id, 3)).length;
    }
    expect(total).toBe(9);
  }, 60000);

  it('T3 poison: missing object → FAILED_PROCESSING', async () => {
    const { postId, items } = await givenWork(ctx, tracker, [
      { key: 'raw-uploads/it-missing.png', file: null },
    ]);
    await whenEnqueueFrame(ctx, postId, items[0]);
    await expectPostBecomes(
      ctx,
      postId,
      'FAILED_PROCESSING',
      30000,
      'terminal failure',
    );
    expect(await expectDerivatives(ctx, tracker, items[0].id, 0)).toEqual([]);
  }, 60000);

  it('T4 malformed payload fails without marking anything', async () => {
    const job = await whenEnqueueMalformed(ctx, { nope: true });
    const final = await waitFor(
      async () => {
        const j = await ctx.queue.getJob(job.id as string);
        const state = await j?.getState();
        return state === 'failed' ? state : null;
      },
      30000,
      'malformed failure',
    );
    expect(final).toBe('failed');
  }, 60000);
});
