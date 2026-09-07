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

**Status:** Specced ([[PRD]] 0.4-draft) — not implemented
**Owner modules:** `auth`, `users`
**Related:** [[PRD-API]] §3 (+ §4.0 error contract), [[PRD-FE]] §6
(session/cookie/guards), [[db-schema]] (`users`),
[[ADR-005-modular-monolith|ADR-005]] Rule 2 (`users` owns `users.role`)

---

## 1. User stories

- As anyone, I log in with Google/GitHub OAuth (no passwords); browsing
  is public, liking/commenting/uploading needs a session.
- As an admin, I can find users and change their roles
  (`VISITOR`/`PHOTOGRAPHER`/`ADMIN`), including promoting fellow admins
  — but I cannot lock everyone out (self/last-admin guards).
- As the system, the very first admin is bootstrapped out-of-band
  (direct DB edit), exactly once.

## 2. Auth setup (Better Auth on the API)

- Library `@thallesp/nestjs-better-auth` mounted on NestJS; providers
  Google + GitHub OAuth 2.0.
- Web: `HTTP-Only`, `Secure`, `SameSite=Lax` first-party cookie — web +
  API must share one registrable domain (`app.*` + `api.*`,
  `trustedOrigins` + CORS) or `/api/*` reverse proxy (see [[PRD-FE]]
  §6, [[PRD]] §8.5).
- Future mobile: `Authorization: Bearer <token>` via `bearer()` plugin.
- `users` ids stay Better Auth-managed (`uuid`/`text`, **not** cuid2);
  `role` defaults `VISITOR`.

## 3. Guard chain & role matrix

`SessionGuard` → `RolesGuard` → `ExhibitionPhaseGuard` →
`FeatureFlagGuard` (see [[PRD-API]] §3.2 for the full endpoint matrix).
UI guards (middleware/HOC) redirect fast; API guards are the final
authority.

## 4. API — `GET /api/admin/users` (ADMIN only, NEW for 1.0)

Find users to manage. Query: `?search=` (substring `name`/`email`),
`?role=VISITOR|PHOTOGRAPHER|ADMIN`, `limit` (default `20`, max `50`),
`cursor` (§4.0 schema, `ORDER BY created_at, id`).

Response: `{ data: [{id, name, email, image, role, createdAt}],
nextCursor }` — public fields only, never sessions/tokens.

## 5. API — `PATCH /api/admin/users/:id/role` (ADMIN only, NEW for 1.0)

Promote/demote any user, including fellow admins (`:id` is the Better
Auth user id, **not** cuid2).

**Request Body (Zod enum, shared in `packages/contracts` when implemented):**

```json
{ "role": "PHOTOGRAPHER" }
```

**Rules:**

- Caller must be `ADMIN` (else `403 FORBIDDEN`).
- **Self-demotion forbidden** — admin cannot change their own role →
  `409 {code:"ROLE_CHANGE_DENIED", details:{reason:"self"}}`
  (prevents accidental lockout).
- **Last-admin protection** — demoting the final `ADMIN` →
  `409 {code:"ROLE_CHANGE_DENIED", details:{reason:"last_admin"}}`
  (counted in the same tx).
- No-op (same role) → `200`, no audit row.
- Effect: `UPDATE users SET role=:role WHERE id=:id` + audit
  `user.role_change` (`payload:{before,after}`). Role takes effect on
  the target's next session refresh (documented; no forced revoke 1.0).

**Response `200 OK`:** updated user (public fields).

## 6. Bootstrap (out-of-band, exactly once)

The first admin is created by **direct DB edit** (`UPDATE users SET
role='ADMIN' WHERE email='...'`). This is the *only* role change
allowed outside the API. No seed admin, no invite flow in 1.0.

## 7. Frontend (`/admin/users`, NEW for 1.0)

Summary (route to be added in [[PRD-FE]] §2.3): searchable table
(`GET /api/admin/users`) + per-row role dropdown → `PATCH` → toast +
refetch; own row's dropdown disabled (tooltip "You cannot change your
own role"); `last_admin` demotion attempt surfaces the `409` message.
Requires `ADMIN` (route guard + API guard).

## 8. Worker

No involvement.

## 9. Schema touch

Reads/writes `users.role` (see [[db-schema]]); audit
`user.role_change`. No new tables, no new columns.

## 10. Edge cases

- Unknown user id → `404 NOT_FOUND`.
- Invalid role string → `400 VALIDATION_ERROR` (Zod enum).
- Demote second-to-last admin while another demote in flight → tx
  `COUNT` check serializes (unique last-admin invariant holds).

## 11. Out of scope (post-1.0)

- Invite-token onboarding; forced session revoke on demotion; role
  request flow (photographer applies, admin approves); per-exhibition
  roles.

## 12. Acceptance checklist

- [ ] List searchable by name/email, filterable by role
- [ ] Promote VISITOR→PHOTOGRAPHER→ADMIN round-trips + audit rows
- [ ] Self role change → `409` self; demote last ADMIN → `409` last_admin
- [ ] Non-admin calls either endpoint → `403`
- [ ] New ADMIN can immediately use admin routes
