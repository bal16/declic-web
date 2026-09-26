---
aliases:
  - ADR-010
tags:
  - declic
  - adr
status: accepted
updated: 2026-09-26
---
# ADR-010: S3 Backends After MinIO Archival (Silo in Dev, LocalStack in CI)

**Status:** Accepted (amended 2026-09-26 — fallback C activated, see §7)
**Date:** 2026-09-26 (accepted 2026-09-26; amended 2026-09-26)
**Org:** bal16
**Deciders:** repo owner
**Related:** [ADR-006](./ADR-006-branch-protection.md) (required checks), `../../.github/workflows/ci.yml`, `../../.github/workflows/release.yml`, `../ops/docker-compose.yml`, `../guides/testing.md` §1, `../guides/DEVELOPMENT.md` §5.2

---

## 1. Context

Verified 2026-09-26. Findings (evidence, not assumptions):

* **Upstream is gone.** MinIO Community Edition was archived (read-only,
  no further fixes). Docker Hub repositories `minio/minio` and `minio/mc`
  were deleted on Sep 11 2026 (whole-repo 404, not throttling).
* **CI is red.** Every `ci / verify` and `release / verify` run fails
  before any step executes: `docker pull
  quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z` returns
  `unauthorized: access to the requested resource is not authorized`
  from GitHub runners (3 retries, then hard fail). Local
  `docker compose up -d` is broken the same way (`minio` and `minio-init`
  both use `quay.io`).
* **One failure kills all signals.** `verify` is a single job, so the dead
  S3 service blocks format/lint/typecheck/unit even though only the
  worker e2e needs S3 (`apps/worker/test/e2e/pipeline.e2e.test.ts` T1–T4).
* **Actual S3 surface is narrow.** The worker uses basic Put/Head/Get/
  Delete via `Bun.S3Client` path-style (`object-storage.service.ts`,
  `setup.ts`, `pipeline.dsl.ts`). Presigned URLs exist only in
  docs/PRD (`PRD-API.md`, `series-upload.md`) — not yet in
  `apps/api`/`apps/web`. The `mc anonymous set download .../public`
  step in `minio-init` is not exercised by any test.
* **Healthcheck is invalid.** `--health-cmd "mc ready local"` assumes an
  `mc` binary inside the server image; none exists there.

## 2. Decision

Split backends — each environment gets the backend that is optimal
for it. Both are S3-compatible; the app speaks standard S3 only.

1. **Dev / prod-like compose → Silo** (`docker.io/pgsty/silo`, pinned
   `RELEASE.YYYY-MM-DDTHH-MM-SSZ` tag). Silo is a community-maintained
   MinIO fork: same S3 API, same `MINIO_*` variables, same ports
   (`9000` S3, `9001` console), same on-disk format (rollback = restore
   the old image line), `mc` retained as a `mcli` alias, full console
   restored. Migration is a one-line image swap per the upstream
   migration guide. `minio-init` moves to `pgsty/mc`.
   Healthcheck becomes the native `["CMD", "silo", "healthcheck",
   "ready"]`.
2. **CI services → Silo** (`docker.io/pgsty/silo`, same pinned
   `RELEASE.2026-09-16T00-00-00Z` tag as dev), port `9000`, healthcheck
   `silo healthcheck ready`. *Amendment 2026-09-26: this replaces the
   original LocalStack choice (see §7). One backend everywhere means
   `setup.ts` defaults need no CI override and the bucket step keeps
   the `:9000` endpoint.*
3. **Parity statement corrected.** Full image parity remains for
   postgres/redis. For S3 the contract is compatibility, not identity:
   `DEVELOPMENT.md` §5.2 and `testing.md` §1 say so in one line each,
   with a pointer here. No new doc files (per-docs MOC, no second
   README); notes live outside the `sync:compose`/`sync:docs` fences,
   which stay machine-owned.

Rejected explicitly:

* **Status quo (`quay.io/minio`)**: broken today, unmaintained
  upstream, no fix possible on our side.
* **Silo everywhere**: adopted via §7 amendment (was the designated
  fallback; see §3.C). One backend, full parity, smallest diff —
  the original objections (console/`mc` weight in CI) proved weaker
  than a license-gated runner dependency.
* **LocalStack everywhere**: rejected. Dev would lose real
  object-storage semantics (console `:9001`, `mc` public-prefix
  workflow, presigned public-URL behavior) and every dev endpoint
  (`.env.example`, compose `S3_ENDPOINT`, docs) would churn to
  `:4566` — surrendering dev/prod parity where it matters most,
  for a repo whose core loop is upload → process → serve images.

## 3. Alternatives considered

### A. Status quo — rejected

See §2. Nothing to salvage: the registry distribution point is gone.

### B. Split backends (Silo dev + LocalStack CI) — superseded by §7

### C. Silo everywhere — ADOPTED (see §7)

Activated 2026-09-26 with zero app/test changes, exactly as
predicted here (endpoint stays `:9000`-style, `setup.ts` defaults
untouched).

## 4. Consequences

* Positive: CI and local dev unblocked; S3 maintenance resumes
  (Silo ships CVE fixes); healthchecks become real probes; presign
  (when implemented per PRD-API) works against the single backend
  (standard SigV4).
* Negative: single-vendor reliance on a community fork. Mitigation:
  pinned immutable tag, interoperable on-disk format (rollback =
  restore the old image line), and follow-ups §6.2–§6.3 below.
* Guardrails required: `sync:compose --check` + `sync:docs --check`
  (spec stays source of truth); pinned tags only (`latest` floating
  tags are banned for the same reason `latest` bit us here);
  **verify image startup/licensing requirements, not just API
  compatibility** (lesson from §7 — the LocalStack miss).

## 5. Verification

* `ci` green on PR + worker `test:e2e` T1–T4 pass against Silo.
* `docker compose up -d` + worker `test:e2e` T1–T4 pass locally
  against the same Silo image.
* `bun run sync:compose --check`, `bun run sync:docs --check`,
  `bun run format:check`, `bun run lint` green.

## 6. Open questions / follow-ups (not blocking)

1. **Job split (Option 2)** — separate `quick` (no S3) from `e2e`
   jobs so a future S3 outage cannot block lint/unit signals.
2. **GHCR vendoring (Option 3)** — mirror pinned images to
   `ghcr.io` to survive another upstream registry disappearance.
3. **Silo tag maintenance** — who bumps the pinned `RELEASE` tag
   and on what cadence (align with only CVE-driven bumps until 1.0).

---

## 7. Amendment 2026-09-26 — fallback C activated (Silo everywhere)

The split failed at the first CI run on PR #35: the pinned
`localstack/localstack:2026.08.3` container exits with code 55 —
`License activation failed ... No credentials were found in the
environment`. Since release 2026.03.0 LocalStack ships community and
pro as one unified image that mandates `LOCALSTACK_AUTH_TOKEN` at
startup (free Hobby tier or paid plan; the temporary bypass expired
2026-04-06). Prior art confirms it (debezium, chaos-mesh, game-ci all
pinned pre-unification tags or added tokens).

Alternatives re-evaluated and rejected: pinning a pre-2026.03
community tag (frozen, no updates — contradicts the pinned-fresh
guardrail); signing up for Hobby + `LOCALSTACK_AUTH_TOKEN` secret
(new external license dependency + secret management for a private
repo); switching to another free mock (new compatibility
verification round for zero gain — Silo is already proven locally).

Decision: activate fallback C. CI uses the same pinned Silo image as
dev. Consequences: the parity statement returns to full identity
(all services, all environments); §4 negatives about two backends no
longer apply; the recorded lesson is to verify image
startup/licensing requirements alongside API compatibility.

---

## Cross references

* CI/release service definitions: `../../.github/workflows/ci.yml`, `../../.github/workflows/release.yml`
* Compose spec + materialization: `../ops/docker-compose.yml`, `../../docker-compose.yml`, `../ops/docker-compose.md`
* E2E contract: `../guides/testing.md` §1, `../../apps/worker/test/e2e/pipeline.e2e.test.ts`
* Presign plan (not yet implemented): `../specs/PRD-API.md` §1/§4, `../features/series-upload.md`
* Silo migration guide + compatibility: https://silo.pgsty.com/compatibility/migration/
* LocalStack image tags (`YYYY.MM.patch` immutable): https://hub.docker.com/r/localstack/localstack/tags
