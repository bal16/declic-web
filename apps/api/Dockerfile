# @declic/api — NestJS on Bun (production).
#
# Build context MUST be the monorepo root (packages/* travel with the app):
#   docker build -f apps/api/Dockerfile -t declic-api:latest .
#
# No compile step: Bun runs src/main.ts directly. Secrets come from the
# environment at runtime, never baked in (see .dockerignore).

FROM oven/bun:1.4
WORKDIR /srv/declic
ENV NODE_ENV=production

# 1. Manifests first — install layer is cached unless deps change.
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/tsconfig/base.json ./packages/tsconfig/
RUN bun install --frozen-lockfile --production

# 2. Sources (app + shared packages it imports).
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY packages/tsconfig ./packages/tsconfig

WORKDIR /srv/declic/apps/api
EXPOSE 3001
CMD ["bun", "src/main.ts"]
