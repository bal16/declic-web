---
aliases:
  - Engagement
  - Likes and Comments
tags:
  - declic
  - feature
  - engagement
status: draft
updated: 2026-09-07
---

# Feature: Engagement — Likes & Comments on Works

**Status:** Specced ([[PRD]] 0.4-draft) — not implemented
**Owner module:** `engagement`
**Related:** [[PRD-API]] §4.0 (error contract), [[PRD-FE]] §3.1 (lightbox
interactions), [[db-schema]] (`likes`, `comments`),
[[exhibition-lifecycle]] §5 (ARCHIVED freeze)

---

## 1. User stories

- As a logged-in visitor, I can like a work (one like per work, SERIES
  liked as one unit) with instant optimistic feedback.
- As a logged-in visitor, I can comment on a work (flat thread in v1).
- As a viewer of an archived exhibition, I can still read likes/comments
  but cannot add new ones (frozen notice).

## 2. API — `POST /api/posts/:id/like` & `DELETE /api/posts/:id/like` (cuid2)

- **Idempotent** — repeated `POST` does not duplicate (composite PK on
  `likes(user_id, post_id)`), `DELETE` on a not-yet-liked work still
  returns `204`.
- Atomically maintains `posts.likes_count` within same transaction.
- Supports Optimistic UI — frontend may update count before response.
- **Frozen when parent exhibition is `ARCHIVED`:** `POST/DELETE /like`
  → `403 {code:"ARCHIVED", message:"This exhibition is archived, likes
  are frozen"}` (read of `likesCount` remains).

**Alias:** `/api/photos/:id/like` (deprecated).

## 3. API — `POST /api/posts/:id/comments`

**Body:** `{ "content": "Amazing composition!", "parentId": "cuid-parent-optional" }`

- **Frozen when parent exhibition is `ARCHIVED`:** `POST /comments` →
  `403 ARCHIVED` (reads remain).
- If `threaded_comments_enabled===false` and `parentId` is sent →
  `400 {code:"FEATURE_DISABLED"}` (recommended over silent null).
- Otherwise stores `parent_id` (cuid2) nullable. Increments
  `posts.comments_count` atomically if `is_hidden=false` and exhibition
  not archived.

## 4. API — `GET /api/posts/:id/comments`

List with `is_hidden = false AND deleted_at IS NULL` for public; Admin
sees all (including hidden). Flat sorted by `created_at` (not `id`);
`parent_id` included but clients render flat unless threading flag is on
(see [[feature-flags-site-settings]]).

## 5. Frontend (lightbox + detail)

Summary (full UI spec: [[PRD-FE]] §3.1): Like button with optimistic
update + rollback (`TanStack Query onMutate`); comment thread with Auth
Wall for guests; both disabled with frozen tooltip when `ARCHIVED`;
INP `< 150ms`.

## 6. Worker

No involvement.

## 7. Schema touch

`likes` (composite PK `(user_id, post_id)`), `comments` (`post_id`,
`parent_id` reserved), denormalized `posts.likes_count` /
`comments_count` maintained transactionally (see [[db-schema]]). No new
tables.

## 8. Edge cases

- Double-click like storm → single row (PK), count converges.
- Comment on `UNPUBLISHED`/withdrawn work → `404` (work invisible).
- `parentId` pointing to hidden/deleted comment → `400 VALIDATION_ERROR`.

## 9. Out of scope (post-1.0)

- Threaded replies UI (`parent_id` reserved); reactions beyond like;
  comment edit (delete + repost is the path); notifications.

## 10. Acceptance checklist

- [ ] Double `POST` like → 1 row, count +1
- [ ] `DELETE` unliked → `204`
- [ ] `ARCHIVED`: like/comment → `403 ARCHIVED`, reads ok
- [ ] `parentId` with flag off → `400 FEATURE_DISABLED`
