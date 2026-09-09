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

**Status:** Specced ([PRD](../PRD.md) 0.4-draft) — not implemented
**Owner modules:** `curation`, `moderation` (no tables — via `posts`
facade per [ADR-005](../adr/ADR-005-modular-monolith.md)), `engagement`
(comment hide), `audit` (trail)
**Related:** [PRD-API](../PRD-API.md) §4.0 (error contract), [PRD-FE](../PRD-FE.md) §3.3 +
`/admin/*`, [db-schema](../db-schema.md), [exhibition-lifecycle](./exhibition-lifecycle.md) (per-exhibition
scope), [curator-replace-revert](./curator-replace-revert.md) (frame-level curation)

---

## 1. User stories

- As a curator (CURATOR), I arrange the public order of works per
  exhibition by drag-and-drop (O(1) update, no full rebalance).
- As a curator, I approve or reject whole works (SERIES moderated as
  one unit) with a required reason on reject.
- As a curator, I hide inappropriate comments and can review the full
  admin action trail (replaces, reverts, phase changes, flag toggles).

## 2. API — `PATCH /api/admin/curate/reorder`

**Access:** `ADMIN`, `CURATOR`. Orders **works**, not frames. Uses cuid2 `postId`.

**Definition:** `display_order` is the key of the default (`curated`) sort
— sorts are independent (`most_liked` reads `likes_count`, `recent`
reads `created_at`; neither reads `display_order`). There is exactly one
rank order per exhibition (global, not per-filter): any neighbor pair
yields a valid rank, and neighbors are interpreted in curated sequence
(the `/admin/curate` canvas is the curated view, so this holds by
construction — including drags inside a filter).

**Validation:** any non-deleted status may be ranked (effect lands when
the work is `APPROVED`); withdrawn (`deleted_at IS NOT NULL`) → `404`;
exhibition `ARCHIVED` → `403 {code:"ARCHIVED"}`.

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
`postId`. Blocked when exhibition is `ARCHIVED` (`403 {code:"ARCHIVED"}`).

**Response `200 OK`:** `{ "postId": "cuid-post", "displayOrder": "0|hzzzzz:" }`.
Errors: `404 NOT_FOUND` (unknown `postId`); `400 VALIDATION_ERROR` (rank
outside the exhibition scope, i.e. `postId` belongs to another exhibition).

## 3. API — `PATCH /api/admin/posts/:id/moderate` (cuid2)

**Access:** `ADMIN`, `CURATOR`.

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

**Allowed transitions (from-status → action → result):**

| From \ Action | `APPROVE` | `REJECT` | `UNPUBLISH` |
|---|---|---|---|
| `PENDING` | → `APPROVED` | → `REJECTED` | `409` (nothing public to hide — `REJECT` instead) |
| `REJECTED` | → `APPROVED` | idempotent `200` | `409` (not public) |
| `APPROVED` | idempotent `200` | → `REJECTED` | → `UNPUBLISHED` |
| `PUBLISHED` (legacy alias) | idempotent `200` (as `APPROVED`) | → `REJECTED` | → `UNPUBLISHED` |
| `UNPUBLISHED` | → `APPROVED` (re-publish) | → `REJECTED` | idempotent `200` |
| `PROCESSING` / `FAILED_PROCESSING` | `409` (work not ready — wait or Retry) | `409` | `409` |

Validation notes: `action: "PUBLISHED"` is rejected with `400 VALIDATION_ERROR` (legacy alias, never a write); `rejectionReason` sent with `APPROVE`/`UNPUBLISH` is ignored (not stored, no error); `REJECT` without reason → `400`.

- **Audit:** emits `AuditRequestedEvent` (`target_id=cuid-post`,
  `action='post.moderate'`) — never a direct insert ([ADR-005](../adr/ADR-005-modular-monolith.md) Rule 2).

**Response `200 OK`:** `{ "postId": "cuid-post", "status": "APPROVED", "displayOrder": "0|hzzzzz:" }`
(`displayOrder` present only for `APPROVE`; `REJECT` returns `rejectionReason` instead).
Errors: `404 NOT_FOUND`; `400 VALIDATION_ERROR` (`REJECT` without reason).

**Alias:** `PATCH /api/admin/photos/:id/moderate` (deprecated, removed post-1.0).

## 4. API — `DELETE /api/admin/comments/:id` (cuid2)

**Access:** `ADMIN`, `CURATOR`.

Soft moderation (verb kept as idempotent hide) — via the `engagement`
facade (`hideComment`, same tx as the `comments_count` decrement),
never a raw Drizzle write ([ADR-005](../adr/ADR-005-modular-monolith.md) Rule 2).
Idempotent: hiding an already-hidden comment → `204`, no double decrement.
`posts.comments_count` decremented only if the comment was previously
counted (`is_hidden=false AND deleted_at IS NULL`). `ADMIN` and `CURATOR`
reads still include hidden rows (see [engagement](./engagement.md) §4). Emits `AuditRequestedEvent` (`action='comment.hide'`).

## 5. API — `GET /api/admin/audit-logs` (ADMIN + CURATOR, read-only)

Read-only trail over `admin_audit_logs`. No scoping in v1 — `ADMIN` and
`CURATOR` see the full trail (including other curators' actions and
`adminId: null` cron rows); an audit log that hides entries is not an
audit log. Query params: `targetId`
(cuid2, e.g. frame for replace/revert chain), `action` (e.g.
`photo_item.replace`, `photo_item.revert`, `post.withdraw`,
`post.retry`, `post.moderate`, `comment.hide`, `exhibition.phase_change`,
`feature_flag.toggle`, `site_settings.update`, `user.role_change`),
`limit` (default `20`, max `50`), `cursor` (§4.0 schema,
`ORDER BY created_at, id`). Response: `{ data: [{id, adminId, action,
targetId, payload, createdAt}], nextCursor }`. Powers the
revert-history UI (see [curator-replace-revert](./curator-replace-revert.md)) and phase-change
trail; retention unbounded for 1.0.

## 6. Frontend (`/admin/moderation`, `/admin/curate`, `/admin/comments`)

Summary (full UI spec: [PRD-FE](../PRD-FE.md) §2.3/§3.3):

- **Moderation queue:** per-exhibition filter, cover + frame strip for
  SERIES, Approve/Reject with reason, per-frame Replace entry point.
- **Curation canvas:** `dnd-kit` sortable works (cover cards, `CURATED`
  hint), mobile move up/down fallback, optimistic reorder +
  `PATCH reorder {postId, prevDisplayOrder, nextDisplayOrder}`.
  Disabled when `ARCHIVED`. Intra-series order is authorial (see
  [series-upload](./series-upload.md) §5), not editable here.
- **Comment moderation:** per-exhibition flat list, `is_hidden` toggle.

## 7. Worker

No involvement.

## 8. Schema touch

Writes go through `posts` facade (`display_order`, `status`,
`rejection_reason`) and `comments.is_hidden`; reads
`admin_audit_logs` (see [db-schema](../db-schema.md)). `curation`/`moderation` own no
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
- [ ] Audit-logs filtered by `targetId` shows replace→revert chain
