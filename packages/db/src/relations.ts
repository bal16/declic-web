import { defineRelations } from 'drizzle-orm';

import * as schemas from './schema';

export const relations = defineRelations(schemas, (r) => ({
  exhibitions: {
    posts: r.many.posts(),
  },
  posts: {
    exhibition: r.one.exhibitions({
      from: r.posts.exhibitionId,
      to: r.exhibitions.id,
    }),
    photoItems: r.many.photoItems(),
  },
  photoItems: {
    post: r.one.posts({
      from: r.photoItems.postId,
      to: r.posts.id,
    }),
    photoDerivatives: r.many.photoDerivatives(),
    jobLogs: r.many.jobLogs(),
  },
  photoDerivatives: {
    photoItem: r.one.photoItems({
      from: r.photoDerivatives.photoItemId,
      to: r.photoItems.id,
    }),
  },
  jobLogs: {
    post: r.one.posts({
      from: r.jobLogs.postId,
      to: r.posts.id,
    }),
    photoItem: r.one.photoItems({
      from: r.jobLogs.photoItemId,
      to: r.photoItems.id,
    }),
  },
}));

// export const

// export const photoItemsRelations = defineRelations(photoItems, ({ one, many }) => ({
//   post: one(posts, {
//     fields: [photoItems.postId],
//     references: [posts.id],
//   }),
//   photoDerivatives: many(photoDerivatives),
// }));

// export const photoDerivativesRelations = defineRelations(
//   photoDerivatives,
//   ({ one }) => ({
//     photoItem: one(photoItems, {
//       fields: [photoDerivatives.photoItemId],
//       references: [photoItems.id],
//     }),
//   }),
// );

// export const postsContainsRelations = defineRelations(posts, ({ many }) => ({
//   photoItems: many(photoItems),
// }));
