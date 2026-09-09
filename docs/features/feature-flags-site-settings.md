---
aliases:
  - Feature Flags
  - Site Settings
tags:
  - declic
  - feature
  - config
status: draft
updated: 2026-09-07
---

# Feature: Feature Flags & Site Settings (runtime kill-switches, global limits)

**Status:** Specced ([PRD](../specs/PRD.md) 0.4-draft) — not implemented
**Owner modules:** `feature-flags`, `site-settings`, `audit`
**Related:** [PRD-API](../specs/PRD-API.md) §2.9 + §4.6, [db-schema](../data/db-schema.md) (tables + seeds),
`docs/seed.ts` (`featureFlagsSeed`, `siteSettingsSeed`),
[series-upload](./series-upload.md) (consumes `series_enabled`, `max_series_size`),
[engagement](./engagement.md) (consumes `threaded_comments_enabled`)

---

## 1. User stories

- As an admin, I can disable SERIES creation instantly without a deploy
  (kill-switch) while existing SERIES stay readable.
- As an admin, I can tune the global series size limit; old oversized
  SERIES stay valid (grandfathering).
- As the system, flag/setting reads never hit the DB per page view
  (10s cache + CDN + frontend `staleTime`).

## 2. Schema

- `feature_flags` — **row-per-flag** (`key` PK, `enabled` bool,
  `description`, `updated_at`, `updated_by` FK). New flag = `INSERT`,
  no migration. Seeds: `series_enabled=true`,
  `threaded_comments_enabled=false`, `comments_enabled=true`
  (see `docs/seed.ts`).
- `site_settings` — **singleton** (`id=1` CHECK): `site_title`,
  `site_description`, `max_series_size` (`CHECK 1..20`, default 10),
  `maintenance_mode`, `contact_email`, `instagram_url`, `updated_at`,
  `updated_by`. Seed `id=1` (see `docs/seed.ts`).
- `system_settings` KV table is **deleted** (phase lives in
  `exhibitions.phase`; flags/limits live here). See [db-schema](../data/db-schema.md).

## 3. API — flags

### `GET /api/feature-flags` (public, filtered)

Array `[{key, enabled, updated_at}]` (no secrets). `Cache-Control:
public, max-age=10, stale-while-revalidate=60`.

#### `PATCH /api/admin/feature-flags/:key` (ADMIN, row-per-flag)

Body `{ "enabled": false }`. Validates `key` exists; invalidates cache
immediately; `updated_at` + `updated_by` auto-set; emits
`AuditRequestedEvent`
(`action: feature_flag.toggle`, `payload: {key, before, after}`).

**Response `200 OK`:** `{ "key": "series_enabled", "enabled": false, "updated_at": "..." }`.
Errors: `404 NOT_FOUND` (unknown `key`).

| Flag (`key`) | Default | Effect when `false` |
|---|---|---|
| `series_enabled` | `true` | `POST /api/posts` SERIES → `403 FEATURE_DISABLED` |
| `threaded_comments_enabled` | `false` | `POST` comments with `parentId` → `400 FEATURE_DISABLED` |
| `comments_enabled` | `true` | `POST /api/posts/:id/comments` → `403 FEATURE_DISABLED` (reads stay open; spam-emergency kill-switch) |

**Guard order on `POST /api/posts/:id/comments`:** `ExhibitionPhaseGuard`
first (exhibition-specific `ARCHIVED` freeze), then
`FeatureFlagGuard('comments_enabled')` (global emergency), then
`FeatureFlagGuard('threaded_comments_enabled')` for `parentId`. The
response `code` follows the first failing gate.

## 4. API — site settings

### `GET /api/site-settings` (public, filtered)

`{ site_title, site_description, max_series_size, maintenance_mode,
contact_email, instagram_url }`. Same CDN cache headers as flags.

> `maintenance_mode` contract (banner-only, 1.0): when `true`, every
> route renders a top banner `"Scheduled maintenance — browsing only,
> uploads may be delayed"`; all reads and writes still return `200`
> (no write is blocked). Enforcement middleware is post-1.0 (see §10).

#### `PATCH /api/admin/site-settings` (ADMIN, singleton)

Partial body (e.g. `{ "max_series_size": 8 }`). `CHECK` enforced.
**Response `200 OK`:** the updated `site_settings` row (`id=1`).
Errors: `400 VALIDATION_ERROR` (`max_series_size` outside `1..20`).
**Grandfathering:** lowering `10` → `5` never invalidates existing
10-frame SERIES — only new `POST /api/posts` validates against the
current value. Emits `AuditRequestedEvent` (`action: site_settings.update`).

## 5. Guards & caching

- `FeatureFlagGuard` reads the `Map<key,bool>` (in-memory 10s TTL per
  API instance, or Redis) + invalidates on `PATCH`.
- `POST /api/posts` reads `site_settings.max_series_size` from the same
  cache layer.
- Frontend caches both via `TanStack Query` `staleTime: 10_000`; admin
  toggle invalidates server-side immediately (kill-switch is instant,
  reads are cached).

## 6. Frontend

- Upload form hides SERIES toggle when `series_enabled=false` (+
  `FEATURE_DISABLED` toast path); `max_series_size` drives the drop
  limit (see [series-upload](./series-upload.md) §6).
- Comment inputs everywhere (gallery, lightbox, `/post/$postId`) are
  disabled with a frozen tooltip when `comments_enabled=false`,
  reusing the `ARCHIVED` frozen UI (see [engagement](./engagement.md) §5); reads
  remain. No new endpoint — status comes from the cached
  `GET /api/feature-flags`.
- **`/admin/settings` (IN for 1.0, minimal):** three toggles
  (`series_enabled`, `threaded_comments_enabled`, `comments_enabled`)
  plus one number input
  (`max_series_size` 1–20) over the existing `PATCH` endpoints;
  `TanStack Query` `staleTime: 10_000`; error mapping
  (`FEATURE_DISABLED`/`VALIDATION_ERROR` toasts); link to the audit
  trail (`GET /api/admin/audit-logs?action=feature_flag.toggle`). No new API.

## 7. Worker

No involvement (reads flags only at API ingestion time; queued jobs
drain with the values at enqueue).

## 8. Schema touch

`feature_flags` + `site_settings` tables as specified (see
[db-schema](../data/db-schema.md)). Seeds in `docs/seed.ts`. No other tables.

## 9. Edge cases

- Unknown flag `key` on `PATCH` → `404 NOT_FOUND`.
- `max_series_size=0` or `>20` → `400 VALIDATION_ERROR` (CHECK).
- Toggle mid-upload (presign → create race) → create-time value wins.

## 10. Out of scope (post-1.0)

- per-exhibition limits; flag targeting/rollout
  percentages; `maintenance_mode` enforcement middleware (`maintenance_mode`
  is banner-only in 1.0, see §4). A `likes_enabled` flag is explicitly
  rejected (like storms are absorbed by the composite PK + CDN; low
  blast radius). Worker flag consumption stays out (see §7).

## 11. Flag retirement (short-lived by default)

Every flag ships with an owner and an evaluation date. `threaded_comments_enabled`
is evaluated ship-or-kill; any flag permanently `true` for more than one
release must have its branch removed from code (not left as a dead `if`).
Retirement is verified by `grep` finding no reference to the retired key.

## 12. Acceptance checklist

- [ ] `series_enabled=false` → new SERIES `403`, existing readable
- [ ] `comments_enabled=false` → new comments `403 FEATURE_DISABLED`, reads ok
- [ ] Lower limit `10`→`5` → old 10-frame SERIES still valid
- [ ] Toggle invalidates cache immediately (no 10s wait)
- [ ] `GET` endpoints carry CDN cache headers
- [ ] `/admin/settings` toggles round-trip via `PATCH` + audit rows appear
