---
aliases:
  - Series Upload
  - Submission Lifecycle
tags:
  - declic
  - feature
  - posts
status: draft
updated: 2026-09-07
---

# Feature: Submission Lifecycle — Upload, Edit, Frame Reorder (SINGLE & SERIES)

**Status:** Specced ([PRD](../PRD.md) 0.4-draft) — not implemented
**Owner modules:** `posts` (+ `photo-items`), `storage`, `queue` (API); upload/edit pages (web)
**Related:** [PRD-API](../PRD-API.md) §4.0 (contracts), [PRD-FE](../PRD-FE.md) §3.2 (`/dashboard/upload`),
[PRD-Worker](../PRD-Worker.md) §1–§3, [db-schema](../db-schema.md) (`posts`, `photo_items`),
[withdraw-work](./withdraw-work.md) (retraction), [exhibition-lifecycle](./exhibition-lifecycle.md) (phase gates)

---

## 1. User stories

- As a photographer, I can upload 1 file (SINGLE) or 2–N files (SERIES,
  up to `max_series_size`) with EXIF auto-extracted, and watch per-frame
  progress `PROCESSING` → `PENDING`.
- As a photographer, I can edit my work's `title`/`caption` while it is
  still `PENDING` (see §4).
- As a photographer, I can reorder frames inside my SERIES before
  moderation (see §5).

## 2. API — `POST /api/posts/upload-url`

**Access:** Authenticated (`PHOTOGRAPHER`, `ADMIN`). Validates **target
exhibition** `phase != ARCHIVED` (via `exhibitionId` body or latest
exhibition). No flag check (presign is cheap; flag is enforced at
`POST /api/posts`).

**Request Body (batch for SERIES):**

```json
{
  "files": [
    { "filename": "diptych_01.jpg", "contentType": "image/jpeg", "fileSizeBytes": 15420000 },
    { "filename": "diptych_02.jpg", "contentType": "image/jpeg", "fileSizeBytes": 12100000 }
  ]
}
```

> For SINGLE, send `files` with one element. Backwards compat:
> single-object body `{filename, contentType, fileSizeBytes}` is also
> accepted.

**API Validation:** Each `contentType` within allowlist (`image/jpeg`,
`image/png`, `image/webp`, `image/avif`), each `fileSizeBytes <= 50MB`,
batch size `1..N` where `N <= site_settings.max_series_size`.

**Response `200 OK`:**

```json
{
  "uploads": [
    { "uploadUrl": "https://minio.domain.com/raw-uploads/cuid-1.jpg?X-Amz-Signature=...", "s3Key": "raw-uploads/cuid-1.jpg", "expiresIn": 900 },
    { "uploadUrl": "https://minio.domain.com/raw-uploads/cuid-2.jpg?X-Amz-Signature=...", "s3Key": "raw-uploads/cuid-2.jpg", "expiresIn": 900 }
  ]
}
```

**Storage note:** `storage` module generates Presigned PUT URLs via MinIO
SDK (`S3_ENDPOINT`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`). `s3Key`
incorporates `cuid2` for uniqueness.

## 3. API — `POST /api/posts`

**Access:** Authenticated (`PHOTOGRAPHER`, `ADMIN`). Checks
`FeatureFlagGuard('series_enabled')` if `type===SERIES`.

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

> `exhibitionId` optional — defaults to latest exhibition (`phase IN
> ('PRE_EVENT','LIVE')` ordered by `start_date DESC`). If latest is
> `ARCHIVED`, must specify explicit active exhibition or error.
> `item_order` is implicit by array index (0-based). IDs for new `posts`
> and `photo_items` are generated in app via `createId()` (cuid2).

**API Actions (transactional, scoped to exhibition):**

1. Resolve `exhibitionId` (provided or latest). If
   `exhibitions.phase === 'ARCHIVED'` → `403 {code:"ARCHIVED"}` (see Errors). If
   `type===SERIES` and `series_enabled===false` → `403 {code:"FEATURE_DISABLED"}`.
2. Validate `1 <= items.length <= site_settings.max_series_size`.
3. Verify each `s3Key` exists in MinIO (HEAD) — optional but recommended.
4. Insert `posts` (`id=cuid2`, `exhibition_id`, `status='PROCESSING'`,
   `type`, `title`, `caption`, `photographer_id`).
5. Insert `photo_items` rows (`id=cuid2` per row, `post_id`,
   `item_order`, `original_s3_key`, `exif_metadata`).
6. Push **one BullMQ job per photo_item** to `image-processing`:

```json
[
  { "postId": "cuid-post", "photoItemId": "cuid-item-1", "s3Key": "raw-uploads/cuid-1.jpg", "curated": false },
  { "postId": "cuid-post", "photoItemId": "cuid-item-2", "s3Key": "raw-uploads/cuid-2.jpg", "curated": false }
]
```

> Canonical payload `{postId, photoItemId, s3Key, curated}` (see [PRD-Worker](../PRD-Worker.md) §1). Fresh uploads always send `curated: false`.

> Post status transitions to `PENDING` only after **all** its photo_items
> finish processing (see [PRD-Worker](../PRD-Worker.md) §3.3).

**Response `201 Created`:** newly created `post` (cuid2 ids) with nested
`items`.

**Errors:**

- `403 {code:"ARCHIVED"}` if target `exhibitions.phase === 'ARCHIVED'` →
  `"Exhibition has been archived, new uploads are closed"`.
- `403 {code:"FEATURE_DISABLED"}` if `type===SERIES` and `series_enabled===false`
  → `"SERIES creation is temporarily disabled"`.

## 4. API — `PATCH /api/posts/:id` (NEW for 1.0, photographer edit)

**Access:** work owner (`photographer_id`) or `ADMIN`. Allowed **while `posts.status IN ('PENDING', 'FAILED_PROCESSING')`** (editing approved/published works
is a curation decision → `409 {code:"EDIT_CLOSED"}`). Title/caption edit on `FAILED_PROCESSING` does not re-enqueue worker jobs. Blocked when parent exhibition is `ARCHIVED`
(`403 {code:"ARCHIVED"}`).

**Request Body (all optional, at least one required):**

```json
{ "title": "New Title", "caption": "New narrative." }
```

> Frame replacement by the photographer is **not** covered here — replace
> frames via withdraw + re-upload (or curator replace, see
> [curator-replace-revert](./curator-replace-revert.md)). Frame *order* is §5.

**API Actions:** `UPDATE posts SET title=COALESCE(:title,title),
caption=COALESCE(:caption,caption), updated_at=now() WHERE id=:id`.
No worker involvement, no status change, no audit row (author edit, not
admin action).

**Response `200 OK`:** updated `post` with nested `items`.

## 5. API — `PATCH /api/posts/:id/items/reorder` (NEW for 1.0, photographer, cuid2 ids)

Allows photographer to reorder frames inside a SERIES before moderation:
`{ "orderedItemIds": ["cuid-2","cuid-1","cuid-3"] }` → updates
`photo_items.item_order`. Owner or `ADMIN` while `posts.status='PENDING'`
(title/caption edit in §4 additionally allows `FAILED_PROCESSING`);
`403 {code:"ARCHIVED"}` when archived. Validates the id set equals the work's
current items (no drops/adds — that is withdraw + re-upload).

**Response `200 OK`:** `{ "postId": "cuid-post", "orderedItemIds": ["cuid-2","cuid-1","cuid-3"] }` (echo of the persisted order).
Errors: `400 VALIDATION_ERROR` (id set mismatch — drops/adds/foreign ids); `404 NOT_FOUND`; `409 {code:"EDIT_CLOSED"}` (status not `PENDING`); `403 {code:"ARCHIVED"}`.

## 6. Frontend (`/dashboard`, `/dashboard/upload`, `/dashboard/edit/$postId`)

Summary (full UI spec: [PRD-FE](../PRD-FE.md) §3.2):

- **Upload:** SINGLE/SERIES toggle (auto-switch on drop count),
  `feature_flags.series_enabled` + exhibition `phase` gating, per-file
  validation (type/size/`1920px`), zero-CPU `URL.createObjectURL`
  previews, sortable frame list, batch MinIO PUTs with progress, then
  `POST /api/posts`.
- **EXIF:** `exifr` per file → shared work `title`/`caption` + per-frame
  `exif_metadata` (badge `Auto-filled from EXIF`).
- **Edit:** form for `title`/`caption` (§4) + `FrameReorderList` (§5)
  while `PENDING`; withdrawn state hands off to [withdraw-work](./withdraw-work.md).

## 7. Worker

Standard per-frame pipeline (see [PRD-Worker](../PRD-Worker.md) §1–§3): N jobs for N
frames, `blurhash` + 3 derivatives each, post promotes to `PENDING`
when all succeed. Edit (§4) and reorder (§5) enqueue **no** jobs.

## 8. Schema touch

Writes `posts` + `photo_items` (see [db-schema](../db-schema.md)). No new tables. Limit
source: `site_settings.max_series_size` (grandfathering — old SERIES
stay valid when lowered).

## 9. Edge cases

- `items.length` over current `max_series_size` → `400 VALIDATION_ERROR`
  (limit is validated at upload-url *and* create time; flag may change
  between the two calls — create-time wins).
- `exhibitionId` omitted and latest is `ARCHIVED` → `403 ARCHIVED`
  with message naming the exhibition.
- Duplicate `s3Key` across items → `400 VALIDATION_ERROR`.
- Edit/reorder on `PROCESSING` work → `409` (wait for `PENDING` or `FAILED_PROCESSING`; title edit opens at `FAILED_PROCESSING`, reorder stays `PENDING`-only).
- `FAILED_PROCESSING` (after 3 worker attempts) → dashboard shows Retry (re-enqueue frames with `blurhash IS NULL`) + title edit + withdraw; reorder stays blocked until `PENDING`.

## 9b. API — `POST /api/posts/:id/retry` (NEW for 1.0, owner or `ADMIN`, cuid2)

Re-enqueues worker jobs for failed frames only (`photo_items` with
`blurhash IS NULL` under this `postId`); sibling frames with valid
derivatives are untouched. Allowed only from `FAILED_PROCESSING`
(otherwise `409`, no-op); `ARCHIVED` exhibition → `403 {code:"ARCHIVED"}`
(Retry does not bypass the freeze — withdraw the work instead, see
[withdraw-work](./withdraw-work.md) §2). Success replays the normal
pipeline: all frames green → `PENDING` (reorder re-opens); exhausted
again → `FAILED_PROCESSING`. Emits `AuditRequestedEvent`
(`action='post.retry'`). `PATCH` never re-enqueues (explicit non-goal).

## 10. Out of scope (post-1.0)

- Photographer frame replacement (withdraw + re-upload is the path);
  chunked/resumable uploads; client-side HEIC conversion.

## 11. Acceptance checklist

- [ ] SINGLE upload → `201`, 1 job, `PENDING` after worker
- [ ] SERIES of 3 → `201`, 3 jobs, `PENDING` only after all 3
- [ ] SERIES with `series_enabled=false` → `403 FEATURE_DISABLED`
- [ ] Upload into `ARCHIVED` → `403 ARCHIVED`
- [ ] `PATCH` title on PENDING → `200`; on PUBLISHED → `409`
- [ ] Frame reorder persists `item_order`; mismatched id set → `400`
- [ ] `FAILED_PROCESSING` → dashboard Retry re-enqueues only `blurhash IS NULL` frames; success promotes to `PENDING`
- [ ] `POST /:id/retry` on PENDING → `409`; in `ARCHIVED` → `403`
