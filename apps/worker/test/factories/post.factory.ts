import { photoItems, posts, exhibitions } from '@declic/db';
import { createId } from '@paralleldrive/cuid2';

import type { FrameRepository } from '@/image-processing/frame.repository';

import type { PgTestDb } from '../helpers/db';

export async function givenProcessingPost(
  db: PgTestDb,
  overrides?: { id?: string },
): Promise<string> {
  const exhibitionId = createId();
  await db.insert(exhibitions).values({
    id: exhibitionId,
    title: 'Test Exhibition',
    slug: `test-${exhibitionId}`,
    phase: 'LIVE',
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000),
    createdBy: 'test-user',
  });

  const postId = overrides?.id ?? `test-${createId()}`;
  await db.insert(posts).values({
    id: postId,
    exhibitionId,
    photographerId: 'test-user',
    title: 'test',
    type: 'SINGLE',
    status: 'PROCESSING',
  });
  return postId;
}

export async function givenPhotoItem(
  db: PgTestDb,
  postId: string,
  overrides?: { id?: string; s3Key?: string; itemOrder?: number },
): Promise<string> {
  const id = overrides?.id ?? `test-${createId()}`;
  await db.insert(photoItems).values({
    id,
    postId,
    itemOrder: overrides?.itemOrder ?? 0,
    originalS3Key: overrides?.s3Key ?? `raw-uploads/${id}.jpg`,
  });
  return id;
}

export async function givenReadyFrame(
  repo: FrameRepository,
  itemId: string,
): Promise<void> {
  await repo.markFrameReady({
    photoItemId: itemId,
    blurhash: 'LEHV6nWB2yk8pyo0adR*',
    derivatives: [
      {
        variant: 'web',
        s3Key: `derivatives/${itemId}/web.webp`,
        url: `http://x/derivatives/${itemId}/web.webp`,
        width: 1200,
        height: 900,
        sizeBytes: 10,
      },
    ],
  });
}
