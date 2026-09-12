import { createDb, type Db } from '@declic/db';
import { photoDerivatives, photoItems, posts } from '@declic/db';
import { Injectable, Optional } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { PhotoVariant } from './variants';

export interface DerivativeInput {
  variant: PhotoVariant;
  s3Key: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
}

@Injectable()
export class FrameRepository {
  private readonly db: Db;

  // Optional injection: DI resolves nothing by default (no Db provider
  // registered), tests pass an explicit client (e.g. PGlite-backed).
  constructor(@Optional() db?: Db) {
    this.db = db ?? createDb();
  }

  async markFrameReady(args: {
    photoItemId: string;
    blurhash: string;
    derivatives: DerivativeInput[];
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(photoItems)
        .set({ blurhash: args.blurhash })
        .where(eq(photoItems.id, args.photoItemId));
      await tx.insert(photoDerivatives).values(
        args.derivatives.map((d) => ({
          id: createId(),
          photoItemId: args.photoItemId,
          variant: d.variant,
          s3Key: d.s3Key,
          url: d.url,
          width: d.width,
          height: d.height,
          sizeBytes: d.sizeBytes,
        })),
      );
    });
  }

  async tryPromoteToPending(postId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM posts WHERE id = ${postId} FOR UPDATE`,
      );
      const [{ value: pending }] = await tx
        .select({ value: count() })
        .from(photoItems)
        .where(and(eq(photoItems.postId, postId), isNull(photoItems.blurhash)));
      if (pending > 0) return false;
      const updated = await tx
        .update(posts)
        .set({ status: 'PENDING' })
        .where(
          and(
            eq(posts.id, postId),
            inArray(posts.status, ['PROCESSING', 'FAILED_PROCESSING']),
            isNull(posts.deletedAt),
          ),
        )
        .returning({ id: posts.id });
      return updated.length > 0;
    });
  }

  async markPostFailed(postId: string): Promise<void> {
    await this.db
      .update(posts)
      .set({ status: 'FAILED_PROCESSING' })
      .where(
        and(
          eq(posts.id, postId),
          eq(posts.status, 'PROCESSING'),
          isNull(posts.deletedAt),
        ),
      );
  }
}
