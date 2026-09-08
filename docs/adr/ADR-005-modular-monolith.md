---
aliases:
  - ADR-005
tags:
  - declic
  - adr
status: accepted
updated: 2026-09-07
---
# ADR-005: Modular Monolith Boundaries for `apps/api`

**Status:** Accepted
**Date:** 2026-09-07
**Org:** bal16
**Deciders:** repo owner
**Related:** [[PRD-API]] §1–§2/§4, [[PRD-Worker]] §1–§3, [[db-schema]], `../seed.ts`, `../../apps/api/src/app.module.ts`, `../../apps/api/src/modules/examples/`, [[ADR-001-monorepo-mirror|ADR-001]], [[ADR-003-zod-dto-strategy|ADR-003]]

---

## 1. Context

`apps/api` is a single NestJS deployable ([[ADR-001-monorepo-mirror|ADR-001]]) with 12 planned
feature modules ([[PRD-API]] §1.1: auth, users, exhibitions,
posts/photo-items, curation, moderation, engagement, storage, queue,
feature-flags, site-settings, audit) plus `common/`. Today only
`app.module.ts` (global config + health) and the `modules/examples/`
living skeleton exist; `packages/db` has no `src/` yet and no
event-emitter dependency is installed.

Without boundary rules the module list is a plain monolith: any module
can deep-import any other module's internals or write to any table,
and the codebase drifts into spaghetti before 1.0. The team is one
person, one Postgres, one Redis — microservices would add ops cost
with no scaling benefit pre-launch. What is needed is a structure
that keeps one deployable but preserves extractability later.

Q1 scope for 1.0 is confirmed IN: photographer withdraw
(`DELETE /api/posts/:id`, soft-delete), exhibition poster upload
(`POST /api/admin/exhibitions/:id/poster-upload-url` + `poster_s3_key`
via existing PATCH), and curator revert
(`POST /api/admin/posts/:postId/frames/:itemId/revert`). All three fit inside
the module boundaries defined here with no new tables.

## 2. Decision

`apps/api` is a **modular monolith**: one deployable, hard module
boundaries, extractable later.

### Rule 1 — No deep cross-module imports

Each module exposes exactly one entry point, `public-api.ts`
(facade service + events it emits). Any file not re-exported from
`public-api.ts` is internal and off-limits to other modules.
`common/` (guards, interceptors, filters, decorators) is the only
code importable from anywhere.

Enforcement: `scripts/check-boundaries.ts` CI gate (same pattern as
`scripts/check-coverage.ts`), failing on imports matching
`modules/<other-module>/*` except via `public-api`. Wired into
`ci.yml` alongside the coverage gate.

### Rule 2 — Table ownership (one writer per table)

| Module | Owns (sole writer) |
|---|---|
| `exhibitions` | `exhibitions` |
| `posts` | `posts`, `photo_items`, `photo_derivatives` |
| `engagement` | `likes`, `comments` (plus `posts.likes_count`/`comments_count` in its own tx) |
| `feature-flags` | `feature_flags` |
| `site-settings` | `site_settings` |
| `audit` | `admin_audit_logs` (append-only; others request via event) |
| `curation` / `moderation` | **no tables** — operate on `posts` only through the `posts` facade (`setDisplayOrder`, `setStatus`), never raw Drizzle writes |
| `storage` / `queue` | no tables — MinIO presign / BullMQ enqueue facades |
| `auth` / `users` | Better Auth-owned tables + `users.role` elevation |

`packages/db` (Drizzle schema, seeded from `docs/seed.ts`) is shared
readable schema; **writes** follow the ownership map.

### Rule 3 — Async seam is domain events

`@nestjs/event-emitter` (to be installed) is the only async
cross-module channel. Sync cross-module reads go through facades.

| Event | Emitter | Listener | Effect |
|---|---|---|---|
| `PostCreatedEvent { postId, photoItemIds[] }` | `posts` | `queue` | enqueue N `image-processing` jobs |
| `FrameReadyEvent { postId, photoItemId }` | worker callback via `posts` | `posts` | promote `posts.status` to `PENDING` when all siblings ready |
| `ExhibitionArchivedEvent { exhibitionId }` | `exhibitions` (cron) | `engagement` | freeze likes/comments (`403 ARCHIVED`) |
| `PhotoItemReplacedEvent { postId, photoItemId, s3Key, curated: true }` | `posts` | `queue` | enqueue 1 replacement job (same pipeline) |
| `PhotoItemRevertedEvent { postId, photoItemId }` | `posts` | `queue` | enqueue 1 revert job |

Payloads use cuid2 `text` ids (`{ postId, photoItemId, s3Key,
curated }`); `users` ids stay Better Auth-managed.

### Rule 4 — Shared kernel only

`packages/contracts` (pure Zod DTOs, [[ADR-003-zod-dto-strategy|ADR-003]]) + `packages/db`
(schema) + `common/` are the only shared code. DTO wrappers stay
one line each co-located with their module (`*.dto.ts` via
`createZodDto`).

### Rule 5 — Module template + sequencing

Each module ships `*.module.ts`, `public-api.ts`,
`*.controller.ts`, `*.service.ts`, `dto.ts`, `*.test.ts` —
mirroring `modules/examples/`, which is deleted when the first real
module lands (its header already says so).

Landing order: `packages/db` schema first (unblocks all), then
`storage` + `queue` facades, then `posts`, then
`engagement`/`curation`/`moderation` (incl. Q1 withdraw/revert),
then `exhibitions` + poster upload + scheduler, then
`feature-flags`/`site-settings`/`audit`. The worker consumes the
queue payload only — it never imports api modules.

## 3. Alternatives considered

### A. Plain monolith with free imports (status quo) — rejected

Keep the §1.1 module list as convention only, no enforcement.

* Pros: zero tooling, fastest first module.
* Cons: boundaries erode before 1.0; `curation` writing `posts`
  directly and `engagement` reaching into `exhibitions` become
  untestable knots; later extraction requires a rewrite, not a cut.

### B. Microservices per domain — rejected

Split posts/engagement/moderation into separate deployables now.

* Pros: independent deploys, strongest isolation.
* Cons: one-person team pays service-discovery, distributed-tx,
  and multi-repo coordination tax (the exact cost [[ADR-001-monorepo-mirror|ADR-001]] rejected);
  single Postgres/Redis means distribution without independence.
  Revisit only if a module gets its own team or load profile —
  Rule 1–3 boundaries make that cut mechanical.

### C. This ADR (modular monolith) — accepted

One deployable, enforced boundaries, event seam. Keeps Bun/NestJS
DX and [[ADR-001-monorepo-mirror|ADR-001]] release flow (`vX.Y.Z` single tag) unchanged while
preserving a later split path.

## 4. Consequences

* Positive: cross-module changes are explicit (facade or event);
  Q1 features (withdraw soft-delete, poster upload, revert) land
  without new tables; worker stays decoupled via queue payload.
* Negative: new dependency (`@nestjs/event-emitter`); facade
  discipline slows the first module slightly; boundary-check
  script needs maintenance as modules land.
* Guardrails required: `check-boundaries.ts` in CI; code review
  rejects deep imports even when the gate is bypassed; events
  catalog kept in this ADR (table in §2, Rule 3).

## 5. Verification

* `bun run --filter "@declic/api" typecheck` clean with
  `@nestjs/event-emitter` installed.
* `bun run boundaries` green on the tree (only
  `examples/` + `common/` + `*.test.ts` cross-imports allowed until real
  modules land).
* Unit test per module covers facade contract; one integration
  test traces `PostCreatedEvent` → queued job → `FrameReadyEvent`
  → `PENDING` without importing internals across modules.
* `bun run coverage` stays ≥90% lines per app ([[ADR-002-release-tagging|ADR-002]] gate).

## 6. Addendum — layered boundary gate (2026-09-08)

Agreed via grilling: benchmark `check-boundaries.ts` at `0.05s`
(measured, equivalent to oxlint) invalidates the "pre-commit is slow"
assumption, so the gate runs at every layer. `ci.yml` auto-trigger
stays deferred (planning/docs still churn on `main`).

* **Local:** `bun run boundaries` (`package.json` script over
  `scripts/check-boundaries.ts`) + Lefthook pre-commit (full-tree scan,
  no `stage_fixed` — the gate re-stages nothing).
* **Release:** `release.yml` job `verify` runs the boundary step between
  `Lint` and `Format check` (never trusts `main`'s status).
* **Script scope:** Rule A covers relative (`./`, `../`) and alias
  (`@/`, `~/`, `src/`) specs; Rule B forbids
  `apps/worker/src` → `apps/api/src` (worker consumes queue payload
  only; shared code via `packages/contracts`, `packages/db`).
  Allowlist: `common/`, `packages/*` / `@declic/*`, bare imports,
  `*.test.ts`, `modules/examples/`.

---

## Cross references

* Module list + responsibilities: [[PRD-API]] §1.1
* Schema + ownership targets: [[db-schema]], `../seed.ts`
* Queue payload + worker contract: [[PRD-Worker]] §1–§3
* DTO strategy for `dto.ts` files: [[ADR-003-zod-dto-strategy|ADR-003]]
* Repo/release context: [[ADR-001-monorepo-mirror|ADR-001]], [[ADR-002-release-tagging|ADR-002]]
* Living module template: `../../apps/api/src/modules/examples/`
* App composition root: `../../apps/api/src/app.module.ts`
