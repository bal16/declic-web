---
aliases:
  - ADR-006
tags:
  - declic
  - adr
status: proposed
updated: 2026-09-08
---
# ADR-006: Branch Protection Strategy (Phased Strict)

**Status:** Proposed
**Date:** 2026-09-08
**Org:** bal16
**Deciders:** repo owner
**Related:** [[ADR-001-monorepo-mirror|ADR-001]], [[ADR-002-release-tagging|ADR-002]], `../../.github/workflows/ci.yml`, `../../.github/workflows/mirror.yml`

---

## 1. Context

* `bal16/declic` is a **private repo on the Free plan**. Verified 2026-09-08:
  repository rulesets API returns `403 (requires Pro or public)`.
  Only **classic branch protection** (`Settings > Branches`) is available —
  no rulesets, no tag-protection rules, no granular bypass lists.
* Team: solo now, **collaborators arriving later**. Stated preference:
  **strict** at the end state.
* Current phase: **docs/planning churn directly on `main`**
  (uncommitted work in `scripts/*` at the time of writing).
  Strict protection now would block that workflow.
* CI posture: `ci.yml` triggers still manual-only (`workflow_dispatch`);
  jobs `verify` + `leak-guard`. `mirror.yml` fans out on every push to
  `main` (paths-scoped, see [[ADR-001-monorepo-mirror|ADR-001]] §6).
  `release.yml` is tag-driven (`v*`).

## 2. Decision (proposed)

Two phases. **Phase A now, Phase B on an agreed trigger.**

### Phase A — transition (now)

* **No branch protection on `main`.** Docs/planning continue via direct push.
* Prep work while unprotected (so the flip is mechanical):
  1. Enable `ci.yml` triggers (`push: main` + `pull_request`).
  2. Remove the `|| echo "::notice::... skipping"` fallbacks once every
     workspace defines its scripts (else required checks go green vacuously).
  3. Add `CODEOWNERS` per area (owners TBD — see §6 OQ-2).
  4. Optional: PR template so first-time collaborators start tidy.

### Phase B — strict (on trigger, see §6 OQ-1)

One classic branch protection rule for `main`:

* Require a pull request before merging; required approvals = **1**;
  require review from Code Owners; dismiss stale approvals;
  require conversation resolution.
* Require status checks `verify` + `leak-guard` (workflow `ci`);
  require branches to be up to date.
* Include administrators (owner is gated too, no bypass).
* Require linear history; block force pushes; do not allow deletion.

Deliberately **out of scope**:

* `mirror-*` branches in the monorepo (local-only CI scratch, never pushed
  to origin) — no rule.
* Mirror repos (`declic-web/api/worker`) — **no protection by design**;
  the bot's force-pushes require it ([[ADR-001-monorepo-mirror|ADR-001]]).
* Tag protection (`v*` maintainer-only) — unavailable on Free+private;
  substitute is discipline + strict `release.yml` (verify → publish →
  release), per [[ADR-002-release-tagging|ADR-002]] §5.1.

## 3. Alternatives considered

### A. Strict now — rejected for now

Turn on the Phase B rule immediately.

* Pros: discipline from day one; no "we'll flip later" debt.
* Cons: blocks the ongoing docs/planning flow on `main`; with CI
  triggers still disabled, required checks would block every PR forever
  until §2-A1 lands anyway. Flip cost exceeds benefit pre-scaffold.

### B. Lenient forever (protection without required checks) — rejected

E.g. only block force-push/deletion, allow direct pushes.

* Pros: zero friction for solo + docs.
* Cons: no gate for collaborators; unreviewed code and secret leaks
  (`apps/web` mirror surface) can land on `main`; contradicts the
  stated strict preference. Revisit only if the project stays solo
  past 1.0.

### C. This ADR (phased strict) — proposed

* Keeps current velocity, lands strict exactly when it starts paying
  (first collaborator or first scaffold), using only Free-tier mechanics.

## 4. Tradeoffs

| Choice | For | Against |
|---|---|---|
| Flip later, not now | docs velocity now; CI prereqs (triggers, no fallbacks) land first | "later" needs a real trigger or it slips |
| Required approvals = 1 | real review once collaborators exist | bus-factor delay when reviewers are away; overkill while solo |
| Include administrators | no silent bypass; strict means strict | no emergency lane; every hotfix pays full PR cost |
| Require linear history | clean history, matches tag-driven releases | rebase burden on newcomers; must document the flow |
| CODEOWNERS | clear ownership per area | maintenance tax; wrong owners = blocked PRs |
| Classic protection (only option) | works on Free | no tag protection, no bypass granularity, no "evaluate" dry-run mode |

## 5. Verification

* Phase A: `ci.yml` green on `push`/`pull_request` with fallbacks removed;
  `CODEOWNERS` present; PR template renders.
* Phase B: open a trial PR with a deliberate lint failure — merge is
  blocked until checks pass and one review approves; direct push to
  `main` is rejected; force-push to `main` is rejected.
* Mirrors unaffected: docs-only push skips fan-out (paths filter);
  slice change still force-pushes all three mirrors.

## 6. Open questions

* **OQ-1 — Flip trigger:** what ends Phase A? Candidate answers:
  (a) first scaffold lands, (b) first collaborator invited,
  (c) CI triggers enabled + one green PR. Needs a dated decision;
  until then this ADR stays `proposed`.
* **OQ-2 — Code owners:** who owns `apps/web`, `apps/api`,
  `apps/worker`, `packages/*`, `docs/adr/*`? Unassigned owners block
  PRs under "require review from Code Owners".
* **OQ-3 — Emergency lane:** strict says no bypass, but is there a
  break-glass story (e.g. temporary rule relaxation by owner, logged
  in the PR)? Classic protection has no per-actor bypass on Free.
* **OQ-4 — Tag discipline without tag protection:** is social convention
  plus annotated-tag hygiene enough until a plan upgrade, or should tag
  creation move to a script/CI job (`release.yml` dispatch only)?

---

## Cross references

* Mirror fan-out and why mirrors stay unprotected: [[ADR-001-monorepo-mirror|ADR-001]]
* Release gates, tag hygiene, GHCR limits: [[ADR-002-release-tagging|ADR-002]]
* Workflows: `../../.github/workflows/ci.yml`, `../../.github/workflows/mirror.yml`, `../../.github/workflows/release.yml`
