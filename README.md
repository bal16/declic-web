# Déclic

Curated online photo exhibitions for UKM Fotografi & Sinematografi CLIC UNNES.
Multiple photographers submit works under individual accounts, an admin curates
every submission, and the site shows the latest published exhibition at `/`
with older editions kept as a permanent archive.

Status: pre-release (`0.x`). Product spec is at draft `0.4-draft`.
App version `1.0.0` ships at the first exhibition launch.

## Stack (Development)

- Runtime: Bun 1.4 (monorepo workspaces `apps/*`, `packages/*`)
- Frontend: TanStack Start (`apps/web`)
- API: NestJS + Better Auth, OAuth-only Google + GitHub (`apps/api`)
- Worker: NestJS + BullMQ (`apps/worker`)
- Infra: PostgreSQL 16, Redis 7, MinIO (S3-compatible)
- Shared: Zod DTOs (`packages/contracts`), Drizzle (`packages/db`)

## Quickstart

Prerequisites: Bun 1.4, Git, and a container runtime (Docker or Podman).

```bash
cp .env.example .env
docker compose up -d
bun install
bun run dev
```

URLs (dev):

- Web: <http://localhost:3000>
- API: <http://localhost:3001> (`/health`)
- MinIO console: <http://localhost:9001>
- Postgres: `localhost:5432`, Redis: `localhost:6379`

Full stack via Compose (apps profile):

```bash
docker compose --profile apps up -d
```

## Repo map

```text
.
├── apps/
│   ├── web/        # TanStack Start frontend
│   ├── api/        # NestJS API + auth
│   └── worker/     # BullMQ image-processing worker
├── packages/
│   ├── contracts/  # Zod DTO source of truth
│   ├── db/         # Drizzle schema + seed
│   └── tsconfig/   # shared strict TS config
├── scripts/        # mirror.sh, check-coverage.ts, sync-docs-mirrors.ts
├── docs/           # PRD, API/FE/Worker specs, schema, dev guide
└── docker-compose.yml
```

Development happens in this monorepo only (`bal16/declic`, private).
Per-app read-only mirrors (`declic-web`, `declic-api`, `declic-worker`)
are generated automatically — see `docs/guides/DEVELOPMENT.md`.

## Scripts

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `bun run dev`       | Dev servers for all apps           |
| `bun run build`     | Production build for all apps      |
| `bun run test`      | Unit tests for all apps            |
| `bun run test:e2e`  | End-to-end tests for all apps      |
| `bun run typecheck` | TypeScript check per app           |
| `bun run lint`      | `oxlint` over the repo             |
| `bun run format`    | `oxfmt` over the repo              |
| `bun run coverage`  | Coverage gate (≥90% lines per app) |

Git hooks: `bunx lefthook install` once per clone (staged `oxlint --fix` + `oxfmt`).

## Docs

Start with `docs/guides/DEVELOPMENT.md` for the dev loop, environment, mirrors,
and releases.

| Doc                        | Contents                                             |
| -------------------------- | ---------------------------------------------------- |
| `docs/specs/PRD.md`        | Vision, roles, exhibition lifecycle, archive rules   |
| `docs/specs/PRD-API.md`    | Modules, schema text, cursor/error/flag contracts    |
| `docs/specs/PRD-FE.md`     | Routes, upload/lightbox/curation UI, auth guards     |
| `docs/specs/PRD-Worker.md` | Per-frame pipeline, retry/DLQ, memory budget         |
| `docs/data/db-schema.md`   | Canonical ER diagram + seeds summary                 |
| `docs/features/`           | One acceptance file per feature (vertical slice)     |
| `docs/adr/`                | Architecture decisions (monorepo, releases, logging) |

Note: files under `docs/` use Obsidian-style `[[wikilinks]]` for the
internal knowledge graph. This root README intentionally stays plain
GitHub-flavored Markdown.
