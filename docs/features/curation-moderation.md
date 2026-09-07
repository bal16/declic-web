---
aliases:
  - Curation and Moderation
tags:
  - declic
  - feature
  - admin
status: draft
updated: 2026-09-07
---

# Feature: Curation & Moderation (order, approve/reject, comments, audit trail)

**Status:** Specced ([[PRD]] 0.4-draft) — not implemented
**Owner modules:** `curation`, `moderation` (no tables — via `posts`
facade per [[ADR-005-modular-monolith|ADR-005]]), `engagement`
(comment hide), `audit` (trail)
**Related:** [[PRD-API]] §4.0 (error contract), [[PRD-FE]] §3.3 +
`/admin/*`, [[db-schema]], [[exhibition-lifecycle]] (per-exhibition
scope), [[curator-replace-revert]] (frame-level curation)

---

## 1. User stories

- As a curator (ADMIN), I arrange the public order of works per
  exhibition by drag-and-drop (O(1) update, no full rebalance).
- As a curator, I approve or reject whole works (SERIES moderated as
  one unit) with a required reason on reject.
- As a curator, I hide inappropriate comments and can review the full
  admin action trail (replaces, reverts, phase changes, flag toggles).

## 2. API — `PATCH /api/admin/curate/reorder`

**Access:** `ADMIN`. Orders **works**, not frames. Uses cuid2 `postId`.

**Request Body (Fractional Indexing / LexoRank):**

```json
{
  "postId": "cuid-post-A",
  "prevDisplayOrder": "0|hzzzzz:",
  "nextDisplayOrder": "0|i00003:"
}
```

**API Action:** Calculate a new LexoRank string between
`prevDisplayOrder` and `nextDisplayOrder`, then `UPDATE posts SET
display_order = :newRank WHERE id = :postId` atomically (O(1), no full
table rebalance). Legacy field `photoId` accepted as alias for
`postId`. Blocked when exhibition is `ARCHIVED` (`403 ARCHIVED`).

## 3. API — `PATCH /api/admin/posts/:id/moderate` (cuid2)

**Access:** `ADMIN`.

**Request Body:**

```json
{
  "action": "APPROVE",
  "rejectionReason": "Resolution does not meet requirements."
}
```

`action`: `"APPROVE" | "REJECT" | "UNPUBLISH"`

**API Actions:**

- `APPROVE` → `posts.status = APPROVED`, set initial `display_order`
  at the very bottom (LexoRank max + 1) for the whole work. `APPROVED` is **staging**: visible publicly only when parent `exhibitions.phase IN ('LIVE','ARCHIVED')` (phase-gated, no bulk update on `PRE_EVENT` → `LIVE`).
- `REJECT` → `posts.status = REJECTED`, `rejection_reason` is required
  — whole work rejected (no per-frame moderation in v1).
- `UNPUBLISH` (admin hide during `LIVE`) → `posts.status = UNPUBLISHED` via same endpoint (`action: "UNPUBLISH"`, no reason required). Public gallery excludes `UNPUBLISHED`. Re-publish via `APPROVE` again (idempotent).
- `PUBLISHED` is a legacy alias of `APPROVED` + `LIVE` (gallery treats both as visible); new writes use `APPROVED`/`UNPUBLISHED` only.
- **Audit:** Insert into `admin_audit_logs` (`id=cuid2`,
  `target_id=cuid-post`, `action='post.moderate'`).

**Alias:** `PATCH /api/admin/photos/:id/moderate` (deprecated).

## 4. API — `DELETE /api/admin/comments/:id` (cuid2)

Soft moderation (verb kept as idempotent hide) — `UPDATE comments SET is_hidden = true`.
Idempotent: hiding an already-hidden comment → `204`, no double decrement.
`posts.comments_count` decremented only if the comment was previously
counted (`is_hidden=false AND deleted_at IS NULL`). Admin reads still
include hidden rows. Audited (`action='comment.hide'`).

## 5. API — `GET /api/admin/audit-logs` (ADMIN, read-only)

Read-only trail over `admin_audit_logs`. Query params: `target_id`
(cuid2, e.g. frame for replace/revert chain), `action` (e.g.
`photo_item.replace`, `photo_item.revert`, `post.withdraw`,
`post.moderate`, `comment.hide`, `exhibition.phase_change`,
`feature_flag.toggle`, `site_settings.update`, `user.role_change`),
`limit` (default `20`, max `50`), `cursor` (§4.0 schema,
`ORDER BY created_at, id`). Response: `{ data: [{id, admin_id, action,
target_id, payload, created_at}], nextCursor }`. Powers the
revert-history UI (see [[curator-replace-revert]]) and phase-change
trail; retention unbounded for 1.0.

## 6. Frontend (`/admin/moderation`, `/admin/curate`, `/admin/comments`)

Summary (full UI spec: [[PRD-FE]] §2.3/§3.3):

- **Moderation queue:** per-exhibition filter, cover + frame strip for
  SERIES, Approve/Reject with reason, per-frame Replace entry point.
- **Curation canvas:** `dnd-kit` sortable works (cover cards, `CURATED`
  hint), mobile move up/down fallback, optimistic reorder +
  `PATCH reorder {postId, prevDisplayOrder, nextDisplayOrder}`.
  Disabled when `ARCHIVED`. Intra-series order is authorial (see
  [[series-upload]] §5), not editable here.
- **Comment moderation:** per-exhibition flat list, `is_hidden` toggle.

## 7. Worker

No involvement.

## 8. Schema touch

Writes go through `posts` facade (`display_order`, `status`,
`rejection_reason`) and `comments.is_hidden`; reads
`admin_audit_logs` (see [[db-schema]]). `curation`/`moderation` own no
tables. No new tables.

## 9. Edge cases

- Reorder race (two admins) → last-writer-wins on one row (O(1), no
  lock needed); UI refetch converges.
- Approve already-`PUBLISHED` work → idempotent no-op.
- Reorder in `ARCHIVED` → `403 ARCHIVED`.

## 10. Out of scope (post-1.0)

- Scheduled publishing; bulk approve; comment edit history; audit
  retention policy/rotation.

## 11. Acceptance checklist

- [ ] Drag work → `display_order` between neighbors, no rebalance
- [ ] Reject without reason → `400`; with reason → `REJECTED` + audit
- [ ] Hide comment → count decrements, public hides, admin sees
- [ ] Audit-logs filtered by `target_id` shows replace→revert chain
