import { defineRelations } from 'drizzle-orm';

import * as schemas from './schema';

export const contains = defineRelations(schemas, (r) => ({
  posts: {
    photoItems: r.many.photoItems(),
  },
  photoItems: {
    post: r.one.posts({
      from: r.photoItems.postId,
      to: r.posts.id,
    }),
  },
}));

export const derivatives = defineRelations(schemas, (r) => ({
  photoItems: {
    photoDerivatives: r.many.photoDerivatives(),
  },
  photoDerivatives: {
    photoItem: r.one.photoItems({
      from: r.photoDerivatives.photoItemId,
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
