import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { photoDerivatives, photoItems, posts } from '@declic/db';
import { createId } from '@paralleldrive/cuid2';
import { eq, inArray } from 'drizzle-orm';

import { IMAGE_JOB_OPTIONS } from '@/common/job-options';

import type { IntegrationContext } from './setup';
import {
  setupIntegration,
  sweepKeys,
  teardownIntegration,
  waitFor,
} from './setup';

// Full acceptance proof, real infra (compose up required, never CI):
// upload → enqueue → worker consumes → derivatives + PENDING/FAILED.
describe('Pipeline integration', () => {
  let ctx: IntegrationContext;
  const createdKeys = new Set<string>();
  const createdPosts: string[] = [];
  const createdItems: string[] = [];

  beforeAll(async () => {
    ctx = await setupIntegration();
  });

  afterAll(async () => {
    await sweepKeys(ctx.s3, [...createdKeys]);
    // Leaf-first: schema declares no ON DELETE CASCADE (soft-delete via
    // deleted_at is the prod retraction path), so hard deletes order
    // derivatives → items → posts.
    if (createdItems.length > 0) {
      await ctx.db
        .delete(photoDerivatives)
        .where(inArray(photoDerivatives.photoItemId, createdItems));
      await ctx.db
        .delete(photoItems)
        .where(inArray(photoItems.id, createdItems));
    }
    for (const id of createdPosts) {
      await ctx.db.delete(posts).where(eq(posts.id, id));
    }
    await teardownIntegration(ctx);
  });

  async function fixtureBytes(name: string): Promise<Uint8Array> {
    const file = Bun.file(`test/fixtures/${name}`);
    return new Uint8Array(await file.arrayBuffer());
  }

  async function seedWork(
    frames: Array<{ key: string; file: string | null }>,
  ): Promise<{
    postId: string;
    items: Array<{ id: string; s3Key: string }>;
  }> {
    const postId = `it-${createId()}`;
    await ctx.db.insert(posts).values({
      id: postId,
      exhibitionId: 'it-ex',
      photographerId: 'it-user',
      title: 'integration',
      type: frames.length > 1 ? 'SERIES' : 'SINGLE',
      status: 'PROCESSING',
    });
    createdPosts.push(postId);
    const items = [];
    for (const [i, frame] of frames.entries()) {
      const id = `it-${createId()}`;
      await ctx.db.insert(photoItems).values({
        id,
        postId,
        itemOrder: i,
        originalS3Key: frame.key,
      });
      if (frame.file !== null) {
        await ctx.s3.write(frame.key, await fixtureBytes(frame.file), {
          type: 'image/png',
        });
        createdKeys.add(frame.key);
      }
      createdItems.push(id);
      items.push({ id, s3Key: frame.key });
    }
    return { postId, items };
  }

  async function postStatus(postId: string): Promise<string | null> {
    const rows = await ctx.db
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, postId));
    return rows.length > 0 ? rows[0].status : null;
  }

  async function derivativeKeys(itemId: string): Promise<string[]> {
    const rows = await ctx.db
      .select({ s3Key: photoDerivatives.s3Key })
      .from(photoDerivatives)
      .where(eq(photoDerivatives.photoItemId, itemId));
    for (const row of rows) createdKeys.add(row.s3Key);
    return rows.map((row) => row.s3Key);
  }

  it('T1 SINGLE: upload → derivatives + PENDING', async () => {
    const key = `raw-uploads/it-${createId()}.png`;
    const { postId, items } = await seedWork([{ key, file: 'red-64x48.png' }]);
    await ctx.queue.add(
      'process',
      { postId, photoItemId: items[0].id, s3Key: key },
      IMAGE_JOB_OPTIONS,
    );
    const final = await waitFor(
      async () => {
        const status = await postStatus(postId);
        if (status !== 'PENDING') return null;
        const keys = await derivativeKeys(items[0].id);
        return keys.length === 3 ? status : null;
      },
      30000,
      'single promotion',
    );
    expect(final).toBe('PENDING');
    for (const key of await derivativeKeys(items[0].id)) {
      expect(await ctx.s3.file(key).exists()).toBe(true);
    }
  }, 60000);

  it('T2 SERIES-3: promotes after all three frames', async () => {
    const files = ['red-64x48.png', 'blue-48x64.png', 'red-64x48.png'];
    const { postId, items } = await seedWork(
      files.map((file, i) => ({
        key: `raw-uploads/it-${createId()}-${i}.png`,
        file,
      })),
    );
    await Promise.all(
      items.map((item) =>
        ctx.queue.add(
          'process',
          { postId, photoItemId: item.id, s3Key: item.s3Key },
          IMAGE_JOB_OPTIONS,
        ),
      ),
    );
    const final = await waitFor(
      async () => {
        if ((await postStatus(postId)) !== 'PENDING') return null;
        let total = 0;
        for (const item of items) {
          total += (await derivativeKeys(item.id)).length;
        }
        return total === 9 ? 'PENDING' : null;
      },
      45000,
      'series promotion',
    );
    expect(final).toBe('PENDING');
  }, 60000);

  it('T3 poison: missing object → FAILED_PROCESSING', async () => {
    const { postId, items } = await seedWork([
      { key: 'raw-uploads/it-missing.png', file: null },
    ]);
    await ctx.queue.add(
      'process',
      { postId, photoItemId: items[0].id, s3Key: 'raw-uploads/it-missing.png' },
      { attempts: 1, removeOnComplete: 1000, removeOnFail: 5000 },
    );
    const final = await waitFor(
      async () => {
        const status = await postStatus(postId);
        return status === 'FAILED_PROCESSING' ? status : null;
      },
      30000,
      'terminal failure',
    );
    expect(final).toBe('FAILED_PROCESSING');
    expect(await derivativeKeys(items[0].id)).toEqual([]);
  }, 60000);

  it('T4 malformed payload fails without marking anything', async () => {
    const job = await ctx.queue.add(
      'process',
      { nope: true },
      { attempts: 1, removeOnComplete: 1000, removeOnFail: 5000 },
    );
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
