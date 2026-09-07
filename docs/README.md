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

Start here. Every note below is linked with `[[wikilinks]]` (Obsidian graph + Marksman `file-stem` style, see `.marksman.toml`). Non-markdown sources (`.yml`, `.ts`, extensionless) are readable via companion notes below — never edit the fenced mirror, edit the source and re-sync.

## Product

- [[PRD]] — vision, roles, exhibition lifecycle (`PRE_EVENT` → `LIVE` → `ARCHIVED`), frozen-archive rules. Status: draft `0.4-draft`, app `0.x` pre-release.

## Specs (vertical slices share these contracts — defined once, referenced everywhere)

- [[PRD-API]] — modules, schema text, cursor/error/flag contracts, endpoint index (bodies live in `features/`). Status: draft `0.4-draft`.
- [[db-schema]] — canonical Mermaid ER + seeds summary (seeds live in `docs/seed.ts`).
- [[PRD-FE]] — routes, upload/lightbox/curation UI, web vitals, auth guards. Status: draft `0.4-draft`.
- [[PRD-Worker]] — per-frame pipeline, retry/DLQ, memory budget. Status: draft `0.4-draft`.

## Features (1 file per feature — acceptance index)

- [[features/README]] — status table + template rules (single source for endpoint bodies; `PRD-API` §4.x keeps pointers only).

## Decisions

| ADR | Subject | Status |
|---|---|---|
| [ADR-001](adr/ADR-001-monorepo-mirror.md) | Monorepo source of truth + per-app read-only mirrors | accepted |
| [ADR-002](adr/ADR-002-release-tagging.md) | Single `vX.Y.Z` tag, rc-only, deploy deferred | accepted |
| [ADR-003](adr/ADR-003-zod-dto-strategy.md) | Zod as DTO source of truth via `nestjs-zod` | accepted |
| [ADR-004](adr/ADR-004-direct-pino-logging.md) | Structured logging via direct Pino (no `nestjs-pino` on Bun) | accepted |
| [ADR-005](adr/ADR-005-modular-monolith.md) | Modular monolith boundaries + `check-boundaries.ts` gate | accepted |

## Ops

- [[DEVELOPMENT]] — repo map, env, dev loop, mirrors, releases, troubleshooting.

## Infra companions (Obsidian-readable mirrors, auto-synced)

| Note | Source of truth | Sync |
|---|---|---|
| [[docker-compose]] | `docs/docker-compose.yml` | `bun scripts/sync-docs-mirrors.ts` |
| [[seeds]] | `docs/seed.ts` | same |
| [[env]] | `docs/env.example` | same |

## Conventions used in these notes

- `[[Note]]` = cross-note link (resolves to `Note.md` in this folder or `adr/`).
- `[[ADR-001-monorepo-mirror|ADR-001]]` = aliased link, short label.
- `> [!abstract]` = document summary; `> [!note]-` = collapsed side note; `> [!warning]` = do-not-break rule.
- YAML frontmatter (`title`, `aliases`, `tags`, `status`, `updated`) powers Obsidian search/graph/Dataview.
- Fenced code (mermaid, `docker-compose.yml` trees, shell) is literal — links inside fences are intentionally *not* converted.
