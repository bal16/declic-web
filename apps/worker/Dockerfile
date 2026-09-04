# @declic/worker — NestJS BullMQ consumer on Bun (production).
#
# Build context MUST be the monorepo root (packages/* travel with the app):
#   docker build -f apps/worker/Dockerfile -t declic-worker:latest .
#
# No compile step: Bun runs src/main.ts directly. No inbound ports —
# scale with replicas, not per-instance concurrency (PRD-Worker.md §4.2).

FROM docker.io/oven/bun:1.4
WORKDIR /srv/declic
ENV NODE_ENV=production

# 1. Manifests first — install layer is cached unless deps change.
COPY package.json bun.lock bunfig.toml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/tsconfig/base.json ./packages/tsconfig/
RUN bun install --frozen-lockfile --production

# 2. Sources (app + shared packages it imports).
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json ./apps/worker/
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY packages/tsconfig ./packages/tsconfig

WORKDIR /srv/declic/apps/worker
CMD ["bun", "src/main.ts"]
