---
aliases:
  - ADR-007
tags:
  - declic
  - adr
status: accepted
updated: 2026-09-08
---
# ADR-007: Per-App `@/*` Path Alias (App `src` Anchor)

**Status:** Accepted
**Date:** 2026-09-08
**Org:** bal16
**Deciders:** repo owner
**Related:** [[ADR-001-monorepo-mirror|ADR-001]], [[ADR-005-modular-monolith|ADR-005]], `../../packages/tsconfig/base.json`, `../../apps/web/vite.config.ts`, `../../scripts/check-boundaries.ts`

---

## 1. Context

Explored 2026-09-08. Findings (verified, not assumed):

* **Zero alias configuration.** No `paths`/`baseUrl` in `base.json` or any
  `apps/*/tsconfig.json`, no `resolve.alias` in `vite.config.ts`, no
  `imports` field in any `package.json`, nothing in `bunfig.toml`.
* **Zero alias usage.** Every import in `apps/*/src` and
  `packages/contracts/src` is bare (`@nestjs/*`, `@declic/contracts` via
  `workspace:*`) or relative (`./`, `../`). The single `@/` mention in the
  repo is an aspirational example in `docs/PRD-FE.md:299`
  (`@/lib/auth-client`, file does not exist yet).
* **Three toolchains must agree.** An alias in this repo resolves in three
  independent places: `tsc` (`paths`), Vite (`resolve.alias`, web only —
  api/worker run from source via Bun with no bundler), and the Bun runtime
  (`dev`, `test`, `start`, and the production Docker `CMD`). Writing `@/x`
  today fails all three. There is no single config point.
* **No-build premise (api/worker).** NestJS conventionally compiles
  (`nest build` → `dist`), but this repo deliberately runs api/worker from
  source (`bun src/main.ts`, documented in both Dockerfiles). Researched
  2026-09-08: Bun runtime supports `emitDecoratorMetadata` since v1.0.3,
  Bun docs endorse direct source execution for servers, and `bun build`
  (bundler) is the option that breaks on NestJS (optional-require pattern),
  not `bun run`. Consequence for aliases: api/worker have **no build step
  that could prove alias resolution** — the Bun runtime itself is the proof.
* **`check-boundaries.ts` already anticipates aliases.** It resolves `@/`,
  `~/`, `src/` anchored per importer (api → `apps/api/src`, worker →
  `apps/worker/src`). That anchoring is currently a script-internal
  assumption, not a configured contract.

## 2. Decision

Adopt **one spelling, `@/*`, anchored per app** (`@/*` = that app's `src`),
in all three apps at once:

1. `apps/web|api|worker/tsconfig.json`: `"paths": { "@/*": ["./src/*"] }`
   (per app — `base.json` cannot hold it, directories differ).
2. `apps/web/vite.config.ts`: `resolve.alias` mapping `@` to app `src`
   (built-in Vite API, no new dependency; only web needs it).
3. One proof import per app converted to alias form (web `../lib/env`,
   api `./app.service`, worker `./logger`) so each toolchain's resolution
   is exercised, not just declared. No mass migration — short relative
   imports stay relative.
4. Convention locked in `docs/DEVELOPMENT.md` §6: intra-app `@/*`,
   inter-package `@declic/*`, `~/` and `src/` prefixes are not used.

Rejected explicitly:

* **Repo-root anchor** (`@/` = monorepo root): changes meaning between the
  monorepo and C1 mirror clones (mirrors do not carry the full root).
  Per-app anchor resolves identically in both (verified against the
  `mirror.sh` slice list — all alias-defining files travel in the slice).
* **Node subpath imports (`#*`)**: per-package `imports` fields, weaker
  Vite/Bun support, unfamiliar to frontend collaborators. Complexity
  without benefit over `@/*`.
* **`ttsc` (samchon, ttsc.dev)**: evaluated 2026-09-08 at the owner's
  request. It is a `typescript-go` toolchain (drop-in `tsc`, `ttsx`,
  `@ttsc/paths`, `@ttsc/unplugin` incl. Bun, plus typia/nestia plugin
  hosting). Verdict: **not adopted**. `@ttsc/paths` only acts at emit
  time (no emit here); the `tsc` it replaces has no deficiency here;
  and it would duplicate the locked oxlint+oxfmt toolchain if its lint
  half came along. Revisit trigger: a `nestia`/`typia` evaluation (which
  is an ADR-003-level decision, not a compiler swap — and note compiler
  plugins do not run under plain `bun src/main.ts` without integration).
* **`ttsc` (ts-patch) / `tsc-alias`**: same verdict by the same logic —
  emit-time tools for a repo with no emit step. If api/worker ever gain a
  `tsc` build step while using `@/*`, the designated pairing is
  `tsc-alias` (post-process, no compiler patching, no TS version lock —
  relevant with `typescript ^7.0.2`), never compiler patching.

## 3. Alternatives considered

### A. Status quo (relative-only) — rejected

Zero config, identical behavior everywhere. Rejected because the owner
chose to adopt now while the scaffold is small, and the frontend
convention (`@/`, already referenced by PRD-FE) is worth aligning with
before route nesting deepens.

### B. This ADR (per-app `@/*`, all apps) — accepted

One spelling, three small configs, proof per toolchain, mirror-safe by
construction. Cost is bounded and paid once.

### C. Web-only adoption — rejected

Cheapest, and web benefits most — but divergent conventions per app
ROT faster than the saved config lines. All-at-once was chosen.

## 4. Consequences

* Positive: deep imports stay readable as modules nest; PRD-FE's `@/`
  example becomes real convention; boundary gate's alias handling becomes
  a configured contract instead of an assumption.
* Negative: every future toolchain addition (new bundler, test runner,
  linter with resolution) must be taught `@/*` — three places minimum.
  Alias misuse across apps (`@/x` meaning different dirs per app) is
  possible; code review owns that.
* Guardrails required: typecheck + per-app `bun test` + web `vite build`
  in CI already cover all three resolvers; `check-boundaries.ts`
  resolves `@/` with the same anchoring (follow-up: drop `~/`/`src/`
  support so the gate knows exactly one spelling).

## 5. Verification

* `bun run --filter "@declic/*" typecheck` (tsc `paths`, all apps).
* `bun test src/` per app — the load-bearing proof: Bun runtime honors
  `paths` (highest-risk claim; no build step exists to prove it otherwise).
* `bun run --filter @declic/web build` (Vite alias + Nitro).
* `bun run lint`, `bun run format:check`, `bun run boundaries`,
  `bun run sync:compose --check` green.
* Fallback recorded: if Bun runtime resolution fails, revert the three
  proof imports to relative and restrict `@/*` to typecheck + Vite,
  documented as a limitation — or evaluate a resolver plugin.

## 6. Open questions / follow-ups (not blocking)

1. **Bun version pin in Docker.** Dockerfiles use floating `oven/bun:1.4`
   while CI pins `1.4.2` (`packageManager` agrees). With no build step,
   the runtime *is* the compiler — versions should be identical
   everywhere. Proposed: pin `oven/bun:1.4.2` in all three Dockerfiles.
2. **Gate spelling cleanup.** Remove `~/` / `src/` handling from
   `check-boundaries.ts` so exactly one alias spelling exists.
3. **`nestia`/`typia` evaluation.** Would reopen the `ttsc` (samchon)
   question and likely force a build step for api/worker. Out of scope
   until proposed separately.

---

## Cross references

* Mirror slices and why per-app anchors are mirror-safe: [[ADR-001-monorepo-mirror|ADR-001]]
* Boundary gate alias handling: [[ADR-005-modular-monolith|ADR-005]] §6, `../../scripts/check-boundaries.ts`
* Toolchain (oxlint+oxfmt) and dev commands: [[DEVELOPMENT]]
* Alias aspirational example: `../PRD-FE.md` §6.1
