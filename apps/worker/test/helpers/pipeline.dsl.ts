import { photoDerivatives, photoItems, posts } from '@declic/db';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { IMAGE_JOB_OPTIONS } from '@/common/job-options';

import type { E2EContext } from '../e2e/setup';
import { waitFor } from '../e2e/setup';
import { fixtureBytes } from './fixtures';

export interface Tracker {
  keys: Set<string>;
  posts: string[];
  items: string[];
}

export function newTracker(): Tracker {
  return { keys: new Set(), posts: [], items: [] };
}

export async function givenWork(
  ctx: E2EContext,
  tracker: Tracker,
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
  tracker.posts.push(postId);
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
      tracker.keys.add(frame.key);
    }
    tracker.items.push(id);
    items.push({ id, s3Key: frame.key });
  }
  return { postId, items };
}

export async function whenEnqueueFrame(
  ctx: E2EContext,
  postId: string,
  item: { id: string; s3Key: string },
): Promise<void> {
  await ctx.queue.add(
    'process',
    { postId, photoItemId: item.id, s3Key: item.s3Key },
    IMAGE_JOB_OPTIONS,
  );
}

export async function whenEnqueueMalformed(ctx: E2EContext, payload: unknown) {
  return ctx.queue.add('process', payload, {
    attempts: 1,
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

async function postStatus(
  ctx: E2EContext,
  postId: string,
): Promise<string | null> {
  const rows = await ctx.db
    .select({ status: posts.status })
    .from(posts)
    .where(eq(posts.id, postId));
  return rows.length > 0 ? rows[0].status : null;
}

async function derivativeKeys(
  ctx: E2EContext,
  tracker: Tracker,
  itemId: string,
): Promise<string[]> {
  const rows = await ctx.db
    .select({ s3Key: photoDerivatives.s3Key })
    .from(photoDerivatives)
    .where(eq(photoDerivatives.photoItemId, itemId));
  for (const row of rows) tracker.keys.add(row.s3Key);
  return rows.map((row) => row.s3Key);
}

export async function expectPostBecomes(
  ctx: E2EContext,
  postId: string,
  status: string,
  timeoutMs: number,
  label: string,
): Promise<string> {
  return waitFor(
    async () => {
      const current = await postStatus(ctx, postId);
      return current === status ? current : null;
    },
    timeoutMs,
    label,
  );
}

export async function expectDerivatives(
  ctx: E2EContext,
  tracker: Tracker,
  itemId: string,
  expectedCount: number,
): Promise<string[]> {
  return waitFor(
    async () => {
      const keys = await derivativeKeys(ctx, tracker, itemId);
      return keys.length === expectedCount ? keys : null;
    },
    30000,
    `${expectedCount} derivatives`,
  );
}

export async function expectObjectExists(
  ctx: E2EContext,
  key: string,
): Promise<void> {
  const exists = await ctx.s3.file(key).exists();
  if (!exists) throw new Error(`Object not found: ${key}`);
}
