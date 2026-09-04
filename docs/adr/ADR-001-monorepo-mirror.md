# ADR-001: Monorepo Source of Truth + Per-App Read-Only Mirrors (C1)

**Status:** Accepted
**Date:** 2026-09-04
**Org:** bal16
**Deciders:** repo owner
**Related:** `../PRD.md` §6/§8.5, `../PRD-API.md` §1–§2/§4, `../PRD-Worker.md` §1.2, `../db-schema.md`, `../seed.ts`, `../docker-compose.yml`, `../DEVELOPMENT.md`

---

## 1. Context

Déclic has three runtimes that look like three apps but share one contract surface:

* `apps/web` — TanStack Start public gallery + photographer dashboard + admin UI (`PRD-FE.md` §2).
* `apps/api` — NestJS on Bun, owns Better Auth sessions, RBAC, presigned MinIO uploads, and enqueues one BullMQ job per `photo_items` row (`PRD-API.md` §1/§4).
* `apps/worker` — NestJS BullMQ consumer, regenerates `blurhash` + derivatives per frame with `Bun.Image` and promotes `posts.status` to `PENDING` (`PRD-Worker.md` §1–§3).

Shared surface (all must change together): `posts`/`photo_items` cuid2 ids, `exhibition_id` scoping, `feature_flags` row-per-flag kill-switches, `site_settings.max_series_size`, and the queue payload `{ postId, photoItemId, s3Key, curated }`.

Requirements for repo layout:

1. Each app must have its own Git repo (mixed public/private visibility on GitHub, independent deploys).
2. Local development must share code and `node_modules` via Bun (single runtime, Bun 1.4).
3. `docker-compose.yml` stays the development stack; production may use Vercel and/or other platforms.

## 2. Decision

Use a **private monorepo as the single source of truth** plus **automatic read-only mirrors per app (model C1)**:

| Repo | Visibility | Content (mirror = C1 slice) | Deploy target |
|---|---|---|---|
| `bal16/declic` | Private | Full monorepo (dev happens here) | CI + mirror fan-out |
| `bal16/declic-web` | Public | `apps/web` + `packages/*` slice + build manifest | Vercel |
| `bal16/declic-api` | Private | `apps/api` + `packages/*` slice + build manifest | Docker / long-running host |
| `bal16/declic-worker` | Private | `apps/worker` + `packages/*` slice + build manifest | Docker / long-running host |

Rules:

* Push and PRs go to `bal16/declic` only. Mirrors are never edited by hand.
* One lockfile: root `bun.lock`. Subdirectories do not commit their own lockfiles.
* Cross-package deps use `workspace:*` inside the monorepo.
* Model C1 means each mirror carries the `packages/*` slice it needs, so a standalone clone of a mirror still runs `bun install && bun run build` with no access to the monorepo.
* Mirroring is automated: `git subtree split` per app slice on every push to `main` (plus manual dispatch), force-updating the mirror's `main`.

## 3. Alternatives considered

### A. Fully separate repos, no superproject — rejected

Each app fully independent; sharing via published `@declic/*` packages (GitHub Packages/npm).

* Pros: strongest isolation, per-app versioning.
* Cons: loses Bun workspace sharing; every schema/contract change needs coordinated PRs across 3+ repos plus a publish step; slowest iteration for a tightly coupled surface. Revisit only if each app gets its own team and release cadence.

### B. Superproject + git submodules — rejected

Root repo with `apps/web`, `apps/api`, `apps/worker` (and `packages/*`) as submodules, each its own repo.

* Pros: each app genuinely has its own Git history; mixed visibility works.
* Cons: daily submodule tax (detached HEAD, forgotten `submodule update`, pointer-bump commits per contract change), CI needs `recurse-submodules` + PAT for private submodules, and a standalone submodule clone cannot resolve `workspace:*` deps. Version drift across modules is likely at this team size.

### C. This ADR (monorepo + auto-mirror C1) — accepted

Keeps monorepo DX (one PR for a cross-cutting change, one lockfile, `bun --filter`) while still producing one Git repo per app for visibility and deployment.

## 4. Consequences

* Positive: single PR for schema/API/worker/web changes; `docker-compose.yml` dev layout (`./apps/*`) keeps working; public portfolio repo (`declic-web`) without leaking server code.
* Negative: `packages/*` is duplicated into mirrors (accepted — mirrors are generated artifacts, never edited).
* Guardrails required: branch protection + "read-only mirror" README on mirrors; CI leak-guard so no server secret reaches the public web mirror; deploy keys or a bot PAT scoped to the three mirrors.
* Deploy constraint is orthogonal but recorded here: Better Auth cookies require web + API under one registrable domain (`app.*` + `api.*` with `trustedOrigins`/CORS) or an `/api/*` reverse proxy through the web domain (`PRD.md` §8.5). Splitting repos does not split domains.

## 5. Verification

* `bun install --frozen-lockfile` clean at root; `bun run --filter "@declic/*"` builds pass.
* `docker compose up --build` brings up postgres, redis, minio, api, worker, web.
* A dummy push to `bal16/declic:main` updates all three mirrors to the same content revision.
* A standalone clone of each mirror builds with `bun install && bun run build`.
* Leak-guard CI is green (no secret or `apps/api|worker` reference inside `apps/web`).

---

## Cross references

* Repo layout, dev commands, and deploy flow: `../DEVELOPMENT.md`
* Product vision and roles: `../PRD.md`
* API schema and endpoints: `../PRD-API.md`
* Worker pipeline: `../PRD-Worker.md`
* Canonical schema diagram: `../db-schema.md`
* Seeds: `../seed.ts` (moving to `packages/db/src/seed.ts`; see `../DEVELOPMENT.md`)
