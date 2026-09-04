# Development & Deployment Guide (Monorepo + C1 Mirrors)

**Stack:** Bun 1.4 · TanStack Start (web) · NestJS (api, worker) · PostgreSQL · Redis (BullMQ) · MinIO (S3-compatible)
**Repo decision:** `adr/ADR-001-monorepo-mirror.md` (source of truth `bal16/declic`, read-only mirrors per app)
**Release decision:** `adr/ADR-002-release-tagging.md` (single `vX.Y.Z` tag, rc-only, deploy deferred)
**Infra spec:** `docker-compose.yml`, `env.example` · **Schema:** `db-schema.md` · **Seeds:** `seed.ts`

---

## 1. Repository map

Four GitHub repos. You only ever push to the first one:

| Repo | Visibility | Purpose |
|---|---|---|
| `bal16/declic` | Private | Monorepo source of truth. All development and PRs happen here. |
| `bal16/declic-web` | Public | Read-only mirror for the web app. Deploy target: TBD (Vercel explicitly out). Portfolio-safe (no server secrets). |
| `bal16/declic-api` | Private | Read-only mirror for the API. Deploy target: TBD (Docker image available). |
| `bal16/declic-worker` | Private | Read-only mirror for the worker. Deploy target: TBD (Docker image available). |

Production images are published to GHCR on release tags (`ghcr.io/bal16/declic-<app>:vX.Y.Z`, see §8).

## 2. Directory tree (actual layout)

Generated from `git ls-files` — this tree describes what exists, not a plan.
Items marked `(next)` are the known remaining gaps.

```text
declic/                              # bal16/declic (private monorepo)
├── package.json                     # workspaces: ["apps/*", "packages/*"] + root scripts
├── bun.lock                         # single lockfile at root (frozen in CI)
├── bunfig.toml                      # shared Bun config
├── .gitignore / .dockerignore / .editorconfig
├── .env                             # local only, copied from .env.example (never committed)
├── .env.example                     # merged root env (see §4)
├── .oxlintrc.json                   # oxlint: correctness=error, web hooks override (§6)
├── .oxfmtrc.jsonc                   # oxfmt: width 80, single quotes, import+tailwind sort (§6)
├── lefthook.yml                     # pre-commit: staged oxlint --fix + oxfmt (stage_fixed)
├── apps/
│   ├── web/                         # TanStack Start (Vite) — @declic/web
│   │   ├── package.json / tsconfig.json / vite.config.ts
│   │   ├── Dockerfile               # two-stage, serves Nitro .output
│   │   ├── src/
│   │   │   ├── router.tsx           # getRouter() factory + Register augmentation
│   │   │   ├── routes/__root.tsx + index.tsx
│   │   │   ├── routeTree.gen.ts     # generated AND committed (typecheck needs it)
│   │   │   ├── styles.css           # Tailwind v4 entry (oxfmt sort reference)
│   │   │   └── lib/env.ts           # VITE_* config (VITE_API_URL, VITE_BETTER_AUTH_URL)
│   │   └── test/home.e2e.test.ts    # boots Nitro build, fetches / over HTTP
│   ├── api/                         # NestJS API + Better Auth — @declic/api
│   │   ├── package.json / tsconfig.json / Dockerfile
│   │   └── src/                     # main.ts, app.module.ts (+controller/service, /health)
│   │       └── test/…               # unit (*.test.ts) + e2e (test/health.e2e.test.ts)
│   │   # (next) feature modules per PRD-API.md §1.1 (auth, posts, queue, …)
│   └── worker/                      # BullMQ consumer + Bun.Image — @declic/worker
│       ├── package.json / tsconfig.json / Dockerfile (no EXPOSE)
│       └── src/                     # main.ts (app context), worker.module.ts
│           └── test/…               # unit + e2e (context lifecycle)
│       # (next) image-processing consumer per PRD-Worker.md §3
├── packages/
│   ├── contracts/                   # @declic/contracts — zod (DTO source of truth, next: schemas)
│   ├── db/                          # @declic/db — (next) Drizzle schema + seed from docs/seed.ts
│   └── tsconfig/base.json           # shared strict TS config (decorator metadata on)
├── scripts/
│   ├── mirror.sh                    # builds C1 mirror branches (used by mirror.yml)
│   └── check-coverage.ts            # coverage gate: ≥90% lines per app (used by release.yml)
├── .github/workflows/
│   ├── ci.yml                       # verify + leak-guard (workflow_dispatch only)
│   ├── mirror.yml                   # push to main → update 3 mirrors (automatic)
│   └── release.yml                  # push tags v* → gates + GHCR + GitHub Release (§8)
├── .vscode/
│   ├── settings.json                # oxc formatter/linter on save; eslint+prettier disabled
│   └── extensions.json              # recommends oxc, tailwind, markdownlint, editorconfig
└── docs/
    ├── adr/ADR-001-monorepo-mirror.md + ADR-002-release-tagging.md
    ├── DEVELOPMENT.md               # this file
    ├── PRD.md / PRD-API.md / PRD-FE.md / PRD-Worker.md
    └── db-schema.md / seed.ts / docker-compose.yml / env.example
    # (next) root docker-compose.yml materialized from the docs/ spec
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

* Bun 1.4 (`bun --version`), Git, `gh` CLI (authed as repo owner for mirror/release ops).
* Container runtime: **Podman** (verified: all three images build + boot-test under podman 6). Plain `docker` works wherever Docker runs — Dockerfiles use the fully-qualified `docker.io/oven/bun:1.4` base for both.
* OAuth credentials for Google/GitHub (only needed to test login later; nothing needs them yet).
* No global Nest/Vite CLIs — everything runs through Bun. One install per clone: `bunx lefthook install` (git hooks; local-only).

## 4. Environment

Root `.env.example` merges `docs/env.example` plus service URLs. Copy it before first run:

```bash
cp .env.example .env
```

| Key | Used by | Notes |
|---|---|---|
| `POSTGRES_USER/PASSWORD/DB`, `DATABASE_URL` | postgres, api, worker | `DATABASE_URL` points at the `postgres` service name inside Compose |
| `REDIS_URL` | api, worker | Points at the `redis` service name inside Compose |
| `MINIO_ROOT_USER/PASSWORD`, `S3_BUCKET` | minio | Dev defaults `minioadmin/minioadmin`, bucket `pameran-foto` |
| `S3_ENDPOINT`, `S3_ACCESS_KEY/SECRET_KEY`, `S3_FORCE_PATH_STYLE` | api, worker | Path-style required for MinIO; endpoint is localhost outside Compose |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | api | URL is `http://localhost:3001` in dev |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | api | Empty = OAuth login disabled, rest of app still runs |
| `VITE_API_URL`, `VITE_BETTER_AUTH_URL` | web | `http://localhost:3001` in dev (`VITE_` prefix = client-exposed) |

## 5. Development

### 5.1 First-time setup (monorepo)

```bash
git clone https://github.com/bal16/declic.git && cd declic
cp .env.example .env
bun install --frozen-lockfile
bunx lefthook install
bun run lint && bun run format:check && bun run --filter "@declic/*" typecheck
```

Notes: remote is HTTPS (via `gh auth`), not SSH. `bun run --filter "@declic/*" build` runs each workspace's `build` script and silently skips workspaces that do not define one (`contracts/db/tsconfig` have no build step).

### 5.2 Full-stack dev via Compose (not yet materialized)

The target stack (postgres 5432, redis 6379, minio 9000+9001, api 3001, worker, web 3000) is specified in `docs/docker-compose.yml`, but no root `docker-compose.yml` exists yet. Until it lands, run each app directly (§5.3) with `cp .env.example .env`. The compose file, when written, must use image builds with root context (`podman build -f apps/<app>/Dockerfile .`) or the `:latest`/release images from GHCR.

Seeding (after `packages/db` lands): `bun packages/db/src/seed.ts` for flags, site settings, and the demo exhibition. `docs/seed.ts` is the current source of truth.

### 5.3 Per-app commands (Bun workspaces)

```bash
bun run --filter @declic/web dev        # TanStack Start (Vite) dev server (:3000)
bun run --filter @declic/api dev        # NestJS API watch mode (PORT=3001)
bun run --filter @declic/worker dev     # worker watch mode (exits 0 until BullMQ lands)
```

`dev` scripts load the workspace-root `.env` explicitly: api/worker via
`bun --env-file ../../.env` (NestJS `ConfigModule` on its own only reads `.env` from the process
cwd, which is wrong when running inside `apps/*`), web via Vite
`envDir: '../../'` in `vite.config.ts`
(Vite defaults to `apps/web/.env`). Only `VITE_*` vars reach the browser.
`start` scripts intentionally load nothing: production env comes from the
environment (Docker/host), never from a file.
bun run --filter "@declic/*" test       # unit tests (src/)
bun run --filter "@declic/*" test:e2e   # e2e tests (test/, web needs build output first)
bun run --filter "@declic/*" build      # per-app builds
bun run coverage                        # coverage gate: >=90% lines per app (§8)
bun run lint / lint:fix / format / format:check   # oxlint + oxfmt, repo-wide
```

Cross-cutting changes (schema, DTO, flag keys) are a single PR touching `packages/*` plus the affected apps — no version bumps or pointer commits.

### 5.4 Typical dev loop (target flow, wires landing incrementally)

1. Start apps (§5.3) and, once Compose lands, `podman-compose up` + seed.
2. Log in via OAuth (or stub), upload a SINGLE or SERIES work from `/dashboard/upload` (presigned PUT straight to MinIO, then `POST /api/posts` enqueues one job per frame).
3. Watch the worker generate thumbnail/web/lightbox derivatives + blurhash; the work flips `PROCESSING → PENDING`.
4. Approve in `/admin/moderation`, check ordering in `/admin/curate`, browse at `/`.

## 6. Code quality (oxlint + oxfmt, pre-commit)

Single Rust toolchain, exact-pinned (`oxlint@1.81.0`, `oxfmt@0.66.0`):

* **Format** (`.oxfmtrc.jsonc`): width 80, single quotes, import sorting, Tailwind class sorting against `apps/web/src/styles.css`. Generated output (`.output/`, `dist/`, `routeTree.gen.ts`) and `docs/**` are ignored — Markdown prose stays under `markdownlint-cli2`.
* **Lint** (`.oxlintrc.json`): `correctness` = error everywhere, `react/hooks` baseline, plus an `apps/web/**` override block with stricter hooks rules (`react/rules-of-hooks`, `react/exhaustive-deps`) and test leniency (`no-explicit-any` off in tests).
* **Known oxlint fact:** nested per-directory configs (e.g. `apps/web/.oxlintrc.json`) are silently ignored in 1.81 — per-app strictness lives in root `overrides`, verified empirically. Do not reintroduce nested configs without re-verifying.
* **Gates:** Lefthook pre-commit (staged-only, `stage_fixed` so fixes land in the same commit; install per clone) and the `lint` job in `ci.yml`. VS Code uses `oxc.oxc-vscode` for format+fix on save; ESLint/Prettier extensions are disabled via settings + `unwantedRecommendations`.
* **JSON/YAML:** covered by oxfmt (it already normalizes `package.json` key order and workflow YAML). JSON *lint* (schemas) comes from `$schema` keys + editor support, not oxlint.

## 7. Mirrors (how the per-app repos stay updated)

You do not work in mirrors. The flow is:

```text
every push to bal16/declic:main (`mirror.yml`, `push` trigger)
  → scripts/mirror.sh builds C1 slices (app + packages slice + manifest)
  → force-push to
    bal16/declic-web:main, bal16/declic-api:main, bal16/declic-worker:main
```

* `mirror.yml` also supports manual `workflow_dispatch` (all or one app).
  `ci.yml` stays manual-only.
* Tag pushes do **not** trigger mirrors (workflow listens to `main` only).
* Auth: one read-write deploy key per mirror (GitHub keys cannot be
  shared across repos), stored as `MIRROR_WEB/API/WORKER_KEY` secrets in
  `bal16/declic`. Checkout uses `GITHUB_TOKEN`; pushes use per-app keys
  via `GIT_SSH_COMMAND` (dynamic secret names are unsupported).
* Mirrors carry no branch protection by design: PR/check/push restrictions
  would block the automation's force-pushes. Trust comes from the
  read-only convention (generated README), sole-writer deploy keys, and
  full rebuilds from `main` on every run.
* Leak-guard (in `ci.yml`) fails the run if `apps/web` references server secrets or `apps/api|worker` paths (protects the public mirror).

Verifying a mirror standalone (example: web):

```bash
git clone https://github.com/bal16/declic-web.git /tmp/declic-web
cd /tmp/declic-web && bun install && bun run build
```

## 8. Release (tag-driven, deploy deferred)

Full scheme: `adr/ADR-002-release-tagging.md`. Summary:

* One tag `vX.Y.Z` releases all apps; pre-releases rc-only (`v0.3.0-rc.N`); no snapshot tags (registry-only `:main-<sha>` later); MAJOR `0` until the first exhibition. Tags always annotated, never moved.
* `release.yml` (trigger `push` on `tags: ['v*']` + manual dry-run): full gates on the tagged tree (typecheck, unit, build, e2e, **coverage ≥90% lines per app**, lint, format check, leak-guard) → GHCR images (`:vX.Y.Z`, plus `:latest` on finals only, never on rc) → GitHub Release (auto-prerelease on `-rc`).
* `deploy` job is a disabled stub — deploy targets are undecided.
* Trial `v0.0.0-rc.1` already validated the pipeline end-to-end (since deleted; its GHCR images await manual deletion — CLI token lacks `packages` scope, use web UI).

## 9. Deployment

Compose/dev (§5.2) is local. Production artifacts come from releases (§8):

### 9.1 Images (available today)

Built from the **monorepo root** (context must include `packages/*`):

```bash
podman build -f apps/api/Dockerfile -t declic-api:local .
podman build -f apps/worker/Dockerfile -t declic-worker:local .
podman build -f apps/web/Dockerfile -t declic-web:local .
```

All three have been built and boot-tested under podman 6 (api `/health` → ok, worker context ready, web serves SSR HTML with 200). Base image is `docker.io/oven/bun:1.4` (fully qualified — bare short-names fail podman resolution without `registries.conf`). Or pull release images from GHCR instead of building. Provide production `DATABASE_URL`, `REDIS_URL`, `S3_*`, `BETTER_AUTH_*`, and OAuth secrets via the host's secret manager, never baked into images.

The worker needs no inbound ports; scale it horizontally (replicas, not per-instance concurrency) rather than raising concurrency for 10–50 MB uploads. Graceful shutdown (`enableShutdownHooks`) is a known follow-up — `podman stop` currently falls back to SIGKILL.

### 9.2 Per-app destinations (TBD)

Web (Vercel explicitly out), api, and worker destinations are undecided — the project is still in development. The `deploy` job in `release.yml` stays disabled until they are. Related constraint to settle first: §9.3.

### 9.3 Domain and cookie constraint (Better Auth)

From `PRD.md` §8.5: web and API must share one registrable domain (for example `app.<domain>` + `api.<domain>`) configured via Better Auth `trustedOrigins` plus API CORS, so the session cookie stays first-party. Fallback if that is impossible: reverse-proxy `/api/*` through the web domain. Native/mobile clients use the `bearer()` token plugin instead of cookies. Settle the production domains before configuring OAuth redirect URIs and CORS.

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `bun install` in a mirror fails on `workspace:*` | Mirror built without its `packages/*` slice | Rebuild mirror via `scripts/mirror.sh` (C1); never hand-craft mirrors |
| Mirror did not update after push/dispatch | Deploy key expired/rotated, or workflow YAML invalid (fails fast, 0s runs) | Rotate the per-app key + secret, re-run `workflow_dispatch`; check logs |
| Release blocked on coverage | An app dropped below 90% lines | `bun run coverage` locally, add tests, re-tag (never move the old tag) |
| Cannot delete GHCR trial images via CLI | Token lacks `packages` scope | Delete via web UI (package → settings → delete version) |
| `vite build` fails: ESM-only plugin loaded by `require` | Web `package.json` lost `"type": "module"` | Restore it — Vite bundles config as CJS without it |
| `vite build` produces no `.output/` | Missing `nitro()` plugin in `vite.config.ts` | Current Start requires the separate `nitro/vite` plugin |
| `routeTree.gen.ts` type errors on fresh clone | Generated file missing | Run `bun run --filter @declic/web build` once (file is committed, regenerates deterministically) |
| Per-app oxlint config ignored | Nested `.oxlintrc.json` files are silently ignored (verified 1.81) | Express per-app rules in root `overrides`, never nested files |
| `podman build` fails resolving `oven/bun` | Short-name needs `registries.conf` | Dockerfiles already use fully-qualified `docker.io/oven/bun:1.4` |
| Web login loops / session missing in prod | Cross-domain cookie treated as third-party | Apply §9.3: same registrable domain + `trustedOrigins`, or `/api/*` proxy |
| Uploads stuck in `PROCESSING` | Worker down, Redis unreachable, or one frame failing | Check worker logs, BullMQ failed set (DLQ), MinIO key exists; retry the failed frame job |
| MinIO presign 403 | Wrong `S3_ENDPOINT` / credentials / bucket missing | Verify `.env`, `minio-init` bucket creation, `S3_FORCE_PATH_STYLE=true` |

---

## Cross references

* Repo decision and trade-offs: `adr/ADR-001-monorepo-mirror.md`
* Release/tag decision, limits analysis: `adr/ADR-002-release-tagging.md`
* Release workflow + coverage gate: `../../.github/workflows/release.yml`, `../../scripts/check-coverage.ts`
* Product vision and lifecycle: `PRD.md`
* API and worker specs: `PRD-API.md`, `PRD-Worker.md`, `PRD-FE.md`
* Schema and seeds: `db-schema.md`, `seed.ts`
