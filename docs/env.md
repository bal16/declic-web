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

Copy to root `.env` before first run: `cp docs/env.example .env`
(merged root `.env.example` adds service URLs — see [[DEVELOPMENT]] §4).
Never commit real secrets (see `.gitignore`).

| Group | Keys |
|---|---|
| Postgres | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| MinIO / S3 | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `S3_BUCKET` (+ `S3_*` in root example) |
| Better Auth | `BETTER_AUTH_SECRET` (dev-only default), Google/GitHub OAuth `*_CLIENT_ID/SECRET` (empty = login disabled) |

> [!warning] Source of truth is `docs/env.example`, not this note.
> Edit that file, then run `bun scripts/sync-docs-mirrors.ts`.

<!-- sync:env start -->
```bash
# Copy this file to .env before running `docker compose up`

# Postgres
POSTGRES_USER=declic
POSTGRES_PASSWORD=declic
POSTGRES_DB=declic_dev

# MinIO (S3-compatible)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_BUCKET=declic

# Better Auth (mounted on the NestJS API — OAuth-only: Google + GitHub)
BETTER_AUTH_SECRET=12430e12-d3a9-40d4-bdfa-58a9d1b4e76f
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```
<!-- sync:env end -->
