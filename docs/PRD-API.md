# PRD Backend API: Déclic — Core REST API Server & Authentication System

**Version:** 0.4-draft (2026-09-01)  
**App Version:** 0.x pre-release — `1.0.0` at first exhibition launch (PRD draft version is independent of app semver)
**Main Stack:** NestJS, Bun 1.4, PostgreSQL, Drizzle ORM / TypeORM, Better Auth, MinIO SDK, BullMQ  
**Target:** Core REST API Server & Authentication System  
**Status:** Draft
**Last updated:** 2026-09-01

> This document is the technical specification for the **Backend API** of the Déclic platform. For the asynchronous image processing pipeline, see `PRD-Worker.md`. For the canonical DB diagram, see `db-schema.md`. This version (0.4-draft) introduces **SERIES** (`posts` + `photo_items`), **runtime feature flags** (kill-switch), **cuid2** for domain tables, **multi-exhibition** (`exhibitions` + `posts.exhibition_id`, root = latest) and **ARCHIVED freeze** (likes/comments read-only) plus **BullMQ cron** `exhibition-scheduler`.

---

## 1. Scope & System Architecture

The API server is fully responsible for authentication, transactional data management, role-based authorization (RBAC), Presigned URL generation for media uploads, and triggering the image processing queue.

An **exhibition** (`exhibitions`) groups works and has its own lifecycle (`PRE_EVENT` → `LIVE` → `ARCHIVED`, auto via cron). A **work (post)** belongs to one `exhibitions.id` and can be `SINGLE` or `SERIES`. Likes/comments/curation operate on the **post**, not on individual frames. Root `/` always serves the **latest published exhibition**. Feature flags provide a **runtime kill-switch** without deploy (see §2.9, §3.3, §5).

### 1.1 NestJS Module Architecture

```
src/
├── modules/
│   ├── auth/          # Better Auth mount, OAuth handler, SessionGuard, RolesGuard
│   ├── users/         # User profile and role management (Better Auth ids, not cuid2)
│   ├── exhibitions/   # Exhibitions CRUD, slug, phase, scheduler (exhibition-scheduler cron)
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

> Canonical Mermaid: `db-schema.md` §1. This section is the textual spec.

**ID generation rule:**

- `users.id` — Better Auth-managed (`uuid`/`text`), unchanged.
- All **domain tables** (`posts`, `photo_items`, `photo_derivatives`, `comments`, `admin_audit_logs`, and FKs `post_id`/`photo_item_id`/`target_id`/`parent_id`) — **`text` PK with `cuid2` generated in application** (`@paralleldrive/cuid2` `createId()`). No `DEFAULT gen_random_uuid()` in DB. Ordering/pagination must use `created_at` + `display_order`, never lexicographic `id` sort (`cuid2` is not ULID-sortable — cursor uses `created_at`).

### 2.1 `users` (Managed jointly with Better Auth — NOT cuid2)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` / `text` | PK | Unique user ID (per Better Auth adapter, unchanged) |
| `name` | `varchar(255)` | NOT NULL | Full name |
| `email` | `varchar(255)` | NOT NULL, UNIQUE | OAuth email |
| `image` | `text` | NULLABLE | Avatar URL |
| `role` | `enum` | NOT NULL, DEFAULT `'VISITOR'` | `'VISITOR'`, `'PHOTOGRAPHER'`, `'ADMIN'` |
| `created_at` | `timestamp` | DEFAULT `now()` | Registration time |
| `updated_at` | `timestamp` | NULLABLE | Last profile update (Better Auth adapter) |

> `role` defaults to `VISITOR` — elevation to `PHOTOGRAPHER`/`ADMIN` is done manually by Admin or via seed. `users` ids are **not** switched to cuid2 — keep Better Auth compatibility.

### 2.2 `exhibitions` — cuid2

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | PK, `cuid2` (app-generated) | Exhibition ID |
| `title` | `varchar(255)` | NOT NULL | Exhibition title (e.g. “Déclic 2026”) |
| `slug` | `varchar(255)` | NOT NULL, UNIQUE | URL slug (`declic-2026`), used in `/exhibition/[slug]` |
| `description` | `text` | NULLABLE | Curatorial statement |
| `phase` | `enum` | NOT NULL, DEFAULT `'PRE_EVENT'` | `'PRE_EVENT'`, `'LIVE'`, `'ARCHIVED'`, `'DRAFT'` — per-exhibition lifecycle |
| `poster_s3_key` | `text` | NULLABLE | Poster image path in MinIO |
| `location` | `varchar(255)` | NULLABLE | Venue (e.g. “Gedung CLIC UNNES”) |
| `start_date` | `timestamp` | NOT NULL | Exhibition start — used to order `latest` |
| `end_date` | `timestamp` | NOT NULL | Exhibition end — **cron trigger** `LIVE` → `ARCHIVED` when `end_date <= now()` |
| `created_by` | `uuid` / `text` | FK → `users.id`, ON DELETE SET NULL | Creator admin |
| `created_at` | `timestamp` | DEFAULT `now()` | Creation time |
| `updated_at` | `timestamp` | DEFAULT `now()` | Last update |

Indexes: `slug` UNIQUE, `phase`, `start_date DESC` (for `latest`), `end_date`. Root `/` resolves to `SELECT * FROM exhibitions WHERE phase IN ('LIVE','PUBLISHED') ORDER BY start_date DESC LIMIT 1` or `ARCHIVED` latest if none LIVE; `/archive` lists `ARCHIVED` ordered by `start_date DESC`.

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
| `status` | `enum` | NOT NULL, DEFAULT `'PROCESSING'` | `'PROCESSING'`, `'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'PUBLISHED'`, `'UNPUBLISHED'` |
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

> A SINGLE work has exactly 1 row here (`item_order=0`). A SERIES has 2–N (limit `feature_flags.max_series_size`, default 10). **Option C:** admin replacement does **not** create a new `photo_items` row — it updates `original_s3_key`/`source`/`blurhash`/`exif_metadata` in place and re-enqueues a worker job to regenerate derivatives; the old `s3_key` is preserved in `admin_audit_logs` payload for revert.

### 2.5 `photo_derivatives` — cuid2

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | PK, `cuid2` (app-generated) | Derivative ID |
| `photo_item_id` | `text` | FK → `photo_items.id`, ON DELETE CASCADE | Parent frame |
| `variant` | `enum` | NOT NULL | `'thumbnail'`, `'web'`, `'lightbox'` |
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

> For v1, `threaded_comments_enabled=false` → server rejects `parentId` or stores `NULL`; clients render flat. `posts.comments_count` counts only `is_hidden=false AND deleted_at IS NULL`.

### 2.8 `admin_audit_logs` (schema-ready, optional for v1) — cuid2

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `text` | PK, `cuid2` (app-generated) | Log ID |
| `admin_id` | `uuid` / `text` | FK → `users.id`, ON DELETE SET NULL | Acting admin |
| `action` | `varchar(100)` | NOT NULL | e.g. `post.approve`, `post.reject`, `curation.reorder`, `comment.hide`, `feature_flag.toggle` |
| `target_id` | `text` | NULLABLE | Target work/comment ID (`cuid2`) |
| `payload` | `jsonb` | NULLABLE | Snapshot of change |
| `created_at` | `timestamp` | DEFAULT `now()` | Time |

> Not required for v1 launch; table exists so moderation can log without migration.

### 2.9 `feature_flags` — row-per-flag typed bool (scalable) + `site_settings` singleton for global limits

#### `feature_flags` (kill-switch, one row per flag, no migration for new flags)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `key` | `text` | PK | Flag key — `series_enabled`, `threaded_comments_enabled` |
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

> Flags are cached in-memory (10s TTL) and invalidated on `PATCH /api/admin/feature-flags/:key`. **No** `GET /api/system/settings` — use `GET /api/feature-flags` (public, filtered list) + `GET /api/exhibitions/:id` for phase. Legacy `GET /api/system/settings` is **deleted**.

#### `site_settings` — typed singleton 1-row for site-wide global limits (replaces `max_series_size` in flags)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `integer` | PK, DEFAULT `1`, CHECK `id=1` | Singleton — only `id=1` exists |
| `site_title` | `text` | NOT NULL, DEFAULT `'Déclic — Pameran UKM CLIC UNNES'` | Global site title |
| `site_description` | `text` | DEFAULT `'Momen yang diabadikan'` | |
| `max_series_size` | `integer` | NOT NULL, DEFAULT `10`, CHECK `max_series_size BETWEEN 1 AND 20` | Max `photo_items` per `posts` — **global wide setting, not a flag** |
| `maintenance_mode` | `boolean` | NOT NULL, DEFAULT `false` | Site-wide maintenance banner |
| `contact_email` | `text` | NULLABLE | |
| `instagram_url` | `text` | NULLABLE | |
| `updated_at` | `timestamp` | DEFAULT `now()` | |
| `updated_by` | `uuid` / `text` | FK → `users.id`, ON DELETE SET NULL | |

> `max_series_size` moved here from `feature_flags` because it is a **limit, not an on/off kill-switch**. `POST /api/posts` validates `1 <= items.length <= (SELECT max_series_size FROM site_settings WHERE id=1)`. **Grandfathering:** existing `SERIES` with 10 frames remain valid when `max_series_size` is later lowered to 5 — only **new** `POST /api/posts` are validated against the new limit. Old works are never retroactively invalidated.

**Seeds — see `docs/seed.ts` (source of truth, idempotent):**

> Seeds are defined in `docs/seed.ts` (`featureFlagsSeed`, `siteSettingsSeed`, `exhibitionsSeed`) — `ON CONFLICT (key) DO NOTHING` / `ON CONFLICT (id) DO NOTHING`. PRD keeps only the **summary table** above; do not duplicate `INSERT` SQL here. Run `bun docs/seed.ts` or `bun run seed` (apps/api).

| Table | Seed keys / values |
|---|---|
| `feature_flags` | `series_enabled=true`, `threaded_comments_enabled=false` — see `featureFlagsSeed` in `docs/seed.ts` |
| `site_settings` | `id=1, site_title='Déclic — Pameran UKM CLIC UNNES', max_series_size=10` — see `siteSettingsSeed` in `docs/seed.ts` |

> **Caching (so every page open does not hit DB):** Both tables are tiny (`feature_flags` 2 rows, `site_settings` 1 row) — **cached in-memory 10s TTL** per API instance (or Redis) and invalidated on `PATCH /api/admin/feature-flags/:key` / `PATCH /api/admin/site-settings`. Public `GET /api/feature-flags` + `GET /api/site-settings` are **CDN-cacheable** (`Cache-Control: public, max-age=10, stale-while-revalidate=60`) and frontend caches via `TanStack Query` 10s `staleTime`. No DB hit per page view.

---

## 3. Authentication & Authorization (Better Auth Integration)

### 3.1 OAuth & Session Setup

**Library:** `@thallesp/nestjs-better-auth` mounted on NestJS.

**Providers:** Google & GitHub OAuth 2.0.

**Session Strategy:**

- **Web Client (Next.js):** HTTP-Only, Secure, `SameSite=Lax` Cookie.
- **Mobile Client (Future Ready):** `Authorization: Bearer <token>` header via Better Auth `bearer()` plugin.

**CORS & Cookie Domain:**

- API is mounted on verified origins via Better Auth `trustedOrigins`.
- Web and API **must** be under the same registrable domain (e.g. `app.declic.com` + `api.declic.com`) so the cookie is treated as first-party (Safari/Firefox already block third-party cookies). Fallback: reverse-proxy rewrite (API proxied through the web domain).

Related env:

```
BETTER_AUTH_SECRET, BETTER_AUTH_URL
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
```

### 3.2 Role Guard Matrix

| Endpoint Group | Visitor | Photographer | Admin |
|---|---|---|---|
| Public Gallery (`GET /exhibitions`, `GET /posts`) | Allowed | Allowed | Allowed |
| Interactions (`POST /posts/:id/likes`, `POST /posts/:id/comments`) | Authenticated | Authenticated (blocked when exhibition `ARCHIVED`) | Authenticated (blocked when `ARCHIVED`) |
| Upload (`POST /posts/presigned-url`, `POST /posts`) | Blocked | Allowed (only exhibition `PRE_EVENT`/`LIVE` + `series_enabled` flag) | Allowed |
| Exhibitions (`POST /api/exhibitions`, `PATCH /api/admin/exhibitions/:id`) | Blocked | Blocked | Allowed |
| Contributor Dashboard (`GET /posts/mine`) | Blocked | Own Data Only | All Data |
| Moderation (`PATCH /admin/posts/:id/moderate`) | Blocked | Blocked | Allowed |
| Curation Layout (`PATCH /admin/curate/reorder`) | Blocked | Blocked | Allowed (orders works) |
| Comment Moderation (`DELETE /admin/comments/:id`) | Blocked | Blocked | Allowed |
| Feature Flags (`PATCH /api/admin/feature-flags`) | Blocked | Blocked | Allowed |

Implementation: `SessionGuard` → `RolesGuard` → `ExhibitionPhaseGuard` (checks `exhibitions.phase != ARCHIVED` for the target exhibition, or latest if not specified) → `FeatureFlagGuard` (checks `feature_flags.series_enabled` etc.).

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

- Guard reads `feature_flags` table (single row `id=1`, cached 10s TTL).
- When `series_enabled=false`, `POST /api/posts` with `SERIES` fails fast with `403 FEATURE_DISABLED`. `GET /api/posts` and existing SERIES detail remain allowed.
- Flag changes are audited to `admin_audit_logs` (`action: feature_flag.toggle`).

---

## 4. API Specification & Endpoints

Base path: `/api`  
Auth: Better Auth session cookie or `Authorization: Bearer <token>` (mobile).  
Canonical resource: `/api/posts`. Alias `/api/photos` → `/api/posts` (deprecated).  
All cuid2 ids are `text` (e.g. `k8x9p2...`), opaque strings — never sort by `id`.

### 4.1 Ingestion & Work Upload (SINGLE & SERIES)

#### `POST /api/posts/upload-url`

**Access:** Authenticated (`PHOTOGRAPHER`, `ADMIN`). Validates **target exhibition** `phase != ARCHIVED` (via `exhibition_id` body or latest exhibition). No flag check (presign is cheap; flag is enforced at `POST /api/posts`).

**Request Body (batch for SERIES):**

```json
{
  "files": [
    { "filename": "diptych_01.jpg", "contentType": "image/jpeg", "fileSizeBytes": 15420000 },
    { "filename": "diptych_02.jpg", "contentType": "image/jpeg", "fileSizeBytes": 12100000 }
  ]
}
```

> For SINGLE, send `files` with one element. Backwards compat: single-object body `{filename, contentType, fileSizeBytes}` is also accepted.

**API Validation:** Each `contentType` within allowlist (`image/jpeg`, `image/png`, `image/webp`, `image/avif`), each `fileSizeBytes <= 50MB`, batch size `1..N` where `N <= feature_flags.max_series_size`.

**Response `200 OK`:**

```json
{
  "uploads": [
    { "uploadUrl": "https://minio.domain.com/raw-uploads/cuid-1.jpg?X-Amz-Signature=...", "s3Key": "raw-uploads/cuid-1.jpg", "expiresIn": 900 },
    { "uploadUrl": "https://minio.domain.com/raw-uploads/cuid-2.jpg?X-Amz-Signature=...", "s3Key": "raw-uploads/cuid-2.jpg", "expiresIn": 900 }
  ]
}
```

**Storage note:** `storage` module generates Presigned PUT URLs via MinIO SDK (`S3_ENDPOINT`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`). `s3Key` incorporates `cuid2` for uniqueness.

#### `POST /api/posts`

**Access:** Authenticated (`PHOTOGRAPHER`, `ADMIN`). Checks `FeatureFlagGuard('series_enabled')` if `type===SERIES`.

**Request Body (SINGLE, defaults to latest exhibition):**

```json
{
  "exhibitionId": "cuid-exhibition",
  "type": "SINGLE",
  "title": "Sunset in Kota Lama",
  "caption": "Taken in the late afternoon before the exhibition.",
  "items": [
    {
      "s3Key": "raw-uploads/cuid-1.jpg",
      "exifMetadata": {
        "make": "Sony",
        "model": "ILCE-7M4",
        "fNumber": 2.8,
        "exposureTime": "1/500",
        "iso": 100,
        "focalLength": "35mm"
      }
    }
  ]
}
```

**Request Body (SERIES):**

```json
{
  "exhibitionId": "cuid-exhibition",
  "type": "SERIES",
  "title": "Morning Market — Triptych",
  "caption": "Three moments from the same morning.",
  "items": [
    { "s3Key": "raw-uploads/cuid-1.jpg", "exifMetadata": { "make": "Sony", "fNumber": 4 } },
    { "s3Key": "raw-uploads/cuid-2.jpg", "exifMetadata": { "fNumber": 5.6 } },
    { "s3Key": "raw-uploads/cuid-3.jpg", "exifMetadata": {} }
  ]
}
```

> `exhibitionId` optional — defaults to latest exhibition (`phase IN ('PRE_EVENT','LIVE')` ordered by `start_date DESC`). If latest is `ARCHIVED`, must specify explicit active exhibition or error. `item_order` is implicit by array index (0-based). IDs for new `posts` and `photo_items` are generated in app via `createId()` (cuid2) — not `gen_random_uuid()`.

**API Actions (transactional, scoped to exhibition):**

1. Resolve `exhibition_id` (provided or latest). If `exhibitions.phase === 'ARCHIVED'` → `403` (see Errors). If `type===SERIES` and `feature_flags.series_enabled===false` → `403 FEATURE_DISABLED`.
2. Validate `1 <= items.length <= feature_flags.max_series_size`.
3. Verify each `s3Key` exists in MinIO (HEAD) — optional but recommended.
4. Insert `posts` (`id=cuid2`, `exhibition_id`, `status='PROCESSING'`, `type`, `title`, `caption`, `photographer_id`).
5. Insert `photo_items` rows (`id=cuid2` per row, `post_id`, `item_order`, `original_s3_key`, `exif_metadata`).
6. Push **one BullMQ job per photo_item** to `image-processing`:

```json
[
  { "postId": "cuid-post", "photoItemId": "cuid-item-1", "s3Key": "raw-uploads/cuid-1.jpg" },
  { "postId": "cuid-post", "photoItemId": "cuid-item-2", "s3Key": "raw-uploads/cuid-2.jpg" }
]
```

> Post status transitions to `PENDING` only after **all** its photo_items finish processing (see `PRD-Worker.md` §3.3).

**Response `201 Created`:** newly created `post` (cuid2 ids) with nested `items`.

**Errors:**

- `403 Forbidden` if target `exhibitions.phase === 'ARCHIVED'` (or legacy `event_phase == ARCHIVED`) → `"Exhibition has been archived, new uploads are closed"`.
- `403 FEATURE_DISABLED` if `type===SERIES` and `series_enabled===false` → `"SERIES creation is temporarily disabled"`.

### 4.2 Gallery & Discovery (Public Read API)

#### `GET /api/posts`

**Access:** Public (no auth). If a session exists, additional field `isLiked` is included. **Scoped to an exhibition** — defaults to latest published exhibition (see exhibitions). Respects `feature_flags` only for filtering — when `series_enabled=false`, existing SERIES still returned (creation is blocked, not reading).

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `exhibition_id` | `cuid2` | latest exhibition | Filter by exhibition (`cuid2`); omit to get latest (`start_date DESC`) |
| `exhibition_slug` | `string` | — | Alternative to `exhibition_id` (e.g. `declic-2026`) |
| `sort` | `enum` | `curated` | `curated` (by `posts.display_order`), `most_liked` (by `likes_count`), `recent` (by `posts.created_at` — **not** `id`) |
| `search` | `string` | — | Substring match on `posts.title` or `users.name` |
| `cursor` | `string` | — | Opaque cursor (base64 of `created_at` + `id`) — **never raw cuid2 sort** |
| `limit` | `integer` | `20` | `1..50` |
| `type` | `enum` | — | Filter `SINGLE` or `SERIES` (optional) |

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "cuid-post",
      "type": "SERIES",
      "title": "Morning Market — Triptych",
      "caption": "...",
      "status": "PUBLISHED",
      "photographer": {
        "id": "uuid-user",
        "name": "Budi Santoso",
        "image": "https://lh3.googleusercontent.com/..."
      },
      "items": [
        {
          "id": "cuid-item-1",
          "itemOrder": 0,
          "blurhash": "L6PZf_e-00_w~qj[f6j[00fQ_3fQ",
          "exifMetadata": {},
          "derivatives": {
            "thumbnail": "https://cdn.domain.com/derivatives/cuid-1/thumb.webp",
            "web": "https://cdn.domain.com/derivatives/cuid-1/web.webp",
            "lightbox": "https://cdn.domain.com/derivatives/cuid-1/lightbox.webp"
          }
        }
      ],
      "likesCount": 42,
      "commentsCount": 7,
      "isLiked": false
    }
  ],
  "nextCursor": "eyJjcmVhdGVkX2F0Ijoi..."
}
```

**Performance:** `< 50ms` (composite index `(exhibition_id, status)` + `likes_count`/`comments_count` cache + CDN cache headers). Only `status = PUBLISHED AND deleted_at IS NULL` **within the requested exhibition** appears in the public gallery (except for Admin). Cover for SERIES is `items[0]`. Root `/` omits `exhibition_id` → backend resolves to latest exhibition (`phase IN ('LIVE','ARCHIVED') ORDER BY start_date DESC LIMIT 1`).

#### `GET /api/posts/mine`

**Access:** `PHOTOGRAPHER` (own data), `ADMIN` (all data). Returns all statuses owned by the user, with nested `items` (cuid2 ids).

#### `GET /api/posts/:id` (cuid2)

Single work detail — public if `PUBLISHED`, owner/admin can access any status. Includes all `photo_items` ordered by `item_order` with their derivatives.

**Alias:** `GET /api/photos/:id` → `GET /api/posts/:id`.

### 4.3 Engagement (Likes & Comments on works)

#### `POST /api/posts/:id/like` & `DELETE /api/posts/:id/like` (cuid2 post id)

- **Idempotent** — repeated `POST` does not duplicate (composite PK on `likes(user_id, post_id)`), `DELETE` on a not-yet-liked work still returns `204`.
- Atomically maintains `posts.likes_count` within same transaction.
- Supports Optimistic UI — frontend may update count before response.
- **Frozen when parent exhibition is `ARCHIVED`:** `POST/DELETE /like` → `403 {code:"ARCHIVED", message:"This exhibition is archived, likes are frozen"}` (read of `likesCount` remains). Previous “still allowed” is deprecated v1.3.

**Alias:** `/api/photos/:id/like`.

#### `POST /api/posts/:id/comments`

**Body:** `{ "content": "Amazing composition!", "parentId": "cuid-parent-optional" }`

- **Frozen when parent exhibition is `ARCHIVED`:** `POST /comments` → `403 ARCHIVED` (reads remain).
- If `feature_flags.threaded_comments_enabled===false` and `parentId` is sent → `400 {code:"FEATURE_DISABLED"}` or server silently stores `parent_id=NULL` (recommend `400`).
- Otherwise, stores `parent_id` (cuid2) nullable. Increments `posts.comments_count` atomically if `is_hidden=false` and exhibition not archived.

#### `GET /api/posts/:id/comments`

List comments with `is_hidden = false AND deleted_at IS NULL` for public; Admin sees all (including hidden). For v1, returned flat sorted by `created_at` (not `id`); `parent_id` is included but clients render flat unless threading flag is on.

### 4.4 Curation & Moderation (Admin API)

#### `PATCH /api/admin/curate/reorder`

**Access:** `ADMIN`. Orders **works**, not frames. Uses cuid2 `postId`.

**Request Body (Fractional Indexing / LexoRank):**

```json
{
  "postId": "cuid-post-A",
  "prevDisplayOrder": "0|hzzzzz:",
  "nextDisplayOrder": "0|i00003:"
}
```

**API Action:** Calculate a new LexoRank string between `prevDisplayOrder` and `nextDisplayOrder`, then `UPDATE posts SET display_order = :newRank WHERE id = :postId` atomically (O(1), no full table rebalance). Legacy field `photoId` is accepted as alias for `postId`.

#### `PATCH /api/admin/posts/:id/moderate` (cuid2)

**Access:** `ADMIN`.

**Request Body:**

```json
{
  "action": "APPROVE",
  "rejectionReason": "Resolution does not meet requirements."
}
```

`action`: `"APPROVE" | "REJECT"`

**API Actions:**

- `APPROVE` → `posts.status = APPROVED`, set initial `display_order` at the very bottom (LexoRank max + 1) for the whole work.
- `REJECT` → `posts.status = REJECTED`, `rejection_reason` is required — whole work is rejected (no per-frame moderation in v1).
- Other transitions: `PUBLISHED` / `UNPUBLISHED` handled via separate endpoint or same field (per final workflow).
- **Audit:** Insert into `admin_audit_logs` (`id=cuid2`, `target_id=cuid-post`).

**Alias:** `PATCH /api/admin/photos/:id/moderate`.

#### `DELETE /api/admin/comments/:id` (cuid2)

Soft moderation — `UPDATE comments SET is_hidden = true`. `posts.comments_count` is decremented if the comment was previously counted. `id` is cuid2.

#### `PATCH /api/posts/:id/items/reorder` (optional, for pending works, cuid2 ids)

Allows photographer to reorder frames inside a SERIES before moderation: `{ "orderedItemIds": ["cuid-2","cuid-1","cuid-3"] }` → updates `photo_items.item_order`.

#### `POST /api/admin/posts/:postId/frames/:itemId/replace` (ADMIN, cuid2) — **Option C**

**Access:** `ADMIN` only. **Blocked when parent exhibition is `ARCHIVED`** (`403 ARCHIVED`). Non-destructive curator replacement for color consistency etc.

**Request Body:**

```json
{
  "s3Key": "raw-uploads/cuid-curated-replacement.jpg",
  "exifMetadata": { "make": "Sony", "fNumber": 8 }
}
```

> `s3Key` must have been uploaded via `POST /api/posts/upload-url` (admin presigned URL, same allowlist, same `raw-uploads/` bucket). Original file at old `photo_items.original_s3_key` is **not deleted**.

**API Actions (transactional):**

1. Verify `s3Key` exists in MinIO (HEAD).
2. Fetch old `photo_items` row; capture `old_s3_key`, `old_source`, `old_exif_metadata`.
3. `UPDATE photo_items SET original_s3_key=:s3Key, source='CURATED', exif_metadata=COALESCE(:exifMetadata, exif_metadata), blurhash=NULL, updated_at=now() WHERE id=:itemId`.
4. Delete old `photo_derivatives` for that `photo_item_id` (or keep until worker overwrites — recommend delete to avoid stale CDN).
5. Enqueue **one** `image-processing` job `{ postId, photoItemId: itemId, s3Key, curated: true }` to regenerate `blurhash` + 3 derivatives (same pipeline as `PRD-Worker.md`).
6. Insert `admin_audit_logs` `{ id:cuid2, admin_id, action:'photo_item.replace', target_id:itemId, payload:{ postId, old_s3_key, new_s3_key: s3Key, old_source, new_source:'CURATED' } }` for revert.

**Revert:** `POST /api/admin/photo-items/:itemId/revert` (optional) restores `payload.old_s3_key` from latest `photo_item.replace` audit and re-enqueues worker. Not required for `1.0` launch but schema-ready.

**Response `202 Accepted`:** `{ photoItemId, status:"PROCESSING" }` — derivatives are regenerated async; gallery shows old derivatives until worker completes (then new cover if `item_order=0`).

### 4.5 Exhibitions (Multi-pameran, root = latest)

#### `GET /api/exhibitions` (public)

List exhibitions ordered by `start_date DESC`. Query `?phase=LIVE|ARCHIVED` optional. Root `/` uses first `LIVE` (fallback latest `ARCHIVED`) as `exhibition_id` default.

#### `GET /api/exhibitions/:slug` (public, cuid2 or slug)

Detail exhibition with `postsCount` (published only for public; all for ADMIN). Includes `poster` url.

#### `GET /api/exhibitions/:id/posts` (public)

Alias for `GET /api/posts?exhibition_id=:id` — gallery scoped to that exhibition.

#### `POST /api/exhibitions` (ADMIN)

Create exhibition: `{ title, slug, description, location, poster_s3_key, start_date, end_date, phase }` → `id=cuid2`. Slug unique.

#### `PATCH /api/admin/exhibitions/:id` (ADMIN, cuid2)

Update `title`/`slug`/`description`/`location`/`poster_s3_key`/`start_date`/`end_date`/`phase`. Phase change audited (`admin_audit_logs.action=exhibition.phase_change`). Manual `ARCHIVED` triggers same freeze logic as cron.

**Scheduler (BullMQ cron):** Queue `exhibition-scheduler` runs **hourly** (configurable `0 * * * *`):

```typescript
// apps/api/src/modules/exhibitions/exhibition.scheduler.ts
@Cron('0 * * * *')
async handle() {
  const toArchive = await db.select().from(exhibitions)
    .where(and(eq(exhibitions.phase,'LIVE'), lte(exhibitions.end_date, new Date())));
  for (const ex of toArchive) {
    await db.update(exhibitions).set({ phase:'ARCHIVED', updated_at: new Date() }).where(eq(exhibitions.id, ex.id));
    await db.insert(admin_audit_logs).values({ id:createId(), admin_id:null, action:'exhibition.phase_change', target_id: ex.id, payload:{from:'LIVE', to:'ARCHIVED', via:'cron'}});
    // no mirror — phase lives only in exhibitions table
  }
}
```

### 4.6 Feature Flags & Site Settings

#### `GET /api/feature-flags` (public, filtered)

Returns array `[{key, enabled, updated_at}]` (e.g. `series_enabled`, `threaded_comments_enabled`; no secrets). Frontend uses `series_enabled` to hide SERIES toggle. Audit of curated replacements via `GET /api/admin/audit-logs?target_id=:itemId` (admin only). Legacy `GET /api/system/settings` is **deleted**.

#### `PATCH /api/admin/feature-flags/:key` (ADMIN only, row-per-flag)

Manages one flag at a time. Example:

```http
PATCH /api/admin/feature-flags/series_enabled
{ "enabled": false }

PATCH /api/admin/feature-flags/threaded_comments_enabled
{ "enabled": true }
```

- Validates `key` exists; new flag requires `INSERT` (scalable, no migration).
- Invalidates cache (10s TTL) immediately; `updated_at` + `updated_by` auto-set.
- Audits to `admin_audit_logs` (`action: feature_flag.toggle`, `payload: {key, before, after}`).

#### `GET /api/site-settings` (public, filtered)

Returns `{ site_title, site_description, max_series_size, maintenance_mode, contact_email, instagram_url }` (public fields only). `max_series_size` is read here (not from `feature_flags`).

#### `PATCH /api/admin/site-settings` (ADMIN only, singleton `id=1`)

Manages global limits/content. Example:

```json
{
  "max_series_size": 8,
  "site_title": "Déclic — Pameran UKM CLIC UNNES 2026",
  "maintenance_mode": false
}
```

- `CHECK max_series_size BETWEEN 1 AND 20`. **Grandfathering:** existing `SERIES` with 10 frames remain valid when limit is later lowered to 5 — only new `POST /api/posts` are validated against the new value.
- Invalidates cache immediately; audits to `admin_audit_logs` (`action: site_settings.update`).
- `system_settings` does not exist — do not use `PATCH /api/admin/system/settings`.

---

## 5. Non-Functional Requirements

| Aspect | Requirement |
|---|---|
| **Response Time** | `GET /api/posts` < 50ms (composite index `(exhibition_id, status)` + `likes_count`/`comments_count` cache + CDN); `GET /api/exhibitions` < 50ms |
| **Archive Phase Rule** | If **exhibition** `phase === 'ARCHIVED'`: `POST /api/posts/upload-url` + `POST /api/posts` → `403`; **`POST /likes` + `POST /comments` → `403 ARCHIVED` (frozen, reads remain)**. Cron auto `LIVE` → `ARCHIVED` at `end_date`. |
| **Feature Flags** | Row-per-flag `feature_flags(key, enabled)` (cache 10s TTL); `series_enabled=false` blocks **new** SERIES creation (`403 FEATURE_DISABLED`) but not reading existing; `threaded_comments_enabled` gates `parentId`; add flag via `INSERT`, no migration |
| **Site Settings** | Singleton `site_settings(id=1, max_series_size CHECK 1..20, site_title, maintenance_mode)` — `GET /api/site-settings` public, `PATCH /api/admin/site-settings` admin; **grandfathering** old SERIES when limit lowered |
| **Optimistic Updates** | `POST/DELETE /posts/:id/like` idempotent — safe for retry & optimistic UI |
| **Pagination** | Cursor-based on `created_at` + `id` (opaque, base64) — not lexicographic `cuid2` sort; stable for `curated` sort that is frequently reordered |
| **ID Generation** | Domain tables use app-generated `cuid2` (`text` PK, e.g. Drizzle `$defaultFn(() => createId())`); `users` stays Better Auth-managed; no `gen_random_uuid()` for domain tables |
| **Security** | RBAC + `FeatureFlagGuard` (row-per-flag) + `ExhibitionPhaseGuard` at API layer; all Admin endpoints require `RolesGuard`; flag & site_settings toggles audit-logged |
| **Portability** | All stateful services self-hosted via Docker (Postgres, Redis, MinIO); no vendor lock-in |
| **CORS** | Better Auth `trustedOrigins` + NestJS CORS must be in sync; cookie `SameSite=Lax`, `Secure`, `HTTP-Only` |
| **Series Limits** | `photo_items` per post capped by `site_settings.max_series_size` (default 10, globally, grandfathered); `POST /api/posts` validates `1 <= items.length <= max` |

---

## 6. Cross References

- **General PRD:** `PRD.md` — vision, users & roles, lifecycle, system architecture (now with SERIES + feature flags).
- **Worker Pipeline:** `PRD-Worker.md` — BullMQ consumer per `photo_item` (`cuid2`), `Bun.Image` derivatives, retry/DLQ, post-level aggregation.
- **DB Schema:** `db-schema.md` — canonical Mermaid ER diagram (`posts` + `photo_items`, cuid2 for domain tables).
- **Local Infra:** `docker-compose.yml` + `env.example` — Postgres, Redis, MinIO, API, Worker, Web.
