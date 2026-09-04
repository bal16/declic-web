# Development & Deployment Guide (Monorepo + C1 Mirrors)

**Stack:** Bun 1.4 · TanStack Start (web) · NestJS (api, worker) · PostgreSQL · Redis (BullMQ) · MinIO (S3-compatible)
**Repo decision:** `adr/ADR-001-monorepo-mirror.md` (source of truth `bal16/declic`, read-only mirrors per app)
**Infra spec:** `docker-compose.yml`, `env.example` · **Schema:** `db-schema.md` · **Seeds:** `seed.ts`

---

## 1. Repository map

Four GitHub repos. You only ever push to the first one:

| Repo | Visibility | Purpose |
|---|---|---|
| `bal16/declic` | Private | Monorepo source of truth. All development and PRs happen here. |
| `bal16/declic-web` | Public | Read-only mirror for the web app. Deploy target: Vercel. Portfolio-safe (no server secrets). |
| `bal16/declic-api` | Private | Read-only mirror for the API. Deploy target: Docker / long-running host. |
| `bal16/declic-worker` | Private | Read-only mirror for the worker. Deploy target: Docker / long-running host. |

## 2. Directory tree (target layout)

Current checkout has empty `apps/*` placeholders. The tree below is the target once scaffolding lands (ADR-001 §2). Files marked `(planned)` do not exist yet.

```text
declic/                              # bal16/declic (private monorepo)
├── package.json                     # (planned) workspaces: ["apps/*", "packages/*"]
├── bun.lock                         # (planned) single lockfile at root
├── bunfig.toml                      # (planned)
├── tsconfig.base.json               # (planned)
├── docker-compose.yml               # dev stack (exists, compose spec in docs/)
├── .env                             # local only, copied from .env.example (never committed)
├── .env.example                     # (planned) merged root env (see §4)
├── apps/
│   ├── web/                         # TanStack Start (Vite) — @declic/web
│   │   ├── package.json             # (planned) deps on workspace:* contracts/db
│   │   ├── Dockerfile               # (planned) root-context image, Vercel-compatible build
│   │   └── src/routes/…             # routes: /, /archive, /exhibition/$slug,
│   │                                #   /post/$postId (+ lightbox mask), /og/$postId,
│   │                                #   /dashboard/*, /admin/* (PRD-FE.md §2)
│   ├── api/                         # NestJS API + Better Auth — @declic/api
│   │   ├── package.json
│   │   ├── Dockerfile               # root-context image (`docker build -f apps/api/Dockerfile .`)
│   │   └── src/modules/…            # auth, users, exhibitions, posts/photo-items,
│   │                                #   curation, moderation, engagement, storage,
│   │                                #   queue, feature-flags, site-settings, audit
│   └── worker/                      # BullMQ consumer + Bun.Image — @declic/worker
│       ├── package.json
│       ├── Dockerfile               # root-context image (`docker build -f apps/worker/Dockerfile .`)
│       └── src/…                    # image-processing processor (PRD-Worker.md §3)
├── packages/
│   ├── contracts/                   # (planned) @declic/contracts — Zod DTOs, Phase/Status
│   │                                # enums, flag keys, queue job types
│   ├── db/                          # (planned) @declic/db — Drizzle schema (db-schema.md)
│   │   └── src/seed.ts              # (planned) moved from docs/seed.ts
│   └── tsconfig/                    # (planned) @declic/tsconfig — shared base configs
├── scripts/
│   └── mirror.sh                    # builds C1 mirror branches (manual run for now)
├── .github/workflows/
│   ├── ci.yml                       # verify + leak-guard (workflow_dispatch only for now)
│   └── mirror.yml                   # manual dispatch → update 3 mirrors (auto push disabled)
└── docs/
    ├── adr/
    │   └── ADR-001-monorepo-mirror.md
    ├── DEVELOPMENT.md               # this file
    ├── PRD.md / PRD-API.md / PRD-FE.md / PRD-Worker.md
    ├── db-schema.md / seed.ts / docker-compose.yml / env.example
```

Each C1 mirror contains its app plus the `packages/*` slice it needs, plus the root build manifest, so a standalone clone builds without the monorepo. Example (`declic-api` mirror):

```text
declic-api/ (mirror content, generated)
├── apps/api/
├── packages/contracts/ packages/db/ packages/tsconfig/
├── package.json / bunfig.toml
└── apps/api/Dockerfile
```

## 3. Prerequisites

* Bun 1.4 (`bun --version`), Git, Docker + Docker Compose.
* OAuth credentials for Google/GitHub (only needed to test login; the gallery itself runs without them).
* No global Nest CLIs required — everything runs through Bun (web dev runs via the Vite plugin).

## 4. Environment

Root `.env.example` (planned) merges `docs/env.example` plus service URLs. Copy it before first run:

```bash
cp .env.example .env
```

| Key | Used by | Notes |
|---|---|---|
| `POSTGRES_USER/PASSWORD/DB` | postgres service | Compose reads these with `pameranfoto*` defaults |
| `MINIO_ROOT_USER/PASSWORD`, `S3_BUCKET` | minio, api, worker | Dev defaults `minioadmin/minioadmin`, bucket `pameran-foto` |
| `DATABASE_URL`, `REDIS_URL` | api, worker | Point at `postgres`/`redis` service names inside Compose |
| `S3_ENDPOINT`, `S3_ACCESS_KEY/SECRET_KEY`, `S3_FORCE_PATH_STYLE` | api, worker | Path-style required for MinIO |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | api | URL is `http://localhost:3001` in dev |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | api | Empty = OAuth login disabled, rest of app still runs |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL` | web | `http://localhost:3001` in dev |

## 5. Development

### 5.1 First-time setup (monorepo)

```bash
git clone git@github.com:bal16/declic.git && cd declic
cp .env.example .env
bun install
bun run --filter "@declic/*" build
```

### 5.2 Full-stack dev via Compose (recommended)

Uses `docs/docker-compose.yml` services: postgres (5432), redis (6379), minio API (9000) + console (9001), api (3001), worker, web (3000).

```bash
docker compose up --build
# gallery:  http://localhost:3000
# api:      http://localhost:3001/api/feature-flags
# minio:    http://localhost:9001
```

Seed the database (flags, site settings, demo exhibition) after postgres is healthy:

```bash
bun packages/db/src/seed.ts
# legacy path docs/seed.ts stays as a shim until callers migrate
```

### 5.3 Per-app commands (Bun workspaces)

```bash
bun run --filter @declic/web dev      # TanStack Start (Vite) dev server
bun run --filter @declic/api dev      # NestJS API watch mode
bun run --filter @declic/worker dev   # BullMQ worker watch mode
bun run --filter "@declic/*" test     # all tests
bun run --filter "@declic/*" build    # all builds
```

Cross-cutting changes (schema, DTO, flag keys) are a single PR touching `packages/*` plus the affected apps — no version bumps or pointer commits.

### 5.4 Typical dev loop (upload → process → browse)

1. `docker compose up` and seed (§5.2).
2. Log in via OAuth (or stub), upload a SINGLE or SERIES work from `/dashboard/upload` (presigned PUT straight to MinIO, then `POST /api/posts` enqueues one job per frame).
3. Watch the worker generate thumbnail/web/lightbox derivatives + blurhash; the work flips `PROCESSING → PENDING`.
4. Approve in `/admin/moderation`, check ordering in `/admin/curate`, browse at `/`.

## 6. Mirrors (how the per-app repos stay updated)

You do not work in mirrors. The flow is:

```text
manual "Run workflow" on bal16/declic (`mirror.yml`, `workflow_dispatch`)
  → scripts/mirror.sh builds C1 slices (app + packages slice + manifest)
  → force-push to
    bal16/declic-web:main, bal16/declic-api:main, bal16/declic-worker:main
```

* Auto triggers are intentionally disabled: `mirror.yml` has only `workflow_dispatch` until the three mirror repos + `MIRROR_DEPLOY_KEY` secret exist (see the header comment in `mirror.yml`). Same for `ci.yml`.
* Auth: deploy key or bot PAT with write access to the three mirrors only.
* Each mirror has branch protection and a "read-only mirror of `bal16/declic` — do not push here" README.
* Leak-guard job fails the workflow if `apps/web` references server secrets or `apps/api|worker` paths (protects the public mirror).

Verifying a mirror standalone (example: web):

```bash
git clone git@github.com:bal16/declic-web.git /tmp/declic-web
cd /tmp/declic-web && bun install && bun run build
```

## 7. Deployment

Compose is the **dev** stack. Production splits by workload:

### 7.1 Web → Vercel (`bal16/declic-web`, public mirror)

Option 1 (recommended): connect Vercel to `bal16/declic-web`, project root = repository root.

Option 2: connect Vercel to `bal16/declic` with Root Directory = `apps/web`.

Required env on Vercel: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL` (production API origin — see §7.3 cookie constraint).

```bash
# sanity check locally before pushing
bun run --filter @declic/web build
```

### 7.2 API + worker → Docker / long-running host

Build from the **monorepo root** (context must include `packages/*`):

```bash
docker build -f apps/api/Dockerfile -t declic-api:latest .
docker build -f apps/worker/Dockerfile -t declic-worker:latest .
```

Or build from the mirrors (`bal16/declic-api`, `bal16/declic-worker`) — they already contain the needed `packages/*` slice, so the same commands work with `.` = mirror root. Provide production `DATABASE_URL`, `REDIS_URL`, `S3_*`, `BETTER_AUTH_*`, and OAuth secrets via the host's secret manager, never baked into the image.

The worker needs no inbound ports; scale it horizontally (`--scale worker=3` in Compose, or replicas on the host) rather than raising per-instance concurrency for 10–50 MB uploads.

### 7.3 Domain and cookie constraint (Better Auth)

From `PRD.md` §8.5: web and API must share one registrable domain (for example `app.<domain>` + `api.<domain>`) configured via Better Auth `trustedOrigins` plus API CORS, so the session cookie stays first-party. Fallback if that is impossible: reverse-proxy `/api/*` through the web domain. Native/mobile clients use the `bearer()` token plugin instead of cookies. Settle the production domains before configuring OAuth redirect URIs and CORS.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `bun install` in a mirror fails on `workspace:*` | Mirror built without its `packages/*` slice | Rebuild mirror via `scripts/mirror.sh` (C1); never hand-craft mirrors |
| Mirror did not update after dispatch | Mirror repos not created yet, `MIRROR_DEPLOY_KEY` missing/expired | Create the 3 repos, set/rotate the key, re-run `workflow_dispatch`; check logs |
| Web login loops / session missing in prod | Cross-domain cookie treated as third-party | Apply §7.3: same registrable domain + `trustedOrigins`, or `/api/*` proxy |
| Uploads stuck in `PROCESSING` | Worker down, Redis unreachable, or one frame failing | Check worker logs, BullMQ failed set (DLQ), MinIO key exists; retry the failed frame job |
| MinIO presign 403 | Wrong `S3_ENDPOINT` / credentials / bucket missing | Verify `.env`, `minio-init` bucket creation, `S3_FORCE_PATH_STYLE=true` |

---

## Cross references

* Repo decision and trade-offs: `adr/ADR-001-monorepo-mirror.md`
* Product vision and lifecycle: `PRD.md`
* API and worker specs: `PRD-API.md`, `PRD-Worker.md`, `PRD-FE.md`
* Schema and seeds: `db-schema.md`, `seed.ts`
