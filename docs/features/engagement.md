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

**Status:** Specced ([PRD](../specs/PRD.md) 0.4-draft) — not implemented
**Owner module:** `engagement`
**Related:** [PRD-API](../specs/PRD-API.md) §4.0 (error contract), [PRD-FE](../specs/PRD-FE.md) §3.1 (lightbox
interactions), [db-schema](../data/db-schema.md) (`likes`, `comments`),
[exhibition-lifecycle](./exhibition-lifecycle.md) §5 (ARCHIVED freeze)

---

## 1. User stories

- As a logged-in visitor, I can like a work (one like per work, SERIES
  liked as one unit) with instant optimistic feedback.
- As a logged-in visitor, I can comment on a work (flat thread in v1).
- As a viewer of an archived exhibition, I can still read likes/comments
  but cannot add new ones (frozen notice).

## 2. API — `POST /api/posts/:id/like` & `DELETE /api/posts/:id/like` (cuid2)

Request body: empty. Responses: `POST → 200 { "likesCount": 43, "isLiked": true }`;
`DELETE → 204` (empty).

- **Idempotent** — repeated `POST` does not duplicate (composite PK on
  `likes(user_id, post_id)`), `DELETE` on a not-yet-liked work still
  returns `204`. Implementation contract: `INSERT ... ON CONFLICT DO
  NOTHING` + increment `likes_count` **only when a row was actually
  inserted** — a naive increment-on-every-POST drifts under retry storms.
- Atomically maintains `posts.likes_count` within same transaction.
- **Visibility precedence (mirrors comments §3):** `POST`/`DELETE` on
  `UNPUBLISHED`/withdrawn work → `404 NOT_FOUND` (uniform, owner
  included — no tombstone in v1); `POST` in `ARCHIVED` → `403 ARCHIVED`;
  `DELETE` (unlike) stays `204` in `ARCHIVED` only (withdrawn/unpublished
  likes keep their rows but have no unlike path — rows are inert).
- Supports Optimistic UI — frontend may update count before response,
  then reconciles with the returned `likesCount`.
- **Frozen when parent exhibition is `ARCHIVED`:** `POST /like`
  → `403 {code:"ARCHIVED", message:"This exhibition is archived, likes
  are frozen"}`. **`DELETE /like` (unlike) stays open** → `204`
  (decrements `posts.likes_count` in the same transaction — the sole
  write exception to the freeze; removing your own like adds no data).
  Read of `likesCount` remains.

**Alias:** `/api/photos/:id/like` (deprecated).

## 3. API — `POST /api/posts/:id/comments`

**Body:** `{ "content": "Amazing composition!", "parentId": "cuid-parent-optional" }`

**Response `201 Created`:** `{ "id": "cuid-comment", "postId": "cuid-post", "content": "...", "parentId": null, "createdAt": "..." }`.

**Failure precedence:** `404 NOT_FOUND` (work invisible: `UNPUBLISHED`/withdrawn or wrong exhibition scope) → `403 {code:"ARCHIVED"}` (frozen exhibition) → `403 {code:"FEATURE_DISABLED"}` (`comments_enabled=false`) → `400 {code:"FEATURE_DISABLED"}` (`parentId` sent while `threaded_comments_enabled=false`).

- **Frozen when parent exhibition is `ARCHIVED`:** `POST /api/posts/:id/comments` →
  `403 {code:"ARCHIVED"}` (reads remain).
- If `threaded_comments_enabled===false` and `parentId` is sent →
  `400 {code:"FEATURE_DISABLED"}` (recommended over silent null).
- Otherwise stores `parent_id` (cuid2) nullable. Increments
  `posts.comments_count` atomically if `is_hidden=false` and exhibition
  not archived.

## 4. API — `GET /api/posts/:id/comments`

Paginated per [PRD-API](../specs/PRD-API.md) §4.0 cursor (`created_at` + `id`, `limit` default `20` max `50`):
`{ data: [{id, postId, content, parentId, createdAt}], nextCursor }`.
List with `is_hidden = false AND deleted_at IS NULL` for public; `ADMIN`
and `CURATOR` see all (including hidden — curators own moderation);
authors see their own hidden comments flagged `isHidden: true`.
Flat sorted by `created_at` (not `id`);
`parentId` returned for future nested assembly, but v1 clients render
flat (nested UI is post-1.0 intent, see §9).

## 5. Frontend (lightbox + detail)

Summary (full UI spec: [PRD-FE](../specs/PRD-FE.md) §3.1): Like button with optimistic
update + rollback (`TanStack Query onMutate`); comment thread with Auth
Wall modal for guests (uniform modal, preserves draft — see [PRD-FE](../specs/PRD-FE.md) §6.3); like/comment creation disabled with frozen tooltip
when `ARCHIVED`, **unlike stays enabled** (removing your own like);
INP `< 150ms`.

## 6. Worker

No involvement.

## 7. Schema touch

`likes` (composite PK `(user_id, post_id)`), `comments` (`post_id`,
`parent_id` nullable self-FK, fully stored and returned), denormalized `posts.likes_count` /
`comments_count` maintained transactionally (see [db-schema](../data/db-schema.md)). No new
tables.

## 8. Edge cases

- Double-click like storm → single row (PK), count converges (see §2 increment-on-insert contract).
- Comment on `UNPUBLISHED`/withdrawn work → `404` (work invisible) — applies to everyone including the owner (no owner carve-out on engagement writes).
- `parentId` pointing to hidden/deleted comment → `400 VALIDATION_ERROR`; `parentId` belonging to a different `postId` → `400 VALIDATION_ERROR` (no cross-post threading, no silent flatten).

## 9. Out of scope (post-1.0)

> **Post-1.0 intent (non-normative):** nested replies UI. The v1 API
> already returns a flat list with `parentId`, so nesting is pure
> client-side assembly when it lands: depth capped at 1 level (a reply
> to a reply renders flat under the same root), no per-thread
> pagination, no nested moderation actions, no reply notifications —
> those are separate scope, not part of this note.

- Reactions beyond like; comment edit (delete + repost is the path);
  notifications.

## 10. Acceptance checklist

- [ ] Double `POST` like → 1 row, count +1
- [ ] `DELETE` unliked → `204`
- [ ] `ARCHIVED`: `POST` like/comment → `403 ARCHIVED`; `DELETE` like → `204`; reads ok
- [ ] `parentId` with flag off → `400 FEATURE_DISABLED`
