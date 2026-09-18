---
aliases:
  - ADR-009
tags:
  - declic
  - adr
status: accepted
updated: 2026-09-18
---
# ADR-009: Nested RBAC Layout Routes (Admin ⊂ Authed)

**Status:** Accepted
**Date:** 2026-09-18
**Org:** bal16
**Deciders:** repo owner (codeowner)
**Related:** `../specs/PRD-FE.md` §6.3, `../guides/frontend.md` §1/§3, `../specs/PRD-UI.md` §2/§7, `../../../packages/contracts/src/roles.ts`

---

## 1. Context

Findings (verified, not assumed):

* **PRD lists flat sibling layouts.** PRD-FE §6.3 and the frontend guide
  describe `_authed.tsx` (session) and `_admin.tsx` (role) as siblings
  under `routes/`, each with `beforeLoad` guards. That matches URLs
  (`/dashboard`, `/moderation`, … — pathless layouts add no segments) but
  expresses no relationship between them.
* **Domain truth: admin IS-A authed user.** Roles come from one union in
  contracts (`VIEWER | PHOTOGRAPHER | CURATOR | ADMIN`,
  `packages/contracts/src/roles.ts`; guest = no session). Every staff
  member (curator, admin) is first an authenticated user. The flat
  structure forces the session check to be written twice (once per
  layout) and hides this relationship from the route tree.
* **Shell reuse forces the question.** Designing the dashboard panel
  showed admin/curator pages need the identical panel shell
  (`SidebarProvider` + `AppSidebar` + `Header`), differing only in nav
  items. With sibling layouts the shell would be composed per page or
  duplicated per layout.
* **Generator constraint (empirical).** TanStack's route generator
  (`checkRouteFullPathUniqueness`, `@tanstack/router-generator`) only
  checks routes *without children*. Bare sibling pathless layouts plus
  `index.tsx` resolve to three leaves at `/` and fail the build; layouts
  with children are exempt. Nesting therefore also satisfies the
  toolchain, but that is a side benefit, not the reason.
* **Auth plumbing is not ready.** No auth client exists in `apps/web`
  yet (`lib/auth-client.ts` is still "when guards land" per the
  frontend guide). Any guard design must work against a stub session
  today and swap to Better Auth later at exactly one point.

## 2. Decision

Nest the staff layout **inside** the session layout; put the shared
panel shell in the session layout with role-driven nav:

```
_authed.tsx                    # session wall + shell + <Outlet/>
_authed/dashboard/*            # PHOTOGRAPHER|ADMIN per page
_authed/_admin.tsx              # CURATOR|ADMIN wall + <Outlet/>
_authed/_admin/moderation|curate|comments   # inherit staff, no extra check
_authed/_admin/exhibitions|users|settings   # +ADMIN per page
```

1. `_authed.tsx` runs `requireSession()` in `beforeLoad` (anonymous →
   redirect `/login`) and renders the shell. Nav items resolve from
   `navByRole[role]`; the page title comes from each page's
   `staticData.title`, read via `useMatches()`.
2. `_authed/_admin.tsx` runs `requireRoles(['CURATOR', 'ADMIN'])` in
   `beforeLoad` and renders `<Outlet/>` only (inherits the shell).
3. Dashboard pages run `requireRoles(['PHOTOGRAPHER', 'ADMIN'])`;
   a logged-in `VIEWER` on `/dashboard/*` redirects to `/`.
   `exhibitions`/`users`/`settings` run `requireRoles(['ADMIN'])`.
4. Roles are `z.infer<typeof roleSchema>` from `@declic/contracts`
   (never redefined, never raw strings).
5. Until Better Auth lands, `useSessionRole()` is a stub returning
   `'ADMIN'`, marked `TODO`, swapped at that single point. Guard
   helpers live in `features/shared/auth/` (`session.ts`, `guards.ts`).

Rejected explicitly:

* **Sibling layouts + shared shell component.** Zero restructure, but
  the session check is duplicated and the admin⊂authed relationship
  stays invisible in the tree. Chosen against because structure should
  state domain truth, not just produce correct URLs.
* **No `_admin` layout; per-page role checks.** Scatters role logic
  across files — a step back from the layout design already adopted.
* **Separate `_curator` layout.** No need yet: one staff layout with
  per-page tightening covers `CURATOR|ADMIN` vs `ADMIN`-only.

## 3. Alternatives considered

### A. Nested layouts + shell in `_authed` (this ADR) — accepted

Single session check, role composition mirrors the domain, shell
inherited for free, URLs unchanged. Cost: file moves
(`_admin/*` → `_authed/_admin/*`) and longer route ids — both
mechanical, verified by regeneration + typecheck.

### B. Status quo (flat siblings) — rejected

Works for URLs but duplicates the session wall and leaves the shell
homeless (per-page composition or duplicated layout code). The
owner, as codeowner, explicitly doubted this split after the
dashboard design showed staff needs the same shell.

## 4. Consequences

* Positive: guard logic lives in exactly two layouts plus small
  per-page tightenings; every staff page automatically sits inside
  the session wall and the panel shell; role-driven nav is data
  (`navByRole`), not branches.
* Negative: deeper nesting in ids and file paths; `_authed.tsx`
  grows beyond "wrapper only" (it owns the shell) — the frontend
  guide's route-file rule is updated to allow shell ownership in
  layouts while pages stay thin.
* Watch: the `VIEWER → /` redirect on `/dashboard/*` vs the `403`
  page for insufficient role elsewhere (PRD-UI §7) is now
  inconsistent by owner decision — dashboard redirects, admin area
  keeps 403 until decided otherwise. Recorded, not resolved.

## 5. Verification

* `bun run --filter @declic/web build` (routeTree regenerates with
  nested ids, no `/` conflict).
* `bun run --filter @declic/web typecheck`, `bun run lint`,
  `bun test src/` (web), `test:e2e`.
* Manual: anonymous → `/login`; viewer on `/dashboard` → `/`;
  `/moderation`, `/settings` render inside the shell.

## 6. Open questions / follow-ups (not blocking)

1. **Better Auth swap.** Replace the session stub with the real
   client; the swap point is `useSessionRole()`. No layout changes
   expected.
2. **Admin-area wrong-role UX.** Dashboard redirects `/`; admin
   pages keep the 403 page (PRD-UI §7). Unify or keep split —
   owner call.
3. **`/photo/$postId` alias.** Still missing (PRD-UI §2); unrelated
   one-file redirect, tracked separately.

---

## Cross references

* Guard implementation pattern: `../specs/PRD-FE.md` §6.3
* Route structure + guard rules: `../guides/frontend.md` §1, §3
* Role union (single source): `../../../packages/contracts/src/roles.ts`
* UI guard mapping: `../specs/PRD-UI.md` §2, §7
