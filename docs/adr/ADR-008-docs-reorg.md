---
aliases:
  - ADR-008
tags:
  - declic
  - adr
status: proposed
updated: 2026-09-09
---
# ADR-008: Docs Root Regroup (Full Migration Map)

**Status:** Proposed (not approved — read the cost section before approving)
**Date:** 2026-09-09
**Org:** bal16
**Deciders:** repo owner
**Related:** [README](../README.md) (100% index coverage today)

---

## 1. Context

`docs/` root holds 15 notes plus `seed.ts` and the compose spec.
Discoverability is currently carried by the index
([README](../README.md), 100% coverage) and the vault holds ~333
markdown-link edges. This ADR records the *complete* migration map so
the regroup can be executed without guesswork — or rejected on evidence.

Recommendation (unchanged): **stay flat** unless §5 convinces otherwise.

## 2. Target tree

```text
docs/
├── README.md              # index — STAYS (stable anchor)
├── specs/                 # PRD.md, PRD-API.md, PRD-FE.md, PRD-Worker.md, contracts.md
├── data/                  # db-schema.md, seeds.md, seed.ts
├── guides/                # DEVELOPMENT.md, frontend.md, backend.md, DESIGN.md
├── ops/                   # docker-compose.md, docker-compose.yml, env.md
├── features/              # stays
└── adr/                   # stays
```

## 3. Rewrite rules (mechanical, cover all ~333 edges)

| # | Direction | Rule | Volume |
|---|---|---|---|
| R1 | Moved → same-group sibling | unchanged (`./X.md` stays) | free |
| R2 | Moved → other group H | `./Y.md` → `../H/Y.md` | per file |
| R3 | Moved → `features/`/`adr/` | `./features/` → `../features/`, `./adr/` → `../adr/` | all ex-root files referencing them |
| R4 | `features/`+`adr/` (stay) → moved target | `../X.md` → `../G/X.md` — per target: `PRD.md` 11 files, `PRD-API.md` 13, `PRD-FE.md` 9, `PRD-Worker.md` 6, `contracts.md` 3, `db-schema.md` 12, `DEVELOPMENT.md` 3, `README.md` 1 (`frontend`/`backend`/`DESIGN`/companions/`seeds` = 0) | ~60 file-touches |
| R5 | Code-span path refs | `../apps` → `../../apps` (only `contracts.md`, `DESIGN.md`); in staying `adr/` files: `` `../seed.ts` `` → `` `../data/seed.ts` ``, `` `../docker-compose.yml` `` → `` `../ops/docker-compose.yml` ``; `../../apps\|scripts\|.github` in `adr/` unchanged | ~8 lines |
| R6 | Non-docs (functional) | `sync-docs-mirrors.ts` 3 path pairs, `sync-compose.ts` `SPEC`, `sources embedded in docs/*.md` comments in `ci.yml`/`release.yml` — without these, CI goes red | mandatory |
| R7 | Non-docs (cosmetic) | root `README.md` table (7 lines), `docker-compose.yml:5` header, `mirror.sh`/workflow/Dockerfile/`bunfig.toml`/`env.ts` comments, prose path mentions | ~15 lines |

## 4. Traps (mapped, do not miss)

1. **Config literals are not links.** `../../.env`, `envDir:
   '../../'` (DEVELOPMENT, frontend) are Vite/Bun values — moving files
   must not touch them.
2. **Pre-existing oddity, fixed for free.** `DEVELOPMENT.md`
   `` `../../.github/…` `` escapes the repo from `docs/` (wrong); after
   moving to `guides/` it becomes correct.
3. **Anchors (`#§`)**: untouched (no header changes) — all section refs
   stay valid.
4. **Frontmatter/aliases**: untouched. `.obsidian/workspace.json`
   (open tabs) auto-heals on reopen — tell collaborators to reload
   Obsidian (note it in the migration commit message).
5. **Fences**: repo rule forbids links in fences — the final `rg` check
   asserts none leaked in.

## 5. Cost honesty

±60 link file-touches + ±25 non-docs lines + 3 script paths, to take
`docs/` root from 15 entries to 5. The meaningful regroups cost
46–160 rewrites each (specs ~160, guides ~59, data ~46); only infra
companions are cheap (5). Timing note: collaborators are onboarding
*now* — migration lands mid-reading-flow, the worst moment short of
mid-implementation.

## 6. Execution (only if approved)

- C1: pure `git mv` (links knowingly red).
- C2: R1–R5 + R7 rewrites (all §7 checks green here).
- C3: R6 tooling + comments (CI green).
- Rollback: revert 3 contiguous commits; plus a `pre-docs-reorg` tag
  before C1 (cheap, recommended).
- Verification, in order: `rg` for stale `](../(PRD|contracts|db-schema|DEVELOPMENT).md`
  in `features/`+`adr/` → 0, plus stale `./`-cross-group in moved
  files → 0; `sync:compose --check`; `sync:docs --check`;
  `format:check`; `lint`; `boundaries`; markdownlint (no-fix config);
  reopen vault in Obsidian and spot-check 3 files per group.

---

## Cross references

- Index (the flat alternative): [README](../README.md)
- Sync tooling that hardcodes paths: `../../scripts/sync-docs-mirrors.ts`, `../../scripts/sync-compose.ts`
- Gates that pin paths: `../../.github/workflows/ci.yml`, `../../.github/workflows/release.yml`
