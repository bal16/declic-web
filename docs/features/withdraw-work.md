---
aliases:
  - Withdraw Work
tags:
  - declic
  - feature
  - posts
status: draft
updated: 2026-09-07
---

# Feature: Withdraw Work (photographer pulls back own submission)

**Status:** Specced ([[PRD]] 0.4-draft) — not implemented
**Owner module:** `posts` (API) + dashboard (web)
**Related:** [[PRD-API]] §4.0 (error contract), [[PRD-FE]] §2.2,
[[db-schema]] (`posts.deleted_at`), [[ADR-005-modular-monolith|ADR-005]] Rule 2

---

## 1. User stories

- As a photographer, I can withdraw my work while it is `PENDING` or
  `REJECTED` so my dashboard stays clean (confirm dialog, no undo).
- As a photographer, I am told *why not* when withdrawing an
  `APPROVED`/`PUBLISHED` work (`409 WITHDRAW_CLOSED` toast — curation
  territory, contact admin instead).
- As an admin, withdrawing someone else's pre-published work works
  identically (same endpoint, `ADMIN` role).

## 2. API

`DELETE /api/posts/:id` (cuid2). Auth: work owner (`photographer_id`)
or `ADMIN` (`RolesGuard`). Guards: `ExhibitionPhaseGuard` (defense in
depth; status gate already implies it).

| Precondition | Result |
|---|---|
| `status IN (PENDING, REJECTED)` | `204`, `deleted_at=now()` |
| else (`APPROVED`/`PUBLISHED`/`PROCESSING`) | `409 {code:"WITHDRAW_CLOSED"}` |
| unknown `id` | `404 {code:"NOT_FOUND"}` |
| repeat call | `204` (idempotent) |

Effects (one tx): set `deleted_at`; cancel pending BullMQ jobs for its
`photo_items`; keep `likes`/`comments` rows (hidden by existing
`deleted_at IS NULL` filter); keep MinIO objects (orphan cleanup
deferred post-1.0, see §7). Audit: `post.withdraw` row.

Error shape: see [[PRD-API]] §4.0 (canonical `{code,message,details?}`).

## 3. Frontend (`/dashboard`)

- **Withdraw** button visible only on `PENDING`/`REJECTED` cards (see
  [[PRD-FE]] §2.2) → confirm dialog ("Withdrawn works cannot be
  restored") → optimistic removal → `204` ok / `409` toast rollback.
- Withdrawn works never render (API already filters `deleted_at`).

## 4. Worker

No change. In-flight frame jobs for a withdrawn work complete harmlessly
(`FrameReadyEvent` aggregation skips `deleted_at IS NOT NULL` posts);
cancellation is best-effort via BullMQ `job.remove()`.

## 5. Schema touch

None — reuses `posts.deleted_at` (see [[db-schema]]). No new tables,
no new columns, no migration.

## 6. Edge cases

- Withdraw during worker mid-flight → `409 WITHDRAW_CLOSED`
  (`PROCESSING` not withdrawable); photographer retries after `PENDING`.
- Withdraw in `ARCHIVED` exhibition → unreachable in practice (works are
  `PUBLISHED` by then) but guarded → `403 {code:"ARCHIVED"}`.
- `GET /api/posts/mine` excludes withdrawn (owner sees clean list).

## 7. Out of scope (post-1.0)

- Restore/un-withdraw; hard delete + MinIO orphan GC; author-visible
  tombstone ("you withdrew X"); withdrawing `APPROVED` via author request
  flow (currently admin-only unpublish).

## 8. Acceptance checklist

- [ ] `DELETE` PENDING → `204`, gone from `/dashboard` + public gallery
- [ ] `DELETE` REJECTED → `204`
- [ ] `DELETE` PUBLISHED → `409 WITHDRAW_CLOSED` + toast copy
- [ ] Double `DELETE` → `204` both times
- [ ] `GET /api/admin/audit-logs?action=post.withdraw` shows the row
