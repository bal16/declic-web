# ADR-003: Zod as DTO Source of Truth (Contracts → nestjs-zod → Swagger)

**Status:** Accepted
**Date:** 2026-09-04
**Org:** bal16
**Deciders:** repo owner
**Related:** `../PRD-API.md` §4, `../../apps/api/src/docs.ts`, `../../apps/api/src/main.ts`, `../../packages/contracts/src/posts.ts`

---

## 1. Context

NestJS Swagger documents endpoints through decorators/metadata on DTO
classes, while this repo's shared contracts are plain Zod schemas
(`@declic/contracts`, framework-free so the web app can import them).
Hand-writing `@ApiProperty` DTOs per endpoint would duplicate every
contract twice (once as Zod, once as decorators) and let the two drift —
the exact duplication the contracts package exists to prevent.

## 2. Decision

One Zod schema drives validation, types, and docs — bridged by
`nestjs-zod` (v5, Zod v4 via `z.toJSONSchema()`):

1. **Contracts stay pure Zod.** No NestJS imports in
   `packages/contracts`; web imports them dependency-free.
2. **API wrappers are one line each**, co-located with their module
   (`*.dto.ts`): `class XDto extends createZodDto(XSchema) {}`.
   The class carries the schema into NestJS validation
   (`ZodValidationPipe`) and Swagger (request bodies automatic;
   `@ZodResponse` / `Dto.Output` for responses). No hand-written
   `@ApiProperty`.
3. **One validation story:** global `ZodValidationPipe` in `main.ts`
   (safe for DTO-less routes like `/health`).
4. **`cleanupOpenApiDoc()` is mandatory** after
   `SwaggerModule.createDocument` whenever nestjs-zod DTOs exist —
   without it the document is malformed.
5. **Input vs output schemas stay distinct** (request DTO vs
   `@ZodResponse` output DTO), following nestjs-zod's input/output split.

## 3. Alternatives considered

* **Hand-written `@ApiProperty` DTOs** — rejected: every contract defined
  twice, drift guaranteed.
* **Wrappers inside `@declic/contracts`** — rejected: drags
  `@nestjs/swagger` transitively into the web bundle.
* **class-validator alongside Zod** — rejected: two validation systems,
  two failure shapes, no single source of truth.

## 4. Caveats (binding style rules)

* **Keep contract schemas OpenAPI-friendly:** plain objects, arrays,
  enums, optionals, unions (→ `anyOf`) map 1:1. `.refine()` is
  runtime-enforced but invisible to docs; `.transform()` shows the
  input shape. Cross-field rules belong in services, not schemas.
* **`ZodValidationPipe.transform` throws synchronously** (zod parsing is
  sync): tests must use try/catch + `expect.unreachable()`, not
  `expect(p).rejects` (which never receives a promise).

## 5. Verification (living proof, not copied code)

`apps/api/src/modules/examples/` exercises the full chain
(contracts → DTO → pipe → Swagger) with unit + e2e coverage and is
**explicitly marked for deletion** when the real posts module lands —
it proves the pattern, it is not the pattern's documentation.

```bash
bun run --filter "@declic/api" typecheck
bun run --filter "@declic/api" test
bun run --filter "@declic/api" test:e2e
PORT=3001 bun apps/api/src/main.ts &
curl -s -X POST localhost:3001/api/examples/works \
  -H 'content-type: application/json' \
  -d '{"title":"Diptych","type":"SERIES","itemCount":2}'
# open http://localhost:3001/docs — CreateExampleWorkDto rendered from Zod
```

## 6. Consequences

* Positive: adding an endpoint means writing one schema + one wrapper
  line; validation errors, TypeScript types, and `/docs` stay consistent
  by construction.
* Negative: contract authors must learn the OpenAPI-friendly subset;
  exotic Zod features need service-side handling instead.

---

## Cross references

* Living example: `../../apps/api/src/modules/examples/`
* Docs wiring: `../../apps/api/src/docs.ts`
* Contracts: `../../packages/contracts/src/`
* API spec: `../PRD-API.md`
