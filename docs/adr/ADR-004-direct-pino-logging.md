# ADR-004: Structured Logging via Direct Pino (No nestjs-pino on Bun)

**Status:** Accepted
**Date:** 2026-09-04
**Org:** bal16
**Deciders:** repo owner
**Related:** `../PRD-Worker.md` §4.3, `../../apps/api/src/logger.ts`, `../../apps/worker/src/logger.ts`

---

## 1. Context

Boot logs flowed through NestJS's default logger plus raw `console.log`,
with no structure, no HTTP request lines, and no level control. PRD-Worker
§4.3 already requires structured per-job logs (and later metrics/alerts),
so the logging foundation had to land before queue work: JSON in
production (machine-parseable), readable output in development, and
per-request correlation IDs as the future trace backbone api→queue→worker.

## 2. Decision

* **Plain `pino` (v10) + `pino-pretty` (dev only)**, wired through a small
  `PinoNestLogger` adapter implementing NestJS `LoggerService`, installed
  via `bufferLogs` + `app.useLogger()`. One Express middleware logs
  method/url/status/latency with a per-request id (`x-request-id`
  echoed/assigned).
* **Conventions:** `LOG_LEVEL` env (default `debug` dev, `info` prod);
  pretty single-line transport everywhere except production and tests
  (worker-thread transports under `bun test` risk hanging the runner;
  e2e boots with `logger: false` anyway).
* **Kept inline per app** (`apps/api/src/logger.ts`,
  `apps/worker/src/logger.ts`): no shared runtime package exists yet, and
  pulling server logging into `@declic/contracts` would drag it into the
  web bundle. Worker's copy omits the HTTP middleware (it serves no HTTP);
  per-job fields (`postId`, `photoItemId`, `durationMs`, …) attach at the
  consumer step.
* **Explicitly out:** metrics, alerting, OTel tracing (need collector
  infrastructure that does not exist yet).

## 3. The nestjs-pino trap (do not "simplify" to it)

`nestjs-pino@5` (peer-compatible with NestJS 12) **cannot boot on this
stack**, verified two ways (boot crash + package inspection):

* its dist is CJS-only (`main: ./dist/index.js`, single `default` export
  condition) and internally `require('@nestjs/common')`;
* `@nestjs/common@12` is pure ESM (`"type": "module"`, no `require`
  export condition, top-level await) and Bun refuses CJS `require()` of
  it: `TypeError: require() async module ... is unsupported`.

Revisit only if Bun gains `require(esm)` support or nestjs-pino ships an
ESM entry — re-verify by booting, not by reading changelogs.

## 4. Alternatives considered

* **NestJS built-in logger + custom formatting** — rejected: reimplements
  JSON serialization, request logging, and level mapping that pino
  already provides.
* **Winston (`nest-winston`)** — rejected: heavier and slower than pino
  with no advantage relevant here.
* **Shared `packages/logging`** — deferred until a third consumer exists;
  two ~45-line files with a documented reason beat a premature package.

## 5. Verification

```bash
PORT=3108 bun apps/api/src/main.ts &   # pretty boot + request lines
curl -s -o /dev/null http://127.0.0.1:3108/health
NODE_ENV=production PORT=3108 bun apps/api/src/main.ts  # every line valid JSON
timeout 20 bun apps/worker/src/main.ts                  # context ready via pino
bun run --filter "@declic/*" test        # transports stay out of tests
```

Proven green at adoption: typecheck 0 errors, 11 unit + 12 e2e passing,
coverage gate passing, lint/format clean.

## 6. Consequences

* Positive: every future module logs through one shape; `req.id` is
  already flowing for later cross-service tracing; log volume is level-
  controllable per environment without code changes.
* Negative: ~45 lines of adapter per app to maintain; pretty output
  depends on `pino-pretty` worker threads under Bun (verified working,
  re-verify on Bun upgrades).

---

## Cross references

* API logger + middleware: `../../apps/api/src/logger.ts`
* Worker logger: `../../apps/worker/src/logger.ts`
* Observability targets: `../PRD-Worker.md` §4.3
* Env: `../../.env.example` (`LOG_LEVEL`)
