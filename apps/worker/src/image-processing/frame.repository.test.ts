import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { photoDerivatives, photoItems, posts } from '@declic/db';
import { eq } from 'drizzle-orm';

import {
  givenPhotoItem,
  givenProcessingPost,
  givenReadyFrame,
} from '../../test/factories/post.factory';
import { newTestDb } from '../../test/helpers/db';

// Repository against in-memory PGlite (real PG engine, no TCP/compose):
// real migration + real SQL, CI-safe. S3 I/O stays in the compose-backed
// e2e tier (test/e2e/pipeline.e2e.test.ts).
describe('FrameRepository (pglite)', () => {
  let client: Awaited<ReturnType<typeof newTestDb>>['client'];
  let db: Awaited<ReturnType<typeof newTestDb>>['db'];
  let repo: Awaited<ReturnType<typeof newTestDb>>['repo'];

  beforeAll(async () => {
    const ctx = await newTestDb();
    client = ctx.client;
    db = ctx.db;
    repo = ctx.repo;
  });

  afterAll(async () => {
    await client.close();
  });

  it('markFrameReady stores blurhash + derivatives', async () => {
    const postId = await givenProcessingPost(db);
    const itemId = await givenPhotoItem(db, postId);
    await givenReadyFrame(repo, itemId);

    const items = await db
      .select({ blurhash: photoItems.blurhash })
      .from(photoItems)
      .where(eq(photoItems.id, itemId));
    expect(items[0].blurhash).toBe('LEHV6nWB2yk8pyo0adR*');

    const derivs = await db
      .select()
      .from(photoDerivatives)
      .where(eq(photoDerivatives.photoItemId, itemId));
    expect(derivs).toHaveLength(1);
    expect(derivs[0].variant).toBe('web');
  });

  it('promotes when all frames are ready', async () => {
    const postId = await givenProcessingPost(db);
    const itemId = await givenPhotoItem(db, postId);
    await givenReadyFrame(repo, itemId);

    expect(await repo.tryPromoteToPending(postId)).toBe(true);
    const rows = await db
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, postId));
    expect(rows[0].status).toBe('PENDING');
  });

  it('skips promotion while a frame is still processing', async () => {
    const postId = await givenProcessingPost(db);
    await givenPhotoItem(db, postId);

    expect(await repo.tryPromoteToPending(postId)).toBe(false);
    const rows = await db
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, postId));
    expect(rows[0].status).toBe('PROCESSING');
  });

  it('marks terminal failure', async () => {
    const postId = await givenProcessingPost(db);
    await givenPhotoItem(db, postId);

    await repo.markPostFailed(postId);
    const rows = await db
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, postId));
    expect(rows[0].status).toBe('FAILED_PROCESSING');
  });
});
