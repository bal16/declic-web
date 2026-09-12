import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import type { Db } from '@declic/db';
import { photoDerivatives, photoItems, posts } from '@declic/db';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { FrameRepository } from './frame.repository';

// Repository against in-memory PGlite (real PG engine, no TCP/compose):
// real migration + real SQL, CI-safe. S3 I/O stays in the (postponed)
// compose-backed integration tier.
describe('FrameRepository (pglite)', () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzlePglite>;
  let repo: FrameRepository;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzlePglite({ client });
    // Cwd-relative: tests run from the package dir.
    await migrate(db, { migrationsFolder: '../../packages/db/drizzle' });
    repo = new FrameRepository(db as unknown as Db);
  });

  afterAll(async () => {
    await client.close();
  });

  async function seedProcessingPost(id: string): Promise<void> {
    await db.insert(posts).values({
      id,
      exhibitionId: 'test-ex',
      photographerId: 'test-user',
      title: 'test',
      type: 'SINGLE',
      status: 'PROCESSING',
    });
  }

  it('markFrameReady stores blurhash + derivatives', async () => {
    await seedProcessingPost('ready-post');
    await db.insert(photoItems).values({
      id: 'ready-item',
      postId: 'ready-post',
      itemOrder: 0,
      originalS3Key: 'raw-uploads/ready.jpg',
    });
    await repo.markFrameReady({
      photoItemId: 'ready-item',
      blurhash: 'LEHV6nWB2yk8pyo0adR*',
      derivatives: [
        {
          variant: 'web',
          s3Key: 'derivatives/ready-item/web.webp',
          url: 'http://x/web.webp',
          width: 1200,
          height: 900,
          sizeBytes: 10,
        },
      ],
    });
    const items = await db
      .select({ blurhash: photoItems.blurhash })
      .from(photoItems)
      .where(eq(photoItems.id, 'ready-item'));
    expect(items[0].blurhash).toBe('LEHV6nWB2yk8pyo0adR*');
    const derivs = await db
      .select()
      .from(photoDerivatives)
      .where(eq(photoDerivatives.photoItemId, 'ready-item'));
    expect(derivs).toHaveLength(1);
    expect(derivs[0].variant).toBe('web');
  });

  it('promotes when all frames are ready', async () => {
    expect(await repo.tryPromoteToPending('ready-post')).toBe(true);
    const rows = await db
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, 'ready-post'));
    expect(rows[0].status).toBe('PENDING');
  });

  it('skips promotion while a frame is still processing', async () => {
    await seedProcessingPost('pending-post');
    await db.insert(photoItems).values({
      id: 'pending-item',
      postId: 'pending-post',
      itemOrder: 0,
      originalS3Key: 'raw-uploads/pending.jpg',
    });
    expect(await repo.tryPromoteToPending('pending-post')).toBe(false);
    const rows = await db
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, 'pending-post'));
    expect(rows[0].status).toBe('PROCESSING');
  });

  it('marks terminal failure', async () => {
    await repo.markPostFailed('pending-post');
    const rows = await db
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, 'pending-post'));
    expect(rows[0].status).toBe('FAILED_PROCESSING');
  });
});
