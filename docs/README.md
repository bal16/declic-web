---
aliases:
  - Docs Index
  - MOC
tags:
  - declic
  - moc
status: living
---

# Déclic Docs — Map of Content

Start here. Every note below is linked with standard markdown links (relative paths, GitHub/GFM-compatible). Non-markdown sources (`.yml`, `.ts`, extensionless) are readable via companion notes below — never edit the fenced mirror, edit the source and re-sync.

## Product

- [PRD](./PRD.md) — vision, roles, exhibition lifecycle (`PRE_EVENT` → `LIVE` → `ARCHIVED`), frozen-archive rules. Status: draft `0.4-draft`, app `0.x` pre-release.

## Specs (vertical slices share these contracts — defined once, referenced everywhere)

- [PRD-API](./PRD-API.md) — modules, schema text, cursor/error/flag contracts, endpoint index (bodies live in `features/`). Status: draft `0.4-draft`.
- [db-schema](./db-schema.md) — canonical Mermaid ER + seeds summary (seeds live in `docs/seed.ts`).
- [contracts](./contracts.md) — normative cross-module/cross-app shapes (cursor, errors, queue, roles, audit actions). Planning scope: materializes into `packages/contracts/src/` when implementation starts.
- [PRD-FE](./PRD-FE.md) — routes, upload/lightbox/curation UI, web vitals, auth guards. Status: draft `0.4-draft`.
- [PRD-Worker](./PRD-Worker.md) — per-frame pipeline, retry/DLQ, memory budget. Status: draft `0.4-draft`.
- [frontend](./frontend.md) — web app organization (structure, data flow, guards, tests). Draft.
- [backend](./backend.md) — api app organization (module anatomy, lifecycle, testing). Draft.
- [DESIGN](./DESIGN.md) — design system contract (tokens, components, a11y, i18n, states). Draft.

## Features (1 file per feature — acceptance index)

- [features/README](./features/README.md) — status table + template rules (single source for endpoint bodies; `PRD-API` §4.x keeps pointers only).

## Decisions

| ADR                                           | Subject                                                      | Status                                        |
| --------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| [ADR-001](adr/ADR-001-monorepo-mirror.md)     | Monorepo source of truth + per-app read-only mirrors         | accepted                                      |
| [ADR-002](adr/ADR-002-release-tagging.md)     | Single `vX.Y.Z` tag, rc-only, deploy deferred                | accepted                                      |
| [ADR-003](adr/ADR-003-zod-dto-strategy.md)    | Zod as DTO source of truth via `nestjs-zod`                  | accepted                                      |
| [ADR-004](adr/ADR-004-direct-pino-logging.md) | Structured logging via direct Pino (no `nestjs-pino` on Bun) | accepted                                      |
| [ADR-005](adr/ADR-005-modular-monolith.md)    | Modular monolith boundaries + `check-boundaries.ts` gate     | accepted + addendum 2026-09-08 (layered gate) |
| [ADR-006](adr/ADR-006-branch-protection.md) | Phased branch protection (strict on trigger)                 | proposed                                      |
| [ADR-007](adr/ADR-007-path-aliases.md)      | Per-app `@/*` path alias (app `src` anchor)                  | accepted                                      |

## Ops

- [DEVELOPMENT](./DEVELOPMENT.md) — repo map, env, dev loop, mirrors, releases, troubleshooting.

## Infra companions (Obsidian-readable mirrors, auto-synced)

| Note | Source of truth | Sync |
|---|---|---|
| [docker-compose](./docker-compose.md) | `docs/docker-compose.yml` | `bun scripts/sync-docs-mirrors.ts` |
| [seeds](./seeds.md) | `docs/seed.ts` | same |
| [env](./env.md) | root `.env.example` | same |

## Conventions used in these notes

- Cross-note links use relative paths — `[PRD](./PRD.md)` from this folder, `../PRD-API.md` from a subfolder (adjust `../` to your file's depth).
- `[ADR-001](./adr/ADR-001-monorepo-mirror.md)` = short label for a long filename.
- `> [!abstract]` = document summary; `> [!note]-` = collapsed side note; `> [!warning]` = do-not-break rule.
- YAML frontmatter (`title`, `aliases`, `tags`, `status`, `updated`) powers Obsidian search/graph/Dataview.
- Fenced code (mermaid, `docker-compose.yml` trees, shell, SQL/TS samples) is literal — never put doc links inside fences.
