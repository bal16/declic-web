# ADR-005: Modular Monolith Boundaries for apps/api (Proposed)

**Status:** Proposed
**Date:** 2026-09-04
**Org:** bal16
**Deciders:** repo owner
**Related:** `../PRD-API.md` §1.1, `../db-schema.md`, `ADR-001-monorepo-mirror.md`, `ADR-003-zod-dto-strategy.md`, `../../apps/api/src/app.module.ts`

---

## 1. Context

Repo-level architecture is decided: one monorepo source of truth with three
deployables (`apps/web`, `apps/api`, `apps/worker`) plus shared
`packages/contracts` and `packages/db`. Code-level architecture inside
`apps/api` is not decided: today it contains only `AppModule`, health, docs,
logging, and the temporary `modules/examples/` scaffold. `PRD-API.md` §1.1
lists twelve modules but states no boundary rules, so without this ADR the
API will drift into a big ball of mud with cross-module imports and
competing writers to the same tables.

## 2. Decision

Keep `apps/api` one deployable wireframe, but enforce hard module
boundaries so any module can later move without a rewrite: a **modular
monolith**, not microservices.

### Rule 1 — Public surface per module

Each module exposes exactly one importable surface:

```text
apps/api/src/modules/<name>/
├── public-api.ts        # facade services, events, DTO re-exports ONLY
├── <name>.module.ts
├── <name>.controller.ts # HTTP only; no business logic
├── <name>.service.ts    # business logic, private to the module
└── *.test.ts            # co-located unit tests
```

Cross-module imports are allowed only from:

* the same module,
* `apps/api/src/common/` (guards, interceptors, filters, decorators),
* shared packages (`@declic/contracts`, `@declic/db`) and libraries,
* `<other-module>/public-api(.ts)` — never deep files.

Forbidden example: `import { XService } from '../curation/x.service'`.
Allowed: `import { type CurationFacade } from '../curation/public-api'`.
`modules/examples/` is exempt only until deleted (it is scaffolding, not
a boundary citizen).

### Rule 2 — Table ownership (one writer per table)

| Module | Owns (writes) | Reads (no writes) |
|---|---|---|
| `auth` | Better Auth `sessions`, `accounts`, `verification` | `users` session identity |
| `users` | `users.role`, profile fields | auth session context |
| `exhibitions` | `exhibitions` rows + slug/phase lifecycle | — |
| `posts` | `posts`, `photo_items` creation records | `exhibitions.phase`, flags |
| `worker` (separate app) | `photo_items.blurhash`, `photo_derivatives` rows | job payload `{postId, photoItemId, s3Key, curated}` |
| `curation` | ordering operations only, via `posts` facade | `posts.display_order` (no raw writes) |
| `moderation` | status transitions only, via `posts` facade | `posts.status`, `rejection_reason` (no raw writes) |
| `engagement` | `likes`, `comments` rows | counters via `posts` facade in the same transaction |
| `feature-flags` | `feature_flags` rows | — |
| `site-settings` | `site_settings` singleton (`id=1`) | — |
| `audit` | `admin_audit_logs` (append-only) | events from all modules (never direct calls) |
| `storage` | no tables (MinIO keys referenced by `posts`/`exhibitions`) | object existence checks |
| `queue` | no domain tables (BullMQ jobs only) | payloads defined in `@declic/contracts` |

Rationale for facades: `posts.display_order`, `posts.status`,
`likes_count`, and `comments_count` live on `posts` but change for
curation, moderation, and engagement reasons. Exactly one code path
(`posts` facade) writes them, so counters and ordering stay consistent
under the `ARCHIVED` freeze.

### Rule 3 — Shared kernel only

The only shared code is `packages/contracts` (Zod DTOs), `packages/db`
(schema), `apps/api/src/common/`, and framework libraries. No
module-to-module DTO, repository, or helper imports.

### Rule 4 — Enforcement in CI

Add `scripts/check-boundaries.ts` (same pattern as
`scripts/check-coverage.ts`): fail on imports matching
`../<other-module>/` unless the path ends in `/public-api`, and fail on
cross-module Drizzle table writes outside the ownership map. Run it in
`ci.yml` and the release `verify` job. Prefer the repo script over an
oxlint import rule unless the oxlint rule is empirically verified first
(oxlint nested-config behavior already surprised us once).

### Event catalog (initial, notifications only — DB stays source of truth)

In-process domain events (same deployable): `PostCreated`,
`PostStatusChanged`, `FramesReordered`, `PostDisplayOrderChanged`,
`ExhibitionPhaseChanged`, `PhotoItemReplaced`, `CommentHidden`,
`FeatureFlagToggled`, `SiteSettingsUpdated`. Cross-app seam stays on
BullMQ payloads (`image-processing` per frame, `exhibition-scheduler`
cron), typed in `@declic/contracts`. No event sourcing.

### Migration path

A module becomes extractable when it has a facade, owns its tables, and
communicates only through events/contracts. The known future seam is the
worker: it already crosses the process boundary via queue payloads, so
`posts` creation records (API) vs derivative writes (worker) must never
be merged into one writer.

## 3. Alternatives considered

* **Layered monolith without ownership rules** — rejected: reproduces the
  current risk (competing writers, deep imports) with nicer folder names.
* **Microservices per PRD module now** — rejected: pre-1.0 ops cost
  (deploy, auth, transactions across services) with no scaling need yet.
* **Shared everything via `common/`** — rejected: `common/` becomes a
  dumping ground; facades keep blast radius per feature.

## 4. Open questions (resolved 1–3; 4 still blocks polish, not structure)

1. Photographer withdraw — **decided IN for 1.0:** `DELETE /api/posts/:id`,
   owner-or-admin, `PENDING`-only (`409 WITHDRAW_CLOSED` otherwise),
   soft-delete via `deleted_at`, engagement rows kept but hidden
   (see `PRD-API.md` §4.4).
2. Poster upload — **decided:** reuse `POST /api/posts/upload-url`, no
   dedicated endpoint (see `PRD-API.md` §4.5).
3. Curator revert — **decided IN for 1.0:**
   `POST /api/admin/photo-items/:itemId/revert` as single-level undo of
   the latest replace, with `FRAME_PROCESSING` / `ORIGINAL_MISSING` /
   `NOTHING_TO_REVERT` guards and its own `photo_item.revert` audit row
   (see `PRD-API.md` §4.4). Implementation waits for the foundation chain
   (DB → posts module → replace endpoint → worker); the contract above is
   the build target.
4. Still open — define `DRAFT` vs `PRE_EVENT`, exact opaque cursor schema,
   global error shape, `GET /api/admin/audit-logs` query contract, and
   upload throttling — or explicitly defer each past 1.0.

## 5. Verification

Docs-only change: `markdownlint-cli2` clean, no app code touched. Code
enforcement (`scripts/check-boundaries.ts` + CI wiring) is a separate
implementation step after Q1–Q4 above are resolved.

---

## Cross references

* Module list: `../PRD-API.md` §1.1
* Schema: `../db-schema.md`
* Current skeleton: `../../apps/api/src/app.module.ts`
* DTO strategy: `ADR-003-zod-dto-strategy.md`
