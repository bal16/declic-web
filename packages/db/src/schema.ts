import { createId } from '@paralleldrive/cuid2';
// import { relations } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const postTypeEnum = pgEnum('post_type', ['SINGLE', 'SERIES']);
export const postStatusEnum = pgEnum('post_status', [
  'PROCESSING',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'UNPUBLISHED',
  'FAILED_PROCESSING',
]);
export const photoVariantEnum = pgEnum('photo_variant', [
  'thumbnail',
  'web',
  'lightbox',
]);

export const posts = pgTable(
  'posts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    exhibitionId: text('exhibition_id').notNull(), // Foreign key to the exhibitions table, for now we will just store the exhibition ID as a string. In the future, we can create a separate table for exhibitions and establish a proper foreign key relationship.
    photographerId: text('photographer_id').notNull(), // Foreign key to the user table, for now we will just store the photographer ID as a string. In the future, we can create a separate table for photographers and establish a proper foreign key relationship.
    title: varchar('title', { length: 255 }).notNull(),
    caption: text('caption'),
    type: postTypeEnum('post_type').notNull(),
    status: postStatusEnum('post_status').notNull(),
    rejectionReason: text('rejection_reason'),
    displayOrder: varchar('display_order', { length: 255 }),
    likesCount: integer('likes_count').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('posts_exhibition_id_idx').on(t.exhibitionId),
    index('posts_status_idx').on(t.status),
    index('posts_gallery_idx').on(t.exhibitionId, t.status),
    index('posts_photographer_id_idx').on(t.photographerId),
    index('posts_created_at_idx').on(t.createdAt),
    index('posts_display_order_idx').on(t.displayOrder),
    index('posts_type_idx').on(t.type),
  ],
);

export const photoItems = pgTable(
  'photo_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id),
    itemOrder: integer('item_order').notNull(),
    originalS3Key: varchar('original_s3_key', { length: 255 }).notNull(),
    blurhash: varchar('blurhash', { length: 255 }),
    exifMetadata: jsonb('exif_metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('photo_items_post_item_unique').on(t.postId, t.itemOrder),
    index('photo_items_post_id_idx').on(t.postId),
  ],
);

export const photoDerivatives = pgTable(
  'photo_derivatives',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    photoItemId: text('photo_item_id')
      .notNull()
      .references(() => photoItems.id),
    variant: photoVariantEnum('photo_variant').notNull(),
    s3Key: varchar('s3_key', { length: 255 }).notNull(),
    url: text('url').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  },
  (t) => [index('photo_derivatives_photo_item_id_idx').on(t.photoItemId)],
);

// export const photoItemsRelations = relations(photoItems, ({ one, many }) => ({
//   post: one(posts, {
//     fields: [photoItems.postId],
//     references: [posts.id],
//   }),
//   photoDerivatives: many(photoDerivatives),
// }));

// export const photoDerivativesRelations = relations(
//   photoDerivatives,
//   ({ one }) => ({
//     photoItem: one(photoItems, {
//       fields: [photoDerivatives.photoItemId],
//       references: [photoItems.id],
//     }),
//   }),
// );

// export const postsContainsRelations = relations(posts, ({ many }) => ({
//   photoItems: many(photoItems),
// }));
