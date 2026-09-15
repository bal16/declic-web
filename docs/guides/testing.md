---
aliases:
  - Testing Guide
tags:
  - declic
  - testing
status: draft
updated: 2026-09-15
---

# Testing Guide

**Status:** Draft
**Related:** [DEVELOPMENT.md](./DEVELOPMENT.md) §5.3.1 (tiers), [backend.md](./backend.md) §5, [ADR-005](../adr/ADR-005-modular-monolith.md) §7.5 (contracts), [ADR-002](../adr/ADR-002-release-tagging.md) §2 (coverage gate)

Single source for testing conventions across all apps. What to build
lives in PRDs and `features/`; how code is organized lives in the
backend/frontend guides. This file is *how we test it*.

---

## 1. Testing tiers

| Tier | Location | Runner | Infra | Purpose |
|------|----------|--------|-------|---------|
| **Unit** | `src/**/*.test.ts` (co-located) | `bun run test` | No TCP. External clients stubbed. | Pure logic + DI compile |
| **E2E** | `test/**/*.test.ts` | `bun run test:e2e` | Full module graph. Worker needs compose **up**. | Aggregate behavior proof |

### Unit tests

* Run with compose **down** — green means compliant.
* External clients (Redis, S3, Postgres) are **stubbed** via DI
  `overrideProvider` or constructor doubles. No real TCP connections.
* **In-process engines** are allowed: PGlite (WASM Postgres, no TCP)
  may back repository tests — real SQL semantics, still CI-safe.
* Coverage gate: `bun run coverage` (src/ only, ≥90% lines per app),
  satisfiable from unit tests alone by design.

### E2E tests

* `api`/`web`: service-free (in-memory HTTP round-trips).
* `worker`: real Redis/MinIO/Postgres via `docker compose up -d` or
  CI services (`ci.yml` verify job).
* Worker acceptance tests (T1-T4) live in
  `apps/worker/test/e2e/pipeline.e2e.test.ts`.

## 2. File layout

```text
apps/<app>/
├── src/
│   ├── module/
│   │   ├── service.ts
│   │   └── service.test.ts        # co-located unit test
│   └── ...
└── test/
    ├── helpers/                    # shared test utilities
    │   ├── test-env.ts             # setupTestEnv() — dummy env literals
    │   ├── fixtures.ts             # fixtureBytes(), fixture constants
    │   ├── db.ts                   # newTestDb() — fresh PGlite per call
    │   ├── processor.doubles.ts    # stubs/spies for processor tests
    │   ├── storage.doubles.ts      # fakes for S3 tests
    │   └── pipeline.dsl.ts         # given*/when*/then* for e2e
    ├── factories/                  # domain data builders
    │   └── post.factory.ts         # givenProcessingPost(), givenPhotoItem()
    ├── fixtures/                   # static binary fixtures
    │   ├── red-64x48.png
    │   └── blue-48x64.png
    └── e2e/                        # end-to-end tests
        ├── setup.ts                # setupE2E(), teardownE2E()
        └── pipeline.e2e.test.ts
```

### Rules

* **Unit tests** are co-located next to the source they test
  (`service.test.ts` beside `service.ts`).
* **Helpers** are shared utilities with no domain logic — they don't
  assert, they don't seed data. They provide building blocks.
* **Factories** seed domain data (posts, items, users) with sensible
  defaults and `createId()` for uniqueness.
* **Doubles** (stubs, spies, fakes) replace real dependencies in unit
  tests. Named `*.doubles.ts` to make intent explicit.

## 3. Naming conventions

| Prefix | Layer | Purpose | Example |
|--------|-------|---------|---------|
| `given*` | Arrange | Seed state / create data | `givenProcessingPost(db)` |
| `new*` | Arrange | Create test infrastructure | `newTestDb()`, `newFakeStorage()` |
| `when*` | Act | Execute the action under test | `whenEnqueueFrame(ctx, postId, item)` |
| `expect*` | Assert | Verify outcome | `expectPostBecomes(ctx, postId, 'PENDING', ...)` |
| `* doubles` | Arrange | Test doubles (stubs/spies/fakes) | `processor.doubles.ts` |

### `it` block naming

* One test, one concept — one `it` per business behavior/scenario.
* Multiple `expect` calls are allowed within one `it` if they all
  verify the effect of the **same action**.
* Name describes the **behavior**, not the implementation:
  `it('promotes when all frames are ready')` not
  `it('should call tryPromoteToPending and return true')`.
* Never nest `it` inside `it`. Use nested `describe` for context
  grouping; `it` stays as the leaf at the lowest level.

## 4. Given-When-Then structure

### E2E example

```ts
it('T1 SINGLE: upload → derivatives + PENDING', async () => {
  // Given: a processing post with one image frame
  const { postId, items } = await givenWork(ctx, tracker, [
    { key: `raw-uploads/it-${createId()}.png`, file: RED_FIXTURE },
  ]);

  // When: enqueue the frame for processing
  await whenEnqueueFrame(ctx, postId, items[0]);

  // Then: post promotes to PENDING, derivatives exist in S3
  await expectPostBecomes(ctx, postId, 'PENDING', 30000, 'single promotion');
  for (const k of await expectDerivatives(ctx, tracker, items[0].id, 3)) {
    await expectObjectExists(ctx, k);
  }
}, 60000);
```

### Unit test example

```ts
describe('ImageProcessor.process', () => {
  it('runs fetch → hash → 3 variants → persist → promote in order', async () => {
    const { processor, calls } = await newProcessor();
    await processor.process(jobWith(payload));

    const order = calls.map((c) => c.method);
    expect(order.slice(0, 2)).toEqual(['getObject', 'encode']);
    expect(order.filter((m) => m === 'transform')).toHaveLength(3);
    expect(order.slice(-2)).toEqual(['markFrameReady', 'tryPromoteToPending']);
  });
});
```

### Unit test (repository, PGlite)

```ts
it('markFrameReady stores blurhash + derivatives', async () => {
  const { db, repo } = await newTestDb();
  const postId = await givenProcessingPost(db);
  const itemId = await givenPhotoItem(db, postId);

  await repo.markFrameReady({
    photoItemId: itemId,
    blurhash: 'LEHV6nWB2yk8pyo0adR*',
    derivatives: [{ variant: 'web', s3Key: 'd/i/web.webp', ... }],
  });

  const items = await db.select().from(photoItems).where(eq(photoItems.id, itemId));
  expect(items[0].blurhash).toBe('LEHV6nWB2yk8pyo0adR*');
});
```

## 5. Test doubles

Types and when to use them:

| Type | What it does | When to use |
|------|-------------|-------------|
| **Stub** | Returns hardcoded values | Replacing a service dependency (e.g. `ObjectStorageService.getObject`) |
| **Spy** | Records calls for later assertion | Verifying call order, arguments, or frequency |
| **Fake** | Working simplified implementation | Replacing external infra (e.g. in-memory S3 client) |

### Rules

* Doubles are defined in `test/helpers/*.doubles.ts`, not inline in
  test files.
* Factory functions (`newProcessor()`, `newFakeStorage()`) return
  fresh instances per call — no shared mutable state between `it`
  blocks.
* Stubs return deterministic values. Never rely on external state
  (network, filesystem) inside a stub.

## 6. Test isolation

### Data isolation

* Each `it` must seed its own data with **unique IDs**
  (`createId()` or `test-${createId()}` prefix).
* Never depend on data created by a previous `it` block. Tests may
  run in any order.
* Shared infrastructure (DB instance, module ref) via `beforeAll` is
  acceptable as long as **data is independent**.

### State cleanup

* Unit tests: no cleanup needed — fresh instances per `it` via
  factory functions.
* E2E tests: `afterAll` sweeps created keys (S3) and deletes rows
  (DB) in leaf-first order (derivatives → items → posts).

### Environment variables

* Use `setupTestEnv()` at the top of test files that need env vars.
* Never hardcode env values in test files — always go through
  `setupTestEnv()` (single source, `??=` means file execution order
  never matters).
* E2E tests: env comes from `--env-file` (real values), with compose
  defaults as fallback.

## 7. Test doubles pattern (Bun + NestJS)

### Stubbing with `overrideProvider`

```ts
const moduleRef = await Test.createTestingModule({
  imports: [SomeModule],
})
  .overrideProvider(getQueueToken('image-processing'))
  .useValue({})
  .overrideProvider(ImageProcessor)
  .useValue({})
  .compile();
```

### Tracking calls with a spy

```ts
interface Call { method: string; args: unknown[] }

function track(calls: Call[], method: string) {
  return (...args: unknown[]) => { calls.push({ method, args }); };
}

// In stub: use track(calls, 'methodName') as the implementation
```

### Factory pattern for fresh test context

```ts
async function newTestDb() {
  const client = new PGlite();
  const db = drizzlePglite({ client });
  await migrate(db, { migrationsFolder: '../../packages/db/drizzle' });
  const repo = new FrameRepository(db as unknown as Db);
  return { client, db, repo, close: () => client.close() };
}

// Each test calls newTestDb() for isolation
it('...', async () => {
  const { db, repo, close } = await newTestDb();
  try {
    // test body
  } finally {
    await close();
  }
});
```

## 8. What NOT to test

* **Production code changes** — tests verify behavior, not
  implementation details.
* **Infrastructure mocking in e2e** — e2e uses real services. If it
  needs stubbing, it belongs in unit tier.
* **Framework internals** — don't test that NestJS resolves
  dependencies correctly (covered by DI compile test), don't test
  that `bun:test` `describe/it` works.
* **Third-party libraries** — assume they work. Test the contract
  at the boundary (e.g. Drizzle query shape, not Drizzle internals).

## 9. Commands

```bash
# Unit tests (compose down)
bun run worker:test               # single app
bun run test                      # all apps

# E2E tests (compose up)
bun run worker:test:e2e           # single app
bun run test:e2e                  # all apps

# Coverage
bun run worker:test:coverage      # single app
bun run coverage                  # repo-wide gate

# Typecheck
bun run worker:typecheck          # single app
bun run typecheck                 # all apps

# Watch
bun run worker:test:watch         # single app
```

Replace `worker` with `api` or `web` to target other apps.

## 10. Coverage gate

* Target: ≥90% lines per app.
* Measured on `src/` only — `test/` helpers and e2e are excluded.
* Enforced at **release** (not per-PR CI). See
  [ADR-002](../adr/ADR-002-release-tagging.md) §2.

---

## Cross references

- Testing tiers: [DEVELOPMENT.md](./DEVELOPMENT.md) §5.3.1
- Backend testing: [backend.md](./backend.md) §5
- Frontend testing: [frontend.md](./frontend.md) §5
- Contract tests: [ADR-005](../adr/ADR-005-modular-monolith.md) §7.5
- Zod pipe caveat: [ADR-003](../adr/ADR-003-zod-dto-strategy.md) §4
- Coverage gate: [ADR-002](../adr/ADR-002-release-tagging.md) §2
- Pino in tests: [ADR-004](../adr/ADR-004-direct-pino-logging.md) §2
