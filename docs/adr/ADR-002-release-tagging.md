# ADR-002: Tag-Driven Releases (Single Version, rc-Only, Deploy Deferred)

**Status:** Accepted
**Date:** 2026-09-04
**Org:** bal16
**Deciders:** repo owner
**Related:** `../DEVELOPMENT.md`, `../../.github/workflows/release.yml`, `../../scripts/check-coverage.ts`, `ADR-001-monorepo-mirror.md`

---

## 1. Context

The monorepo (ADR-001) ships three runtimes with one shared contract surface,
so versioning them independently would create meaningless version skew. At the
same time, deploy targets (where web/api/worker will run in production) are
undecided — the project is still in development. The release pipeline must
therefore be fully functional up to artifact publication while leaving the
deploy step empty.

## 2. Decision

* **One tag `vX.Y.Z` releases all apps together** (`bal16/declic` is the only
  place tags are created; mirror repos never receive tags).
* **Pre-releases are rc-only** (`v0.3.0-rc.1` → `rc.2` → `v0.3.0`). No
  `-alpha`/`-beta` tiers — ceremony without passengers at this team size.
* **No snapshot tags.** Snapshots are moving builds, not human decisions;
  when enabled they will be registry-only (`:main-<sha>` images), never Git
  tags, so tags keep their meaning ("this may be deployed").
* **MAJOR stays `0` until the first exhibition** (`v1.0.0` at launch, per
  `PRD.md` app-version note). `MINOR` rises per feature/exhibition
  milestone, `PATCH` for fixes.
* **Tag hygiene:** always annotated (`git tag -a`), never moved or reused.
* **Release behavior** (`.github/workflows/release.yml`, trigger `push`
  on `tags: ['v*']` + manual `workflow_dispatch` dry-run):
  1. Full gates re-run on the exact tagged tree (install frozen, typecheck,
     unit, build, e2e, **coverage ≥90% lines per app** via
     `scripts/check-coverage.ts`, lint, format check, leak-guard).
  2. Build the three Dockerfiles and push to GHCR (`:vX.Y.Z`, plus
     `:latest` **only** on finals — never on `-rc`).
  3. Create a GitHub Release (`prerelease: true` when the tag carries a
     suffix; `--generate-notes`).
  4. `deploy` job exists but is a disabled stub (`if: false`).
* **Coverage gate placement:** release-only (not CI). Rationale: coverage is
  a release-worthiness claim, and CI stays fast and manual while scaffolding
  moves. Revisit if untested code starts landing on `main` regularly.

## 3. Alternatives considered

* **Per-app tags** (`api-v1.2.0`, `web-v0.9.1`) — rejected: implies
  independent deployability the architecture does not have (queue payloads,
  schema, and flags change atomically across apps).
* **Snapshot tags** (`vX.Y.Z-snapshot`) — rejected: pollutes tag history
  with non-decisions; snapshots belong in the registry, not in Git.
* **CI-gated coverage on every change** — deferred, not rejected; see §5.

## 4. Verification (trial `v0.0.0-rc.1`, since deleted)

* Full gates green on the tag; three `:v0.0.0-rc.1` images pushed with
  digests; release recorded `isPrerelease: true`, not draft; no `:latest`
  tagging in logs. Trial release, remote tag, and local tag deleted after.
* Gate mechanics verified locally without spending Actions minutes: real
  run passes at 100%, parser proven to FAIL a 90-gate on synthetic 66.7%
  coverage, YAML parses.

## 5. Deferred follow-ups (all blocked on deploy-target decisions, if any)

1. **Tag protection** (`v*` maintainer-only ruleset) — enable when the
   workflow goes live for real releases.
2. **Snapshot automation** (`:main-<sha>` per push to `main`) — enable
   together with deploy targets, **with retention (last N versions) from
   day one** (see §6: registry storage is the binding constraint, not
   minutes).
3. **Fill in the `deploy` job** — once per-app destinations and the
   mechanism (SSH/compose pull vs PaaS auto-deploy) are known.
4. **Trial image cleanup** — `:v0.0.0-rc.1` images still sit in GHCR; the
   CLI token lacks `packages` scope, so delete via web UI
   (package → settings → delete version).
5. **Dead CI fallbacks** — the `|| echo "::notice::... skipping"` branches
   in `ci.yml` no longer trigger (all workspaces define the scripts);
   remove when touching CI next.

## 6. GitHub free-tier limits analysis (recorded 2026-09-04)

Facts and burn rate at the time of writing:

* **Actions minutes:** free personal accounts get **2,000 Linux
  minutes/month** (public repos unlimited; our private repos consume
  quota; `ubuntu-latest` counts ×1 — multipliers apply only to
  macOS/Windows runners).
* **Our burn:** mirror ≈ 0.25 min/push, CI manual ≈ 0.5 min/run,
  release ≈ 2–6 min/tag. Even 100 pushes + 10 releases/month ≈
  **<100 min** — an order of magnitude below the cap.
* **The binding constraint is GHCR storage (free: 500 MB), not
  minutes.** Our images run ±285–350 MB *per version*; the leftover
  trial `v0.0.0-rc.1` set (±900 MB total) likely already exceeds the
  allowance — hence follow-up §5.4.
* **Policy consequence:** no need to scrimp on verification runs, but do
  not enable minute-burning automation (per-push snapshots, CI on every
  push) before it is needed. Current posture (manual CI, push-triggered
  mirror, tag-triggered release) is the right cost point.

## 7. Consequences

* Positive: releases are reproducible decisions with verified artifacts;
  `:latest` can be trusted to mean "last final"; mirrors are unaffected
  (their workflow listens to `main` only).
* Negative: release notes are auto-generated (curated notes are a future
  option); GHCR accumulates one version set per release until retention
  is configured.

---

## Cross references

* Repo layout and mirror flow: `../DEVELOPMENT.md`
* Workflow: `../../.github/workflows/release.yml`
* Coverage gate: `../../scripts/check-coverage.ts`
* Product versioning note: `../PRD.md` (0.x → 1.0.0 at first exhibition)
