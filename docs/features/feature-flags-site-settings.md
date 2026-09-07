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

**Status:** Specced ([[PRD]] 0.4-draft) — not implemented
**Owner modules:** `feature-flags`, `site-settings`, `audit`
**Related:** [[PRD-API]] §2.9 + §4.6, [[db-schema]] (tables + seeds),
`docs/seed.ts` (`featureFlagsSeed`, `siteSettingsSeed`),
[[series-upload]] (consumes `series_enabled`, `max_series_size`),
[[engagement]] (consumes `threaded_comments_enabled`)

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
  `threaded_comments_enabled=false` (see `docs/seed.ts`).
- `site_settings` — **singleton** (`id=1` CHECK): `site_title`,
  `site_description`, `max_series_size` (`CHECK 1..20`, default 10),
  `maintenance_mode`, `contact_email`, `instagram_url`, `updated_at`,
  `updated_by`. Seed `id=1` (see `docs/seed.ts`).
- `system_settings` KV table is **deleted** (phase lives in
  `exhibitions.phase`; flags/limits live here). See [[db-schema]].

## 3. API — flags

### `GET /api/feature-flags` (public, filtered)

Array `[{key, enabled, updated_at}]` (no secrets). `Cache-Control:
public, max-age=10, stale-while-revalidate=60`.

#### `PATCH /api/admin/feature-flags/:key` (ADMIN, row-per-flag)

Body `{ "enabled": false }`. Validates `key` exists; invalidates cache
immediately; `updated_at` + `updated_by` auto-set; audits
(`action: feature_flag.toggle`, `payload: {key, before, after}`).

| Flag (`key`) | Default | Effect when `false` |
|---|---|---|
| `series_enabled` | `true` | `POST /api/posts` SERIES → `403 FEATURE_DISABLED` |
| `threaded_comments_enabled` | `false` | `POST` comments with `parentId` → `400 FEATURE_DISABLED` |

## 4. API — site settings

### `GET /api/site-settings` (public, filtered)

`{ site_title, site_description, max_series_size, maintenance_mode,
contact_email, instagram_url }`. Same CDN cache headers as flags.

#### `PATCH /api/admin/site-settings` (ADMIN, singleton)

Partial body (e.g. `{ "max_series_size": 8 }`). `CHECK` enforced.
**Grandfathering:** lowering `10` → `5` never invalidates existing
10-frame SERIES — only new `POST /api/posts` validates against the
current value. Audits (`action: site_settings.update`).

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
  limit (see [[series-upload]] §6).
- No admin UI for flags in 1.0 beyond direct `PATCH`? **Decision:**
  minimal toggles live on a future `/admin/settings` page (post-1.0);
  1.0 toggles via API client. Document, do not build UI now.

## 7. Worker

No involvement (reads flags only at API ingestion time; queued jobs
drain with the values at enqueue).

## 8. Schema touch

`feature_flags` + `site_settings` tables as specified (see
[[db-schema]]). Seeds in `docs/seed.ts`. No other tables.

## 9. Edge cases

- Unknown flag `key` on `PATCH` → `404 NOT_FOUND`.
- `max_series_size=0` or `>20` → `400 VALIDATION_ERROR` (CHECK).
- Toggle mid-upload (presign → create race) → create-time value wins.

## 10. Out of scope (post-1.0)

- `/admin/settings` UI; per-exhibition limits; flag targeting/rollout
  percentages; `maintenance_mode` enforcement middleware (column exists,
  behavior deferred).

## 11. Acceptance checklist

- [ ] `series_enabled=false` → new SERIES `403`, existing readable
- [ ] Lower limit `10`→`5` → old 10-frame SERIES still valid
- [ ] Toggle invalidates cache immediately (no 10s wait)
- [ ] `GET` endpoints carry CDN cache headers
