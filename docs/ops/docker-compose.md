---
aliases:
  - Compose Stack
  - Docker Compose
tags:
  - declic
  - infra
  - docker
status: living
---

# Docker Compose Stack

Local dev stack for Déclic: Postgres + Redis + MinIO plus the three
Bun services (`api`, `worker`, `web`). Production parity comes from the
same images (`apps/*/Dockerfile`, see [DEVELOPMENT](../guides/DEVELOPMENT.md) §9).

| Service      | Image                | Ports                     | Depends on                            |
| ------------ | -------------------- | ------------------------- | ------------------------------------- |
| `postgres`   | `postgres:16-alpine` | `5432`                    | — (healthy: `pg_isready`)             |
| `redis`      | `redis:7-alpine`     | `6379`                    | — (healthy: `ping`)                   |
| `minio`      | `minio/minio:RELEASE.2025-09-07T16-13-09Z` | `9000` S3, `9001` console | —                                     |
| `minio-init` | `minio/mc:RELEASE.2025-08-13T08-35-41Z`    | —                         | `minio` healthy (creates bucket once) |
| `api`        | `oven/bun:1.4.2`     | `3001`                    | postgres, redis, minio healthy        |
| `worker`     | `oven/bun:1.4.2`     | —                         | redis, minio healthy                  |
| `web`        | `oven/bun:1.4.2`     | `3000`                    | `api`                                 |

Three modes (`api`/`worker`/`web` carry `profiles: ["apps"]`).
Run from the repo root (`cp .env.example .env` once):

```bash
docker compose up -d                 # 1. infra only (daily dev)
docker compose --profile apps up -d  # 2. infra + apps in dev containers
# 3. infra + prebuilt apps (see DEVELOPMENT §9.1.1):
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod --profile prod up -d          # pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod --profile prod up -d --build  # auto-build
```

Root `docker-compose.yml` is materialized from this spec (see
[DEVELOPMENT](../guides/DEVELOPMENT.md) §5.2). Env values come from [env](./env.md).

> [!warning] Source of truth is `docs/docker-compose.yml`, not this note.
> Edit that file, then run `bun scripts/sync-docs-mirrors.ts`.

<!-- sync:compose start -->
```yaml
name: declic

# ─────────────────────────────────────────────────────────────
# Development compose file for "Déclic"
# Runtime  : Bun (all JS services)
# Stack    : TanStack Start (web) + NestJS (api) + BullMQ worker
#            + PostgreSQL + Redis + MinIO (S3-compatible)
# Assumes project layout:
#   ./apps/web     -> TanStack Start frontend
#   ./apps/api     -> NestJS API
#   ./apps/worker  -> image-processing worker (Bun.Image + BullMQ)
# Copy .env.example to .env before running `docker compose up`
#
# Two modes (api/worker/web carry `profiles: ["apps"]`):
#   docker compose up -d                 -> infra only (postgres, redis, minio)
#   docker compose --profile apps up -d  -> infra + apps in containers
# Root docker-compose.yml is materialized from this spec — change here,
# then copy over. Keep the two files identical except this header.
# ─────────────────────────────────────────────────────────────

services:

  # ── Database ────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-declic}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-declic}
      POSTGRES_DB: ${POSTGRES_DB:-declic_dev}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-declic}"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - declic-net

  # ── Queue / cache (BullMQ backend) ─────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - declic-net

  # ── Object storage (S3-compatible, dev/prod parity) ───────────
  minio:
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # Web console
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - declic-net

  # One-off: auto-create the app's bucket on first startup
  minio-init:
    image: minio/mc:RELEASE.2025-08-13T08-35-41Z
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
        mc alias set local http://minio:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin};
        mc mb --ignore-existing local/${S3_BUCKET:-declic};
        mc anonymous set download local/${S3_BUCKET:-declic}/public;
        exit 0;
      "
    networks:
      - declic-net

  # ── NestJS API (Bun) ───────────────────────────────────────────
  api:
    profiles: ["apps"]
    image: docker.io/oven/bun:1.4.2
    restart: unless-stopped
    working_dir: /app
    command: sh -c "bun install && bun run start:dev"
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: development
      PORT: 3001
      DATABASE_URL: postgres://${POSTGRES_USER:-declic}:${POSTGRES_PASSWORD:-declic}@postgres:5432/${POSTGRES_DB:-declic_dev}
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      S3_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      S3_BUCKET: ${S3_BUCKET:-declic}
      S3_FORCE_PATH_STYLE: "true"
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:-dev-only-change-me}
      BETTER_AUTH_URL: http://localhost:3001
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID:-}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET:-}
    volumes:
      - ./apps/api:/app
      - api_node_modules:/app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - declic-net

  # ── Image-processing worker (NestJS + @nestjs/bullmq + Bun.Image) ──
  worker:
    profiles: ["apps"]
    image: docker.io/oven/bun:1.4.2
    restart: unless-stopped
    working_dir: /app
    command: sh -c "bun install && bun run start:dev"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://${POSTGRES_USER:-declic}:${POSTGRES_PASSWORD:-declic}@postgres:5432/${POSTGRES_DB:-declic_dev}
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      S3_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      S3_BUCKET: ${S3_BUCKET:-declic}
      S3_FORCE_PATH_STYLE: "true"
    volumes:
      - ./apps/worker:/app
      - worker_node_modules:/app/node_modules
    depends_on:
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - declic-net

  # ── TanStack Start frontend (Bun + Vite) ──────────────────────────
  web:
    profiles: ["apps"]
    image: docker.io/oven/bun:1.4.2
    restart: unless-stopped
    working_dir: /app
    command: sh -c "bun install && bun run dev"
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      VITE_API_URL: http://localhost:3001
      VITE_BETTER_AUTH_URL: http://localhost:3001
    volumes:
      - ./apps/web:/app
      - web_node_modules:/app/node_modules
    depends_on:
      - api
    networks:
      - declic-net

networks:
  declic-net:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  minio_data:
  api_node_modules:
  worker_node_modules:
  web_node_modules:
```
<!-- sync:compose end -->
