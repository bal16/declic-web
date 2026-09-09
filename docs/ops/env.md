---
aliases:
  - Env Vars
  - Environment
tags:
  - declic
  - infra
  - env
status: living
---

# Environment Variables

Copy to root `.env` before first run: `cp .env.example .env`
(see [DEVELOPMENT](../guides/DEVELOPMENT.md) §4). Never commit real secrets
(see `.gitignore`).

| Group | Keys |
|---|---|
| Postgres | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` |
| Queue | `REDIS_URL` |
| MinIO / S3 | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE` |
| Logging | `LOG_LEVEL` (commented default) |
| Better Auth | `BETTER_AUTH_SECRET` (dev-only default), Google/GitHub OAuth `*_CLIENT_ID/SECRET` (empty = login disabled) |
| Frontend | `VITE_API_URL`, `VITE_BETTER_AUTH_URL` |

> [!warning] Source of truth is root `.env.example`, not this note.
> Edit that file, then run `bun scripts/sync-docs-mirrors.ts`.

<!-- sync:env start -->
```bash
# Copy this file to .env before running `bun install` / `docker compose up`.
# See docs/guides/DEVELOPMENT.md §4. Never commit .env with real secrets.

# Postgres
POSTGRES_USER=declic
POSTGRES_PASSWORD=declic
POSTGRES_DB=declic_dev
DATABASE_URL=postgres://declic:declic@postgres:5432/declic_dev

# Queue
REDIS_URL=redis://redis:6379

# App ports (Compose sets these per service; uncomment for host runs)
# PORT=3001

# MinIO (S3-compatible)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_BUCKET=declic
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

# Logging (api + worker, direct Pino per ADR-004; debug/dev default, info/prod default)
# LOG_LEVEL=debug
# Better Auth (mounted on the NestJS API — OAuth-only: Google + GitHub)
BETTER_AUTH_SECRET=dev-only-change-me
BETTER_AUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Frontend (TanStack Start — client vars use the VITE_ prefix)
VITE_API_URL=http://localhost:3001
VITE_BETTER_AUTH_URL=http://localhost:3001
```
<!-- sync:env end -->
