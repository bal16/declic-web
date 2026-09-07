# @declic/web — TanStack Start on Bun (production).
#
# Build context MUST be the monorepo root (packages/* travel with the app):
#   docker build -f apps/web/Dockerfile -t declic-web:latest .
#
# Two stages: builder compiles client + Nitro server output, runner serves
# .output with production deps only (Bun runs the Nitro server entry).
# Vercel deploys from the declic-web mirror instead (docs/DEVELOPMENT.md §7.1).

FROM docker.io/oven/bun:1.4 AS builder
WORKDIR /srv/declic

COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/tsconfig/base.json ./packages/tsconfig/
RUN bun install --frozen-lockfile

COPY apps/web ./apps/web
COPY packages ./packages
WORKDIR /srv/declic/apps/web
# VITE_* are baked into the client bundle at build time (not runtime env).
# docker-compose.prod.yml passes them as build args; defaults suit local
# prod-like runs, staging/deploy export real values before building.
ARG VITE_API_URL=http://localhost:3001
ARG VITE_BETTER_AUTH_URL=http://localhost:3001
RUN bun run build

FROM docker.io/oven/bun:1.4 AS runner
WORKDIR /srv/declic
ENV NODE_ENV=production

COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/tsconfig/base.json ./packages/tsconfig/
RUN bun install --frozen-lockfile --production

COPY --from=builder /srv/declic/apps/web/.output ./apps/web/.output

WORKDIR /srv/declic/apps/web
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
