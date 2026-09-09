---
aliases:
  - Contracts
  - Shared Contracts
tags:
  - declic
  - contracts
status: draft
updated: 2026-09-09
---

# Shared Contracts (Cross-Module & Cross-App)

**Status:** Draft (planning scope — no code in `packages/` yet)
**Related:** [ADR-003](../adr/ADR-003-zod-dto-strategy.md), [ADR-005](../adr/ADR-005-modular-monolith.md), [PRD-API](./PRD-API.md) §4.0, [db-schema](../data/db-schema.md)

Normative definitions for every surface crossed by more than one
module or app. Other documents **reference, never redefine** — on any
shape question, this file wins (behavioral rules stay in their feature
files). Module call rules (layering, DI, method registry) live in
[ADR-005](../adr/ADR-005-modular-monolith.md) §7, not here — this file
is data shapes only, so it can materialize cleanly. When implementation starts (first real module, `posts`), each
§ below materializes line-by-line into `packages/contracts/src/`
(`cursor.ts`, `errors.ts`, `queue.ts`, `roles.ts`, `audit.ts`); the
event class itself stays api-internal (`audit` module).

---

## 1. Casing law

- **Wire JSON is `camelCase`** (`postId`, `parentId`, `createdAt`,
  `displayOrder`, `targetId`, `adminId`, `uploadUrl`, `expiresIn`).
- **Storage is `snake_case`** (DB columns, MinIO keys, `*_s3_key`).
- **Event envelopes are code** → `camelCase` top-level fields
  (`{ action, adminId, targetId, payload }`); `payload` mirrors source
  names (DB columns / S3 keys stay snake inside snapshots).

## 2. Cursor (`cursor.ts` later)

```ts
const cursorSchema = z.object({
  cursor: z.string().optional(), // opaque base64url(JSON), never raw cuid2
  limit: z.number().int().min(1).max(50).default(20),
});
const pageSchema = <T>(item: z.ZodType<T>) =>
  z.object({ data: z.array(item), nextCursor: z.string().nullable() });
```

Cursor internals are per-endpoint (`created_at` + `id`,
`start_date` + `id`); the envelope above is shared. Canonical table:
[PRD-API](./PRD-API.md) §4.0.

## 3. Queue payload (`queue.ts` later)

```ts
const imageProcessingJobSchema = z.object({
  postId: z.string(), // cuid2
  photoItemId: z.string(), // cuid2
  s3Key: z.string(), // MinIO key to process
  curated: z.boolean(), // true = curator replacement pipeline
  revert: z.boolean().optional(), // true = regenerate from original_s3_key
});
```

Consumed by **both sides**: api producer (`queue` facade) and worker
consumer (`image-processing`, concurrency 2, attempts 3 + exp backoff).
Fresh uploads send `curated: false, revert: false`; replace sends
`curated: true`; revert sends `curated: false, revert: true`; retry
replays the frame's `original_s3_key`. Canonical flow:
[PRD-Worker](./PRD-Worker.md) §1.

## 4. Error envelope (`errors.ts` later)

```ts
const errorSchema = z.object({
  code: z.string(), // FE branches on code, never on message
  message: z.string(),
  details: z.unknown().optional(),
});
```

Canonical code table: [PRD-API](./PRD-API.md) §4.0
(`FEATURE_DISABLED` is `400` for flag-gated shapes, `403` for
flag-gated actions).

## 5. Roles (`roles.ts` later)

```ts
const roleSchema = z.enum(['VIEWER', 'PHOTOGRAPHER', 'CURATOR', 'ADMIN']);
```

Single-role enum. Api source of truth is `ROLE_MATRIX`
(`common/auth/role-matrix.ts` when implemented); web imports the union
from contracts for guards (never redefines). Matrix:
[auth-rbac](../features/auth-rbac.md) §3.

## 6. Audit actions (`audit.ts` later — names only; event class stays api-internal)

```ts
const auditActionSchema = z.enum([
  'post.moderate',
  'post.withdraw',
  'post.retry',
  'comment.hide',
  'photo_item.replace',
  'photo_item.revert',
  'exhibition.phase_change',
  'feature_flag.toggle',
  'site_settings.update',
  'user.role_change',
]);
```

Envelope: `{ action, adminId, targetId, payload }`
(`adminId: null` for cron). The class + listener live in the api
`audit` module; web only renders the names returned by
`GET /api/admin/audit-logs`. Emitter list:
[curation-moderation](../features/curation-moderation.md) §5.

## 7. Derived worker-done signal (rule, not a field)

No `frameStatus` / `photo_items.status` column. Per-frame state derives:
`blurhash IS NULL` + parent `PROCESSING` = in-flight;
`blurhash IS NULL` + parent `FAILED_PROCESSING` = terminally failed.
Ready siblings stay viewable (null derivatives for failed frames,
owner only). Rule source: [series-upload](../features/series-upload.md)
§9; dashboard binding: [PRD-FE](./PRD-FE.md) §2.2.

## 8. Contract → consumer → status

| Contract (§) | Producer | Consumer(s) | Status |
|---|---|---|---|
| Cursor (2) | api endpoints | web lists, curator tools | spec-only |
| Error envelope (4) | api | web (branches on `code`) | spec-only |
| Queue payload (3) | api `queue` facade | worker consumer | spec-only |
| Roles (5) | `users` module | guards, web | spec-only (+ `examples/` demo) |
| Audit actions (6) | 9 emitters | `audit` module, web timeline | spec-only |
| Casing (1), derived signal (7) | — | all | rule, no code |

---

## Cross references

- DTO strategy (contracts → nestjs-zod → Swagger): [ADR-003](../adr/ADR-003-zod-dto-strategy.md)
- Module boundaries + facades + events: [ADR-005](../adr/ADR-005-modular-monolith.md)
- Cursor/error/flag canonical tables: [PRD-API](./PRD-API.md) §4.0
- Queue flow: [PRD-Worker](./PRD-Worker.md) §1
- Living example (deleted on first real module): `../../apps/api/src/modules/examples/`
