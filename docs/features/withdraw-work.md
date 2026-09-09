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

**Status:** Specced ([PRD](../PRD.md) 0.4-draft) — not implemented
**Owner module:** `posts` (API) + dashboard (web)
**Related:** [PRD-API](../PRD-API.md) §4.0 (error contract), [PRD-FE](../PRD-FE.md) §2.2,
[db-schema](../db-schema.md) (`posts.deleted_at`), [ADR-005](../adr/ADR-005-modular-monolith.md) Rule 2

---

## 1. User stories

- As a photographer, I can withdraw my work while it is `PENDING`, `REJECTED`, `PROCESSING`, `FAILED_PROCESSING`, or `UNPUBLISHED` so my dashboard stays clean (confirm dialog, no undo).
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
| `status IN (PENDING, REJECTED, PROCESSING, FAILED_PROCESSING, UNPUBLISHED)` | `204`, `deleted_at=now()` (for `PROCESSING`: BullMQ jobs cancelled best-effort via `job.remove()`; in-flight jobs complete harmlessly, aggregation skips `deleted_at IS NOT NULL`) |
| `APPROVED`/`PUBLISHED` | `409 {code:"WITHDRAW_CLOSED"}` |
| Exhibition `ARCHIVED` + status never-published (`PENDING`/`REJECTED`/`PROCESSING`/`FAILED_PROCESSING`/`UNPUBLISHED`) | `204` (targeted exception — the freeze protects public content; an unpublished work has none. Owner cleanup path so `ARCHIVED` with in-flight works never dead-ends) |
| Exhibition `ARCHIVED` + `APPROVED`/`PUBLISHED` | `403 {code:"ARCHIVED"}` |
| unknown `id` | `404 {code:"NOT_FOUND"}` |
| repeat call | `204` (idempotent) |

Effects (one tx): set `deleted_at`; cancel pending BullMQ jobs for its
`photo_items`; keep `likes`/`comments` rows (hidden by existing
`deleted_at IS NULL` filter); keep MinIO objects (orphan cleanup
deferred post-1.0, see §7). Emits `AuditRequestedEvent`
(`action='post.withdraw'`).

Concurrency rule: every mutating statement on `posts` carries
`WHERE deleted_at IS NULL` — withdraw wins races against concurrent
`PATCH`/reorder/retry (the loser sees `404 NOT_FOUND`, never a
half-applied edit). No optimistic-locking version column in v1.

Error shape: see [PRD-API](../PRD-API.md) §4.0 (canonical `{code,message,details?}`).

## 3. Frontend (`/dashboard`)

- **Withdraw** button visible on `PENDING`/`REJECTED`/`PROCESSING`/`FAILED_PROCESSING`/`UNPUBLISHED` cards (see
  [PRD-FE](../PRD-FE.md) §2.2) → confirm dialog ("Withdrawn works cannot be
  restored") → optimistic removal → `204` ok / `409` toast rollback.
- Withdrawn works never render (API already filters `deleted_at`).

## 4. Worker

No change. In-flight frame jobs for a withdrawn work complete harmlessly
(worker `tryPromoteToPending` aggregation skips `deleted_at IS NOT NULL` posts);
cancellation is best-effort via BullMQ `job.remove()`.

## 5. Schema touch

None — reuses `posts.deleted_at` (see [db-schema](../db-schema.md)). No new tables,
no new columns, no migration.

## 6. Edge cases

- Withdraw during worker mid-flight → **allowed** (`PROCESSING` withdrawable, jobs cancelled best-effort); `FAILED_PROCESSING` offers Retry or withdraw + re-upload.
- Withdraw in `ARCHIVED` exhibition → `403 {code:"ARCHIVED"}` for
  `APPROVED`/`PUBLISHED` works, but `204` for never-published works (see
  table — owner cleanup path, so a work left `PENDING`/`FAILED_PROCESSING`
  when its exhibition archives never dead-ends).
- `GET /api/posts/mine` excludes withdrawn (owner sees clean list).

## 7. Out of scope (post-1.0)

- Restore/un-withdraw; hard delete + MinIO orphan GC; author-visible
  tombstone ("you withdrew X"); withdrawing `APPROVED` via author request
  flow (currently admin-only unpublish).

## 8. Acceptance checklist

- [ ] `DELETE` PENDING → `204`, gone from `/dashboard` + public gallery
- [ ] `DELETE` REJECTED → `204`
- [ ] `DELETE` PROCESSING/FAILED_PROCESSING/UNPUBLISHED → `204` (jobs cancelled best-effort)
- [ ] `DELETE` PUBLISHED → `409 WITHDRAW_CLOSED` + toast copy
- [ ] Double `DELETE` → `204` both times
- [ ] `GET /api/admin/audit-logs?action=post.withdraw` shows the row
- [ ] `ADMIN` deletes another user's `PENDING` work → `204`; non-owner non-admin → `403 FORBIDDEN`
