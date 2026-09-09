---
aliases:
  - Auth and RBAC
tags:
  - declic
  - feature
  - auth
status: draft
updated: 2026-09-07
---

# Feature: Auth & RBAC (OAuth, guards, role elevation)

**Status:** Specced ([PRD](../specs/PRD.md) 0.4-draft) — not implemented
**Owner modules:** `auth`, `users`
**Related:** [PRD-API](../specs/PRD-API.md) §3 (+ §4.0 error contract), [PRD-FE](../specs/PRD-FE.md) §6
(session/cookie/guards), [db-schema](../data/db-schema.md) (`users`),
[ADR-005](../adr/ADR-005-modular-monolith.md) Rule 2 (`users` owns `users.role`)

---

## 1. User stories

- As anyone, I log in with Google/GitHub OAuth (no passwords); browsing
  is public, liking/commenting needs a session, uploading needs a
  photographer (or above) role.
- As an admin, I can find users and change their roles
  (`VIEWER`/`PHOTOGRAPHER`/`CURATOR`/`ADMIN`), including promoting
  fellow admins and curators — but I cannot lock everyone out
  (self/last-admin guards).
- As a curator, I manage artworks (approve/reject, layout order,
  frame replace/revert, comment hide) but I cannot manage users,
  exhibitions, flags, or settings.
- As the system, the very first admin is bootstrapped out-of-band
  (direct DB edit), exactly once.

## 2. Auth setup (Better Auth on the API)

- Library `@thallesp/nestjs-better-auth` mounted on NestJS; providers
  Google + GitHub OAuth 2.0.
- Web: `HTTP-Only`, `Secure`, `SameSite=Lax` first-party cookie — web +
  API must share one registrable domain (`app.*` + `api.*`,
  `trustedOrigins` + CORS) or `/api/*` reverse proxy (see [PRD-FE](../specs/PRD-FE.md)
  §6, [PRD](../specs/PRD.md) §8.5).
- Future mobile: `Authorization: Bearer <token>` via `bearer()` plugin.
- `users` ids stay Better Auth-managed (`uuid`/`text`, **not** cuid2);
  `role` defaults `VIEWER`.
- Roles are a **hardcoded enum** (`ADMIN`, `CURATOR`, `PHOTOGRAPHER`,
  `VIEWER`) — no `roles`/`permissions` tables in 1.0. Anonymous
  (no session) is not a role; it only reaches `@Public()` reads.

## 3. Guard chain, central matrix & role cache

`SessionGuard` → `RolesGuard` → `ExhibitionPhaseGuard` →
`FeatureFlagGuard` (see [PRD-API](../specs/PRD-API.md) §3.2 for the full endpoint matrix).
UI guards (middleware/HOC) redirect fast; API guards are the final
authority.

**`SessionGuard`:** validates the Better Auth session (first-party cookie)
or `Bearer` token (mobile); no valid session → `401 {code:"UNAUTHENTICATED"}`.
`@Public()` (no session needed): `GET /api/posts`, `GET /api/posts/:id`,
`GET /api/posts/:id/comments`, `GET /api/exhibitions`, `GET /api/exhibitions/:slug`,
`GET /api/exhibitions/:id/posts`, `GET /api/feature-flags`, `GET /api/site-settings`,
plus the Better Auth mount itself. Everything else requires a session.

Per-endpoint guards only (no global default-deny). Union is **manual**:
every guarded endpoint lists `ADMIN` explicitly — `RolesGuard` has no
implicit superset rule.

### 3.1 Central permission-key map (single source)

Role literals live in exactly one file (`common/auth/role-matrix.ts`);
controllers reference keys, never raw roles:

```typescript
export const ROLE_MATRIX = {
  'users:read':      ['ADMIN'],
  'users:write':     ['ADMIN'],
  'exhibitions:write': ['ADMIN'],
  'flags:write':     ['ADMIN'],
  'settings:write':  ['ADMIN'],
  'audit:read':      ['ADMIN', 'CURATOR'],
  'moderate:write':  ['ADMIN', 'CURATOR'],
  'curate:write':    ['ADMIN', 'CURATOR'],
  'replace:write':   ['ADMIN', 'CURATOR'],
  'posts:write':     ['ADMIN', 'PHOTOGRAPHER'],
  'posts:own':       ['ADMIN', 'PHOTOGRAPHER'],
} as const;
// usage: @Require('moderate:write')  (likes/comments need session only;
// public gallery is @Public() — see matrix in [PRD-API](../specs/PRD-API.md) §3.2)
```

Key → endpoint binding (owner checks live in the service, not the guard):
`posts:write` = `POST /api/posts/upload-url`, `POST /api/posts`;
`posts:own` = `PATCH /api/posts/:id`, `PATCH /api/posts/:id/items/reorder`,
`DELETE /api/posts/:id` (owner or `ADMIN`); `replace:write` also covers
`POST .../frames/:itemId/revert`; like/comment creation needs session
only (freeze enforced by `ExhibitionPhaseGuard` + `FeatureFlagGuard`).

> Ownership is a row fact (`photographer_id`), not a role: a user whose
> role changed (e.g. `PHOTOGRAPHER` → `CURATOR`) keeps owner rights on
> works they shot — the guard passes on owner-match **or** role-allowlist.
> Roles are global in v1 (no per-exhibition curator — out of scope):
> a `CURATOR` may moderate any exhibition's works.

Changing one rule = editing one row here. If the mapping ever moves to
DB (hybrid pattern), only this map's source changes (const → cached
query); no controller is touched. `users` module stays the sole writer
of `users.role` ([ADR-005](../adr/ADR-005-modular-monolith.md) Rule 2), so a
future storage change (e.g. `user_roles` join table) lands in one
module.

### 3.2 Role-read cache (in-memory + active invalidation)

`RolesGuard` resolves `user → role` through a `RoleCache` seam:

- **1.0:** in-memory `Map` per API instance (same pattern as
  `feature_flags`, see [feature-flags-site-settings](./feature-flags-site-settings.md) §5).
- Key `user:{id}` → role; **TTL 60s** as safety net only.
- **Invalidation is active, not TTL-driven:** `PATCH .../role` deletes
  the key synchronously inside the same tx as the `UPDATE` + audit row,
  before the response returns. Effect is immediate; no forced session
  revoke in 1.0.
- No-op (same role) → cache untouched, no audit row.
- **Later:** swap the seam to Redis when the API runs multi-instance.
  Callers (`RolesGuard`, `users` facade) do not change.

## 4. API — `GET /api/admin/users` (ADMIN only, NEW for 1.0)

Find users to manage. Query: `?search=` (substring `name`/`email`),
`?role=VIEWER|PHOTOGRAPHER|CURATOR|ADMIN`, `limit` (default `20`,
max `50`), `cursor` (§4.0 schema, `ORDER BY created_at, id`).

Response: `{ data: [{id, name, email, image, role, createdAt}],
nextCursor }` — public fields only, never sessions/tokens.

## 5. API — `PATCH /api/admin/users/:id/role` (ADMIN only, NEW for 1.0)

Promote/demote any user, including fellow admins and curators (`:id`
is the Better Auth user id, **not** cuid2).

**Request Body (Zod enum, shared in `packages/contracts` when implemented):**

```json
{ "role": "PHOTOGRAPHER" }
```

**Rules (evaluated top-down — guards before shortcuts):**

- Caller must be `ADMIN` (else `403 FORBIDDEN`).
- **Self-demotion forbidden** — admin cannot change their own role →
  `409 {code:"ROLE_CHANGE_DENIED", details:{reason:"self"}}`
  (prevents accidental lockout; wins over the no-op rule below — even a
  same-role self-`PATCH` is `409`).
- **Last-admin protection** — demoting the final `ADMIN` →
  `409 {code:"ROLE_CHANGE_DENIED", details:{reason:"last_admin"}}`
  (counted in the same tx).
- No-op (same role, other user) → `200`, no audit row, cache untouched.
- Effect (one tx): `UPDATE users SET role=:role WHERE id=:id` + emit
  `AuditRequestedEvent` (`action='user.role_change'`,
  `payload:{before,after}`) + `RoleCache`
  invalidation for `:id`. Visible on the target's very next request.
- Only the `users` module writes `users.role` (sole writer,
  [ADR-005](../adr/ADR-005-modular-monolith.md) Rule 2).

**Response `200 OK`:** updated user (public fields).

## 6. Bootstrap (out-of-band, exactly once)

The first admin is created by **direct DB edit** (`UPDATE users SET
role='ADMIN' WHERE email='...'`). This is the *only* role change
allowed outside the API. No seed admin, no invite flow in 1.0.
Launch runbook: collect photographer emails → each logs in once via
OAuth (creating `VIEWER` rows) → admin bulk-promotes to
`PHOTOGRAPHER` from `/admin/users` (or a one-off script over the same
`PATCH` endpoint).

## 7. Frontend (`/admin/users`, NEW for 1.0)

Summary (route to be added in [PRD-FE](../specs/PRD-FE.md) §2.3): searchable table
(`GET /api/admin/users`) + per-row role dropdown + bulk-select promote
(checkbox → one promote action for launch onboarding) → `PATCH` → toast +
refetch; own row's dropdown disabled (tooltip "You cannot change your
own role"); `last_admin` demotion attempt surfaces the `409` message.
Requires `ADMIN` (route guard + API guard).

Route guards: `/dashboard/*` → session + `PHOTOGRAPHER|ADMIN`;
`/admin/*` → session + `ADMIN`, except artwork routes
(`/admin/moderation`, `/admin/curate`, `/admin/comments`) which allow
`ADMIN|CURATOR` (see [PRD-FE](../specs/PRD-FE.md) §2.3).

## 8. Worker

No involvement.

## 9. Schema touch

Reads/writes `users.role` (see [db-schema](../data/db-schema.md)); audit
`user.role_change`. No new tables, no new columns. `RoleCache` is
runtime-only (never persisted).

## 10. Edge cases

- Unknown user id → `404 NOT_FOUND`.
- Invalid role string → `400 VALIDATION_ERROR` (Zod enum).
- Demote second-to-last admin while another demote in flight → tx
  `COUNT` check serializes (unique last-admin invariant holds).
- Stale cache (single-instance crash between `UPDATE` and invalidate)
  → heals via 60s TTL; worst case is a 60s delay, never a wrong grant
  (cache only ever holds a previously-valid role).

## 11. Out of scope (post-1.0)

- Invite-token onboarding; forced session revoke on demotion; role
  request flow (photographer applies, admin approves); per-exhibition
  roles; `roles`/`permissions` tables (hybrid pattern); Redis-backed
  `RoleCache`.

## 12. Acceptance checklist

- [ ] List searchable by name/email, filterable by role (4 values)
- [ ] Promote VIEWER→PHOTOGRAPHER→CURATOR→ADMIN round-trips + audit rows
- [ ] Self role change → `409` self; demote last ADMIN → `409` last_admin
- [ ] Non-admin (incl. CURATOR) calls either endpoint → `403`
- [ ] New ADMIN/CURATOR can immediately use their routes (cache
  invalidated — no stale-role delay beyond one request)
- [ ] CURATOR cannot reach `/admin/users`, flags, settings, exhibitions
  CRUD → `403`
- [ ] One-row change in `ROLE_MATRIX` flips exactly one rule (no stray
  literals — grep `ADMIN.*CURATOR` outside the matrix finds nothing)
- [ ] OAuth login (Google/GitHub) round-trips to a session; anon gallery
  reads stay `@Public()`; no-session write → `401 UNAUTHENTICATED`
- [ ] First admin via direct DB edit works exactly once (documented runbook)
- [ ] `VIEWER` calls `POST /api/posts/upload-url` → `403 FORBIDDEN`
