---
aliases:
  - Backend API PRD
  - API PRD
tags:
  - declic
  - prd
  - api
status: draft
updated: 2026-09-01
---
# PRD Backend API: Déclic — Core REST API Server & Authentication System

**Version:** 0.4-draft (2026-09-01)  
**App Version:** 0.x pre-release — `1.0.0` at first exhibition launch (PRD draft version is independent of app semver)
**Main Stack:** NestJS, Bun 1.4, PostgreSQL, Drizzle ORM / TypeORM, Better Auth, MinIO SDK, BullMQ  
**Target:** Core REST API Server & Authentication System  
**Status:** Draft
**Last updated:** 2026-09-01

> [!abstract] This document is the technical specification for the **Backend API** of the Déclic platform. For the asynchronous image processing pipeline, see [PRD-Worker](./PRD-Worker.md). For the canonical DB diagram, see [db-schema](../data/db-schema.md). This version (0.4-draft) introduces **SERIES** (`posts` + `photo_items`), **runtime feature flags** (kill-switch), **cuid2** for domain tables, **multi-exhibition** (`exhibitions` + `posts.exhibition_id`, root = latest) and **ARCHIVED freeze** (likes/comments read-only) plus **BullMQ cron** `exhibition-scheduler`.

---

## 1. Scope & System Architecture

The API server is fully responsible for authentication, transactional data management, role-based authorization (RBAC), Presigned URL generation for media uploads, and triggering the image processing queue.

An **exhibition** (`exhibitions`) groups works and has its own lifecycle (`PRE_EVENT` → `LIVE` → `ARCHIVED`, auto via cron). A **work (post)** belongs to one `exhibitions.id` and can be `SINGLE` or `SERIES`. Likes/comments/curation operate on the **post**, not on individual frames. Root `/` always serves the **latest published exhibition**. Feature flags provide a **runtime kill-switch** without deploy (see §2.9, §3.3, §5).

### 1.1 NestJS Module Architecture

```text
src/
├── modules/
│   ├── auth/          # Better Auth mount, OAuth handler, SessionGuard, RolesGuard
│   ├── users/         # User profile and role management (Better Auth ids, not cuid2)
│   ├── exhibitions/   # Exhibitions CRUD, slug, phase, scheduler (exhibition-scheduler cron), poster presign (`POST /api/admin/exhibitions/:id/poster-upload-url` via storage facade, `posters/` prefix)
│   ├── posts/         # Posts + photo_items ingestion, public queries, pagination (scoped by exhibition_id)
│   │   └── photo-items/ # Frames within a post (item_order, original_s3_key, source, blurhash, exif)
│   ├── curation/      # Layout ordering at post level per exhibition (LexoRank)
│   ├── moderation/    # Work approval workflow per exhibition (Approve/Reject per post)
│   ├── engagement/    # Likes & Comments on posts (freeze when exhibition ARCHIVED)
│   ├── storage/       # MinIO / S3 SDK integration (Presigned URL generation)
│   ├── queue/         # BullMQ producer (per photo_item) + scheduler (exhibition-scheduler)
│   ├── feature-flags/ # Row-per-flag feature_flags (key, enabled) — scalable, no migration
│   ├── site-settings/ # Singleton site_settings (id=1, max_series_size, site_title, maintenance_mode)
│   └── audit/         # Admin audit logs (exhibition.phase_change, photo_item.replace, flag toggle)
└── common/            # Interceptors, Filters, Guards, Decorators (FeatureFlagGuard, ExhibitionPhaseGuard)
```

> **Naming note:** New endpoints use `/api/posts`. Legacy `/api/photos` is aliased to `/api/posts` for backwards compatibility and will be deprecated. Docs below use canonical `/api/posts`.

**API responsibilities:**

- Mount Better Auth (`@thallesp/nestjs-better-auth`) — single source of truth for `users`, `sessions`, `accounts` (ids remain Better Auth-managed, not cuid2).
- Validate **per-exhibition phase** (`exhibitions.phase`) and **feature flags** (`feature_flags` table) on all mutation endpoints via `ExhibitionPhaseGuard` + `FeatureFlagGuard`.
- Generate Presigned URLs (MinIO/S3) — direct client → MinIO upload bypassing the API (batch for SERIES).
- Create `posts` + `photo_items` transactionally scoped to `exhibitions.id` (ids `cuid2` via app), then push **one BullMQ job per photo_item** to `image-processing`.
- Run **BullMQ cron** `exhibition-scheduler` (hourly) to auto `LIVE` → `ARCHIVED` when `end_date <= now()`.
- Enforce RBAC via `SessionGuard` + `RolesGuard` + `FeatureFlagGuard` + `ExhibitionPhaseGuard` at the API layer.

---

## 2. Database Schema & Data Model (PostgreSQL)

> Canonical structure: [db-schema](../data/db-schema.md) §1 (columns, types, constraints — the Mermaid diagram lives there). This section specifies **behavior** only and never redefines columns; on any shape question, db-schema wins.

**ID generation rule:**

- `users.id` — Better Auth-managed (`uuid`/`text`), unchanged.
- All **domain tables** (`exhibitions`, `posts`, `photo_items`, `photo_derivatives`, `comments`, `admin_audit_logs`, and FKs `exhibition_id`/`post_id`/`photo_item_id`/`target_id`/`parent_id`) — **`text` PK with `cuid2` generated in application** (`@paralleldrive/cuid2` `createId()`). No `DEFAULT gen_random_uuid()` in DB. Ordering/pagination must use `created_at` + `display_order`, never lexicographic `id` sort (`cuid2` is not ULID-sortable — cursor uses `created_at`).

### 2.1 `users` (Managed jointly with Better Auth — NOT cuid2)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` / `text` | PK | Unique user ID (per Better Auth adapter, unchanged) |
| `name` | `varchar(255)` | NOT NULL | Full name |
| `email` | `varchar(255)` | NOT NULL, UNIQUE | OAuth email |
| `image` | `text` | NULLABLE | Avatar URL |
| `role` | `enum` | NOT NULL, DEFAULT `'VIEWER'` | `'VIEWER'`, `'PHOTOGRAPHER'`, `'CURATOR'`, `'ADMIN'` |
| `created_at` | `timestamp` | DEFAULT `now()` | Registration time |
| `updated_at` | `timestamp` | NULLABLE | Last profile update (Better Auth adapter) |

> `role` defaults to `VIEWER` — elevation to `PHOTOGRAPHER`/`CURATOR`/`ADMIN` is done by an Admin via `PATCH /api/admin/users/:id/role` (see [auth-rbac](../features/auth-rbac.md)). No seed admin — the first admin is a one-off direct DB edit. `users` ids are **not** switched to cuid2 — keep Better Auth compatibility.

### 2.2 `exhibitions` — cuid2

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | PK, `cuid2` (app-generated) | Exhibition ID |
| `title` | `varchar(255)` | NOT NULL | Exhibition title (e.g. “Déclic 2026”) |
| `slug` | `varchar(255)` | NOT NULL, UNIQUE | URL slug (`declic-2026`), used in `/exhibition/[slug]` |
| `description` | `text` | NULLABLE | Curatorial statement |
| `phase` | `enum` | NOT NULL, DEFAULT `'PRE_EVENT'` | `'PRE_EVENT'`, `'LIVE'`, `'ARCHIVED'`, `'DRAFT'` — per-exhibition lifecycle |
| `poster_s3_key` | `text` | NULLABLE | Poster image path in MinIO (`posters/` prefix; single file, no derivatives, no worker). Presigned via `POST /api/admin/exhibitions/:id/poster-upload-url` (same allowlist/size rules as photos, `expiresIn: 900`); gated on `phase != ARCHIVED` |
| `location` | `varchar(255)` | NULLABLE | Venue (e.g. “Gedung CLIC UNNES”) |
| `start_date` | `timestamp` | NOT NULL | Exhibition start — used to order `latest` |
| `end_date` | `timestamp` | NOT NULL | Exhibition end — **cron trigger** `LIVE` → `ARCHIVED` when `end_date <= now()` |
| `created_by` | `uuid` / `text` | FK → `users.id`, ON DELETE SET NULL | Creator admin |
| `created_at` | `timestamp` | DEFAULT `now()` | Creation time |
| `updated_at` | `timestamp` | DEFAULT `now()` | Last update |

Indexes: `slug` UNIQUE, `phase`, `start_date DESC` (for `latest`), `end_date`. Root `/` resolves to latest `LIVE` (`ORDER BY start_date DESC LIMIT 1`), fallback latest `ARCHIVED` when no `LIVE`; `DRAFT`/`PRE_EVENT` never resolve as root (`DRAFT` excluded by default, `PRE_EVENT` closed for public gallery); `/archive` lists `ARCHIVED` ordered by `start_date DESC`.

**Phase lifecycle:** `DRAFT` → `PRE_EVENT` → `LIVE` → `ARCHIVED`. `DRAFT` is **invisible-to-public**: excluded by default from `GET /api/exhibitions` and from every public gallery query (only `ADMIN` may pass `?phase=DRAFT`); used to prepare the next exhibition while the current one is `LIVE` without leaking. `PRE_EVENT` opens submissions, `LIVE` is the public spike window, `ARCHIVED` is the cron-driven read-only freeze (see PRD §8.4).

> `system_settings` is deleted. Phase lives only in `exhibitions.phase` (per exhibition, see §2.2).

### 2.3 `posts` (Works — SINGLE or SERIES) — cuid2

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | PK, `cuid2` (app-generated) | Unique Work ID |
| `exhibition_id` | `text` | FK → `exhibitions.id`, ON DELETE CASCADE, INDEX | Parent exhibition — determines visibility (latest vs archive) and phase guard |
| `photographer_id` | `uuid` / `text` | FK → `users.id`, ON DELETE CASCADE | Owner (matches users type) |
| `title` | `varchar(255)` | NOT NULL | Work title (shared for SERIES) |
| `caption` | `text` | NULLABLE | Work narrative (shared) |
| `type` | `enum` | NOT NULL, DEFAULT `'SINGLE'` | `'SINGLE'`, `'SERIES'` |
| `status` | `enum` | NOT NULL, DEFAULT `'PROCESSING'` | `'PROCESSING'`, `'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'PUBLISHED'`, `'UNPUBLISHED'`, `'FAILED_PROCESSING'` (terminal failure after 3 worker attempts; retryable, withdrawable) |
| `rejection_reason` | `text` | NULLABLE | Curator note if rejected (per work) |
| `display_order` | `varchar(255)` | INDEX | LexoRank / Fractional Index at **work** level |
| `likes_count` | `integer` | NOT NULL, DEFAULT `0` | Denormalized cache — maintained transactionally; source of truth is `likes` |
| `comments_count` | `integer` | NOT NULL, DEFAULT `0` | Denormalized cache — maintained transactionally |
| `created_at` | `timestamp` | DEFAULT `now()` | Creation time (cursor for pagination) |
| `updated_at` | `timestamp` | DEFAULT `now()` | Last update |
| `deleted_at` | `timestamp` | NULLABLE | Soft delete (future; queries filter `deleted_at IS NULL`) |

Indexes: `exhibition_id`, `display_order`, `status`, `photographer_id`, `created_at`, `type`. Composite: `(exhibition_id, status)` for gallery query; **do not** order by `id`.

### 2.4 `photo_items` (Frames within a work) — cuid2

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | PK, `cuid2` (app-generated) | Frame ID |
| `post_id` | `text` | FK → `posts.id`, ON DELETE CASCADE | Parent work |
| `item_order` | `integer` | NOT NULL | Order inside SERIES (0-based) |
| `original_s3_key` | `text` | NOT NULL | Original file path in MinIO (`raw-uploads/...`, curated replacement overwrites but old kept in audit `payload.old_s3_key`) |
| `source` | `enum` | NOT NULL, DEFAULT `'ORIGINAL'` | `'ORIGINAL'` (photographer) or `'CURATED'` (admin replacement) — non-destructive, original file remains in `raw-uploads/` |
| `blurhash` | `varchar(100)` | NULLABLE | Visual placeholder (per frame, regenerated on replace) |
| `exif_metadata` | `jsonb` | NULLABLE | Camera, Lens, FNumber, Exposure, ISO, etc. (per frame, updated on replace if provided) |
| `created_at` | `timestamp` | DEFAULT `now()` | Upload time |
| `updated_at` | `timestamp` | DEFAULT `now()` | Last curator replacement time |

Unique: `(post_id, item_order)`. Index: `post_id`, `source`.

> A SINGLE work has exactly 1 row here (`item_order=0`). A SERIES has 2–N (limit `site_settings.max_series_size`, default 10). **Option C:** admin replacement does **not** create a new `photo_items` row — it updates `original_s3_key`/`source`/`blurhash`/`exif_metadata` in place and re-enqueues a worker job to regenerate derivatives; the old `s3_key` is preserved in `admin_audit_logs` payload for revert.

### 2.5 `photo_derivatives` — cuid2

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | PK, `cuid2` (app-generated) | Derivative ID |
| `photo_item_id` | `text` | FK → `photo_items.id`, ON DELETE CASCADE | Parent frame |
| `variant` | `enum` | NOT NULL | `'thumbnail'`, `'web'`, `'lightbox'` — file names use the short form (`thumb.webp`, `web.webp`, `lightbox.webp` under `derivatives/{photo_item_id}/`) |
| `s3_key` | `text` | NOT NULL | Derivative MinIO path (`derivatives/{photo_item_id}/...`) |
| `url` | `text` | NOT NULL | Public CDN / MinIO URL |
| `width` | `integer` | NOT NULL | Pixel width |
| `height` | `integer` | NOT NULL | Pixel height |
| `size_bytes` | `bigint` | NOT NULL | File size in bytes |

> Derivatives are per **frame**, not per work.

### 2.6 `likes` (on works)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | `uuid` / `text` | FK → `users.id`, ON DELETE CASCADE | User who liked (matches users type) |
| `post_id` | `text` | FK → `posts.id`, ON DELETE CASCADE | Liked work (`cuid2`) |
| `created_at` | `timestamp` | DEFAULT `now()` | Like time |
| **PK** | `(user_id, post_id)` | Composite PK | Prevents duplicate likes per work |

> A SERIES is liked as one unit. `posts.likes_count` is incremented/decremented atomically with this table.

### 2.7 `comments` (on works, flat with optional threading) — cuid2

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | PK, `cuid2` (app-generated) | Comment ID |
| `post_id` | `text` | FK → `posts.id`, ON DELETE CASCADE | Related work (`cuid2`) |
| `user_id` | `uuid` / `text` | FK → `users.id`, ON DELETE CASCADE | Comment author |
| `parent_id` | `text` | FK → `comments.id`, ON DELETE CASCADE, NULLABLE | Optional threading — gated by `feature_flags.threaded_comments_enabled` |
| `content` | `text` | NOT NULL | Comment body |
| `is_hidden` | `boolean` | DEFAULT `false` | Admin moderation flag |
| `created_at` | `timestamp` | DEFAULT `now()` | Creation time (cursor) |
| `deleted_at` | `timestamp` | NULLABLE | Soft delete (future) |

> For v1, `threaded_comments_enabled=false` → server rejects `parentId` with `400 {code:"FEATURE_DISABLED"}`; clients render flat. `posts.comments_count` counts only `is_hidden=false AND deleted_at IS NULL`.

### 2.8 `admin_audit_logs` — cuid2

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | PK, `cuid2` (app-generated) | Log ID |
| `admin_id` | `uuid` / `text` | FK → `users.id`, ON DELETE SET NULL, NULLABLE | Acting admin (`NULL` for cron, e.g. `exhibition.phase_change` via scheduler) |
| `action` | `varchar(100)` | NOT NULL | e.g. `post.moderate`, `post.withdraw`, `curation.reorder`, `comment.hide`, `feature_flag.toggle`, `photo_item.replace` |
| `target_id` | `text` | NULLABLE | Target work/comment ID (`cuid2`) |
| `payload` | `jsonb` | NULLABLE | Snapshot of change |
| `created_at` | `timestamp` | DEFAULT `now()` | Time |

> Required for v1 launch: replace/revert history, flag-toggle audit, and curator reads all depend on this table (see §4.6 audit-logs endpoint).

### 2.9 `feature_flags` — row-per-flag typed bool (scalable) + `site_settings` singleton for global limits

#### `feature_flags` (kill-switch, one row per flag, no migration for new flags)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `key` | `text` | PK | Flag key — `series_enabled`, `threaded_comments_enabled`, `comments_enabled` |
| `enabled` | `boolean` | NOT NULL | On/off |
| `description` | `text` | NULLABLE | Human-readable purpose |
| `created_at` | `timestamp` | DEFAULT `now()` | Creation |
| `updated_at` | `timestamp` | DEFAULT `now()` | Last toggle |
| `updated_by` | `uuid` / `text` | FK → `users.id`, ON DELETE SET NULL | Admin who toggled last |

> **Why row-per-flag, not 1-row `id=1` columns nor `system_settings` KV `jsonb`:** Each new flag is an `INSERT` (`series_enabled`), not a migration `ADD COLUMN`. Typed `enabled bool` per row enforces type, `updated_by` FK gives audit per flag, cache is `SELECT * FROM feature_flags` → `Map<key,bool>` (10s TTL). KV `jsonb` `{"series_enabled":true}` cannot enforce `bool` or `CHECK`, needs `JSON.parse` and is prone to typo `seris_enabled`.

| Flag (`key`) | Default `enabled` | Effect when `false` |
|---|---|---|
| `series_enabled` | `true` | `POST /api/posts` with `type=SERIES` or `items.length>1` → `403 {code:"FEATURE_DISABLED"}`. Existing SERIES remain readable. Toggle via `PATCH /api/admin/feature-flags/:key` |
| `threaded_comments_enabled` | `false` | `POST /api/posts/:id/comments` with `parentId` → `400 {code:"FEATURE_DISABLED"}`. No threading UI. |
| `comments_enabled` | `true` | `POST /api/posts/:id/comments` → `403 {code:"FEATURE_DISABLED"}` (spam-emergency kill-switch; reads stay open). See [feature-flags-site-settings](../features/feature-flags-site-settings.md) §3. |

> Flags are cached in-memory (10s TTL) and invalidated on `PATCH /api/admin/feature-flags/:key`. **No** `GET /api/system/settings` — use `GET /api/feature-flags` (public, filtered list) + `GET /api/exhibitions/:id` for phase. Legacy `GET /api/system/settings` is **deleted**.

#### `site_settings` — typed singleton 1-row for site-wide global limits (replaces `max_series_size` in flags)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `integer` | PK, DEFAULT `1`, CHECK `id=1` | Singleton — only `id=1` exists |
| `site_title` | `text` | NOT NULL, DEFAULT `'Déclic — Pameran UKM CLIC UNNES'` | Global site title |
| `site_description` | `text` | DEFAULT `'Momen yang diabadikan'` | |
| `max_series_size` | `integer` | NOT NULL, DEFAULT `10`, CHECK `max_series_size BETWEEN 1 AND 20` | Max `photo_items` per `posts` — **global wide setting, not a flag** |
| `maintenance_mode` | `boolean` | NOT NULL, DEFAULT `false` | Banner-only in 1.0: FE reads `GET /api/site-settings` and shows a banner; blocks no writes (enforcement middleware out of scope) |
| `contact_email` | `text` | NULLABLE | |
| `instagram_url` | `text` | NULLABLE | |
| `updated_at` | `timestamp` | DEFAULT `now()` | |
| `updated_by` | `uuid` / `text` | FK → `users.id`, ON DELETE SET NULL | |

> `max_series_size` moved here from `feature_flags` because it is a **limit, not an on/off kill-switch**. `POST /api/posts` validates `1 <= items.length <= (SELECT max_series_size FROM site_settings WHERE id=1)`. **Grandfathering:** existing `SERIES` with 10 frames remain valid when `max_series_size` is later lowered to 5 — only **new** `POST /api/posts` are validated against the new limit. Old works are never retroactively invalidated.

**Seeds — see `docs/seed.ts` (source of truth, idempotent):**

> Seeds are defined in `docs/seed.ts` (`featureFlagsSeed`, `siteSettingsSeed`, `exhibitionsSeed`) — `ON CONFLICT (key) DO NOTHING` / `ON CONFLICT (id) DO NOTHING`. PRD keeps only the **summary table** above; do not duplicate `INSERT` SQL here. Run `bun docs/seed.ts`.

| Table | Seed keys / values |
|---|---|
| `feature_flags` | `series_enabled=true`, `threaded_comments_enabled=false`, `comments_enabled=true` — see `featureFlagsSeed` in `docs/seed.ts` |
| `site_settings` | `id=1, site_title='Déclic — Pameran UKM CLIC UNNES', max_series_size=10` — see `siteSettingsSeed` in `docs/seed.ts` |

> **Caching (so every page open does not hit DB):** Both tables are tiny (`feature_flags` 3 rows, `site_settings` 1 row) — **cached in-memory 10s TTL** per API instance (or Redis) and invalidated on `PATCH /api/admin/feature-flags/:key` / `PATCH /api/admin/site-settings`. Public `GET /api/feature-flags` + `GET /api/site-settings` are **CDN-cacheable** (`Cache-Control: public, max-age=10, stale-while-revalidate=60`) and frontend caches via `TanStack Query` 10s `staleTime`. No DB hit per page view.

---

## 3. Authentication & Authorization (Better Auth Integration)

### 3.1 OAuth & Session Setup

**Library:** `@thallesp/nestjs-better-auth` mounted on NestJS.

**Providers:** Google & GitHub OAuth 2.0.

**Session Strategy:**

- **Web Client (TanStack Start):** HTTP-Only, Secure, `SameSite=Lax` Cookie.
- **Mobile Client (Future Ready):** `Authorization: Bearer <token>` header via Better Auth `bearer()` plugin.

**CORS & Cookie Domain:**

- API is mounted on verified origins via Better Auth `trustedOrigins`.
- Web and API **must** be under the same registrable domain (e.g. `app.declic.example` + `api.declic.example`) so the cookie is treated as first-party (Safari/Firefox already block third-party cookies). Fallback: reverse-proxy rewrite (API proxied through the web domain).

Related env:

```text
BETTER_AUTH_SECRET, BETTER_AUTH_URL
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
```

### 3.2 Role Guard Matrix

| Endpoint Group | Anon | Viewer | Photographer | Curator | Admin |
|---|---|---|---|---|---|
| Public Gallery (`GET /api/exhibitions`, `GET /api/posts`) | Allowed | Allowed | Allowed | Allowed | Allowed |
| Interactions (`POST /api/posts/:id/like`, `POST /api/posts/:id/comments`) | Blocked | Authenticated (blocked when exhibition `ARCHIVED`) | Authenticated (blocked when `ARCHIVED`) | Authenticated (blocked when `ARCHIVED`) | Authenticated (blocked when `ARCHIVED`) |
| Upload (`POST /api/posts/upload-url`, `POST /api/posts`) | Blocked | Blocked | Allowed (only exhibition `PRE_EVENT`/`LIVE` + `series_enabled` flag) | Blocked | Allowed |
| Exhibitions (`POST /api/exhibitions`, `PATCH /api/admin/exhibitions/:id`) | Blocked | Blocked | Blocked | Blocked | Allowed |
| Contributor Dashboard (`GET /api/posts/mine`) | Blocked | Blocked | Own Data Only | Blocked | All Data |
| Moderation (`PATCH /api/admin/posts/:id/moderate`) | Blocked | Blocked | Blocked | Allowed | Allowed |
| Curation Layout (`PATCH /api/admin/curate/reorder`) | Blocked | Blocked | Blocked | Allowed (orders works) | Allowed |
| Curator Replace/Revert (`POST .../replace`, `POST .../revert`) | Blocked | Blocked | Blocked | Allowed | Allowed |
| Comment Moderation (`DELETE /api/admin/comments/:id`) | Blocked | Blocked | Blocked | Allowed | Allowed |
| User Management (`GET /api/admin/users`, `PATCH /api/admin/users/:id/role`) | Blocked | Blocked | Blocked | Blocked | Allowed |
| Feature Flags (`PATCH /api/admin/feature-flags/:key`) | Blocked | Blocked | Blocked | Blocked | Allowed |
| Site Settings (`PATCH /api/admin/site-settings`) | Blocked | Blocked | Blocked | Blocked | Allowed |
| Audit Trail (`GET /api/admin/audit-logs`) | Blocked | Blocked | Blocked | Allowed (read) | Allowed |

Union is manual — `ADMIN` is listed explicitly everywhere (no implicit superset in `RolesGuard`). Role literals live in one map (`common/auth/role-matrix.ts`, see [auth-rbac](../features/auth-rbac.md) §3.1); endpoints reference permission keys.

Implementation: `SessionGuard` → `RolesGuard` → `ExhibitionPhaseGuard` (checks `exhibitions.phase != ARCHIVED` for the target exhibition, or latest if not specified) → `FeatureFlagGuard` (checks `feature_flags.series_enabled` etc.).

**`ExhibitionPhaseGuard` phase rules:** `ARCHIVED` → `403 {code:"ARCHIVED"}` on all writes for that exhibition (see §5 Archive Phase Rule). `DRAFT` → excluded from every public read by default (`ADMIN` bypass via `?phase=DRAFT`); writes require `ADMIN`. `PRE_EVENT` → excluded from public gallery reads, but `POST /api/posts/upload-url` + `POST /api/posts` stay open. When `exhibitionId` is omitted, the guard resolves the same latest exhibition as the handler (`PRE_EVENT`/`LIVE` for writes, `LIVE`-fallback-`ARCHIVED` for reads) — never a different row.

### 3.3 Feature Flag Guard (Kill-Switch)

```typescript
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private systemService: SystemService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const requiredFlag = this.reflector.get<string>('featureFlag', ctx.getHandler());
    if (!requiredFlag) return true;
    const flags = await this.systemService.getFeatureFlags(); // cached
    if (flags[requiredFlag] === false) throw new ForbiddenException({ code: 'FEATURE_DISABLED' });
    return true;
  }
}
// usage: @UseGuards(FeatureFlagGuard) @RequireFeatureFlag('series_enabled')
```

- Guard reads `feature_flags` table (row-per-flag `key` PK, cached `SELECT *` → `Map` 10s TTL).
- When `series_enabled=false`, `POST /api/posts` with `SERIES` fails fast with `403 FEATURE_DISABLED`. `GET /api/posts` and existing SERIES detail remain allowed.
- Flag changes are audited to `admin_audit_logs` (`action: feature_flag.toggle`).

---

## 4. API Specification & Endpoints

Base path: `/api`  
Auth: Better Auth session cookie or `Authorization: Bearer <token>` (mobile).  
Canonical resource: `/api/posts`. Alias `/api/photos` → `/api/posts` (deprecated).  
All cuid2 ids are `text` (e.g. `k8x9p2...`), opaque strings — never sort by `id`.

### 4.0 Cross-Cutting Contracts

#### Cursor schema (base64url JSON, self-contained, stateless)

Every paginated `GET` (`/posts`, `/posts/mine`, `/posts/:id/comments`, `/admin/audit-logs`) uses the same cursor: `base64url(JSON)` encoding of the sort key + tiebreaker `id` (cuid2 is only a tiebreaker, never a sort key). No server-side token store, no Redis read per page — safe under event spikes.

| `sort` | Cursor JSON payload | SQL ordering |
|---|---|---|
| `curated` | `{"display_order": "0\|i00003:", "id": "cuid-post"}` | `ORDER BY display_order, id` |
| `recent` | `{"created_at": "2026-09-01T00:00:00.000Z", "id": "cuid-post"}` | `ORDER BY created_at DESC, id` |
| `most_liked` | `{"likes_count": 42, "id": "cuid-post"}` | `ORDER BY likes_count DESC, id` |
| `comments` / `audit-logs` | `{"created_at": "...", "id": "cuid-x"}` | `ORDER BY created_at, id` |

Rules: `base64url` (not standard base64 — URL-safe, no padding); FE treats the cursor as opaque (may decode for debug, must never construct by hand); invalid/malformed cursor → `400 {code:"VALIDATION_ERROR"}`. Contract schema lives in `packages/contracts` (shared Zod, FE+API single source) when implemented.

#### Error contract (`{code, message, details?}`)

All error responses share one shape (HTTP status carries the class, `code` carries the branch):

```json
{ "code": "ARCHIVED", "message": "This exhibition is archived, likes are frozen", "details": null }
```

`details` is optional — populated only for `VALIDATION_ERROR` (Zod field errors array). `ZodValidationPipe` output is mapped into this shape, never raw Zod JSON.

Canonical codes (FE branches on `code`, never on `message` text):

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/query/cursor/DTO validation failed (`details` = field errors) |
| `UNAUTHENTICATED` | 401 | No/invalid session or bearer token |
| `FORBIDDEN` | 403 | RBAC deny (role insufficient) |
| `FEATURE_DISABLED` | 400/403 | `feature_flags` kill-switch off (`series_enabled`, `threaded_comments_enabled`, `comments_enabled`) — `400` for flag-gated shapes (`parentId` with threading off), `403` for flag-gated actions (SERIES create, comments with flags off) |
| `ARCHIVED` | 403 | Target exhibition `phase='ARCHIVED'` (upload/like/comment/reorder/replace/revert blocked) |
| `NOT_FOUND` | 404 | Unknown `id`/`slug` |
| `WITHDRAW_CLOSED` | 409 | `DELETE /api/posts/:id` on `APPROVED`/`PUBLISHED` (withdraw open for `PENDING`/`REJECTED`/`PROCESSING`/`FAILED_PROCESSING`/`UNPUBLISHED`) |
| `NOTHING_TO_REVERT` | 409 | Revert with no prior `photo_item.replace` audit |
| `FRAME_PROCESSING` | 409 | Replace/revert while frame `blurhash IS NULL` (worker mid-flight) |
| `ORIGINAL_MISSING` | 409 | Audited `old_s3_key` no longer in MinIO |
| `EDIT_CLOSED` | 409 | `PATCH /api/posts/:id` outside `PENDING`/`FAILED_PROCESSING`, or frame-reorder outside `PENDING` |
| `ROLE_CHANGE_DENIED` | 409 | `PATCH /api/admin/users/:id/role` refused (`details.reason`: `self` = own role, `last_admin` = last ADMIN) |

All `{code:"..."}` references elsewhere in this document point to this table.

### 4.1 Ingestion & Work Upload (SINGLE & SERIES)

> **Moved to [series-upload](../features/series-upload.md)** — single source of truth lives there; this section is an index pointer only.
>
> Endpoints: `POST /api/posts/upload-url`, `POST /api/posts`, `PATCH /api/posts/:id` (new), `PATCH /api/posts/:id/items/reorder`, `POST /api/posts/:id/retry` (new).
> Contracts (cursor, errors, guards): §4.0 above.

### 4.2 Gallery & Discovery (Public Read API)

> **Moved to [gallery-discovery](../features/gallery-discovery.md)** — single source of truth lives there; this section is an index pointer only.
>
> Endpoints: `GET /api/posts`, `GET /api/posts/mine`, `GET /api/posts/:id` (+ `/photos` alias).
> Contracts (cursor, errors, guards): §4.0 above.

### 4.3 Engagement (Likes & Comments on works)

> **Moved to [engagement](../features/engagement.md)** — single source of truth lives there; this section is an index pointer only.
>
> Endpoints: `POST/DELETE /api/posts/:id/like`, `POST/GET /api/posts/:id/comments`.
> Contracts (cursor, errors, guards): §4.0 above.

### 4.4 Curation & Moderation (Admin API)

> **Moved to [curation-moderation](../features/curation-moderation.md)** — single source of truth lives there; this section is an index pointer only.
>
> Endpoints: `PATCH /api/admin/curate/reorder`, `PATCH /api/admin/posts/:id/moderate`, `DELETE /api/admin/comments/:id`. Frame-level curation lives in [curator-replace-revert](../features/curator-replace-revert.md); author retraction in [withdraw-work](../features/withdraw-work.md).
> Contracts (cursor, errors, guards): §4.0 above.

### 4.5 Exhibitions (Multi-pameran, root = latest)

> **Moved to [exhibition-lifecycle](../features/exhibition-lifecycle.md)** — single source of truth lives there; this section is an index pointer only.
>
> Endpoints: `GET /api/exhibitions`, `GET /api/exhibitions/:slug`, `GET /api/exhibitions/:id/posts`, `POST /api/exhibitions`, `PATCH /api/admin/exhibitions/:id`, plus `exhibition-scheduler` cron.
> Contracts (cursor, errors, guards): §4.0 above.

### 4.6 Feature Flags & Site Settings

> **Moved to [feature-flags-site-settings](../features/feature-flags-site-settings.md)** — single source of truth lives there; this section is an index pointer only.
>
> Endpoints: `GET /api/feature-flags`, `PATCH /api/admin/feature-flags/:key`, `GET /api/site-settings`, `PATCH /api/admin/site-settings`.
> Contracts (cursor, errors, guards): §4.0 above.

### 4.7 Audit Logs (ADMIN + CURATOR, read-only)

> **Moved to [curation-moderation](../features/curation-moderation.md)** — single source of truth lives there; this section is an index pointer only.
>
> Endpoints: `GET /api/admin/audit-logs` — defined once in [curation-moderation](../features/curation-moderation.md) §5 (Audit trail).
> Contracts (cursor, errors, guards): §4.0 above.

## 5. Non-Functional Requirements

| Aspect | Requirement |
|---|---|
| **Response Time** | `GET /api/posts` < 50ms (composite index `(exhibition_id, status)` + `likes_count`/`comments_count` cache + CDN); `GET /api/exhibitions` < 50ms |
| **Archive Phase Rule** | If **exhibition** `phase === 'ARCHIVED'`: `POST /api/posts/upload-url` + `POST /api/posts` → `403 {code:"ARCHIVED"}`; **`POST /api/posts/:id/like` + `POST /api/posts/:id/comments` → `403 {code:"ARCHIVED"}` (frozen, reads remain; `DELETE /api/posts/:id/like` stays `204`)**. Cron auto `LIVE` → `ARCHIVED` at `end_date`. |
| **Feature Flags** | Row-per-flag `feature_flags(key, enabled)` (cache 10s TTL); `series_enabled=false` blocks **new** SERIES creation (`403 FEATURE_DISABLED`) but not reading existing; `threaded_comments_enabled` gates `parentId`; `comments_enabled=false` blocks new comments (`403 FEATURE_DISABLED`, reads stay open); add flag via `INSERT`, no migration |
| **Optimistic Updates** | `POST /api/posts/:id/like → 200 {likesCount, isLiked}`, `DELETE /api/posts/:id/like → 204` — idempotent, safe for retry & optimistic UI |
| **Pagination** | Cursor-based on `created_at` + `id` (opaque, base64) — not lexicographic `cuid2` sort; stable for `curated` sort that is frequently reordered |
| **ID Generation** | Domain tables use app-generated `cuid2` (`text` PK, e.g. Drizzle `$defaultFn(() => createId())`); `users` stays Better Auth-managed; no `gen_random_uuid()` for domain tables |
| **Security** | RBAC + `FeatureFlagGuard` (row-per-flag) + `ExhibitionPhaseGuard` at API layer; all Admin endpoints require `RolesGuard`; flag & site_settings toggles audit-logged |
| **Portability** | All stateful services self-hosted via Docker (Postgres, Redis, MinIO); no vendor lock-in |
| **CORS** | Better Auth `trustedOrigins` + NestJS CORS must be in sync; cookie `SameSite=Lax`, `Secure`, `HTTP-Only` |
| **Series Limits** | `photo_items` per post capped by `site_settings.max_series_size` (default 10, globally, grandfathered); `POST /api/posts` validates `1 <= items.length <= max` |

---

## 6. Cross References

- **General PRD:** [PRD](./PRD.md) — vision, users & roles, lifecycle, system architecture (now with SERIES + feature flags).
- **Worker Pipeline:** [PRD-Worker](./PRD-Worker.md) — BullMQ consumer per `photo_item` (`cuid2`), `Bun.Image` derivatives, retry/DLQ, post-level aggregation.
- **DB Schema:** [db-schema](../data/db-schema.md) — canonical Mermaid ER diagram (`posts` + `photo_items`, cuid2 for domain tables).
- **Local Infra:** `docker-compose.yml` + `env.example` — Postgres, Redis, MinIO, API, Worker, Web.
