---
aliases:
  - Frontend Guide
tags:
  - declic
  - frontend
status: draft
updated: 2026-09-09
---

# Frontend Guide (`apps/web`, TanStack Start)

**Status:** Draft (for owner review)
**Related:** [DESIGN](./DESIGN.md) (design contract), [PRD-FE](./PRD-FE.md) (full UI spec), [contracts](./contracts.md) (shared shapes)

How the web app is built: structure, data flow, guards, env, tests.
*What* to build lives in [PRD-FE](./PRD-FE.md); *how it looks* in
[DESIGN](./DESIGN.md). This file is *how it is organized*.

---

## 1. Folder structure (feature-based, thin routes)

```text
src/
├── router.tsx            # getRouter() factory + Register augmentation
├── routes/               # THIN: route definition + composition only
│   ├── index.tsx         # loader + <GalleryFeature/> (~20 lines)
│   ├── post.$postId.tsx  # route masking for lightbox + <WorkDetailFeature/>
│   └── dashboard/
│       ├── index.tsx     # guard + <DashboardFeature/>
│       └── upload.tsx    # guard + <UploadFeature/>
├── routeTree.gen.ts      # generated AND committed (typecheck needs it)
├── features/             # implementation per feature
│   ├── gallery/          # components, hooks, queries, index.ts barrel
│   ├── work-detail/
│   ├── upload/
│   ├── dashboard/
│   ├── moderation/
│   └── curate/
├── components/ui/        # shadcn-style copy-paste (Base UI primitives) only
├── lib/
│   ├── env.ts            # VITE_* config (existing)
│   └── i18n/             # id.ts (v1), en.ts (later), t() accessor
├── styles.css            # tokens (@theme inline) + Tailwind entry
└── test/ (mirrors src)   # bun test, co-located *.test.ts
```

Rules (3, easy to remember):

1. **Route file = loading + composition only** — `loader`/`beforeLoad`
   (guards), `head`/meta, then render one or two feature components.
   No business logic, no styling, no hooks beyond router-provided. If
   a route file passes ~30 lines, something leaked.
2. **Feature = self-contained unit** — components + hooks + query
   options colocated, exported via `index.ts` barrel (mirrors the
   backend `public-api.ts` pattern — one door per feature).
3. **One-way imports** — `routes → features → {ui, lib, contracts}`;
   feature-to-feature only via barrels; `ui`/`lib` never import
   features or routes.

`@/*` = `src` (see [ADR-007](./adr/ADR-007-path-aliases.md));
generated files (`routeTree.gen.ts`, `.output/`) never hand-edited.

## 2. Data flow (TanStack Query)

- Server state only via Query: `queryKey` per resource
  (`['posts', exhibitionId, sort]`, `['comments', postId]` …);
  `staleTime: 10_000` (matches API/flag TTLs); cursor pagination via
  `useInfiniteQuery` (`cursor` + `nextCursor`, never raw id sort).
- Mutations use `onMutate` optimistic update + rollback on error
  (like button, reorder, moderation actions) — reconcile with the
  returned payload (`likesCount`, echoed order).
- Type the wire with `@declic/contracts` (import type only — never
  redefine shapes; camelCase per [contracts](./contracts.md) §1).
- Errors branch on `code` (never message text) → toasts per
  [DESIGN](./DESIGN.md) §6 copy table.

## 3. Guards + Auth Wall

- `beforeLoad` on layout routes (fast path) + API guards as final
  authority (UI guard never replaces API guard).
- Not logged in → **uniform Auth Wall modal** on every surface
  (gallery, lightbox, detail, dashboard, upload); modal preserves
  state (file-drop, draft, pending like). Redirect to `/login` only
  for direct navigation there.
- Role gates: `/dashboard/*` → `PHOTOGRAPHER|ADMIN`; `/admin/*` →
  `CURATOR|ADMIN` or `ADMIN` per route; insufficient role → 403 page.
  Roles come from the session union in contracts (never raw strings).

## 4. Env + config

- Vite reads root `.env` via `envDir: '../../'`; only `VITE_*` reaches
  the browser (`VITE_API_URL`, `VITE_BETTER_AUTH_URL`).
- Runtime config in `lib/env.ts` (existing) — no other file reads
  `import.meta.env` directly.

## 5. Testing

- `bun test src/` unit (components + lib, co-located `*.test.ts`);
  `bun test test/` e2e (boots Nitro build, fetches over HTTP —
  build output required first, see root `test:e2e` ordering).
- Coverage follows the repo ≥90% release gate; web e2e covers
  gallery render + one authenticated flow when auth lands.

## 6. Branching into this app (mirrors!)

`apps/web` ships to the **public** mirror (`declic-web`). The
leak-guard fails CI if `apps/web` references server secrets or
`apps/(api|worker)` paths — never import them, even in comments or
types. Mirror carries `apps/web` + `packages/*` slice + manifest only.

---

## Cross references

- Full UI spec: [PRD-FE](./PRD-FE.md)
- Design contract: [DESIGN](./DESIGN.md)
- Shared shapes: [contracts](./contracts.md)
- Mirror + leak-guard: [ADR-001](./adr/ADR-001-monorepo-mirror.md), `ci.yml`
