# PRD Image Worker: Déclic — Asynchronous Image Processing Pipeline

**Version:** 0.4-draft (2026-09-01)  
**App Version:** 0.x pre-release — `1.0.0` at first exhibition launch (PRD draft version is independent of app semver)
**Main Stack:** NestJS, Bun 1.4, BullMQ + Redis, MinIO SDK, Bun.Image (native), blurhash, cuid2  
**Target:** Worker Consumer for derivative generation, blurhash, and work status updates (per photo_item, cuid2 ids)  
**Status:** Draft
**Last updated:** 2026-09-01

> This document complements `PRD-API.md`. The API produces **one job per `photo_item`** (ids `cuid2` `text`); the Worker consumes them and aggregates to the parent `posts` status (which belongs to an `exhibitions.id`). For DB schema, see `db-schema.md`; for API endpoints, **runtime feature flags**, **multi-exhibition** and **ARCHIVED freeze** + **BullMQ cron** `exhibition-scheduler`, see `PRD-API.md` §2.2/§2.8/§3.3/§4.5. Existing queued jobs remain valid when `series_enabled` toggles or an exhibition becomes `ARCHIVED` — flags/phases only gate **new** writes.

---

## 1. Scope & Pipeline Architecture

The Worker is fully responsible for asynchronous image processing after a photographer uploads original file(s) via Presigned URL(s). Processing **must not** block upload requests or degrade public gallery performance.

A work can be `SINGLE` (1 job) or `SERIES` (N jobs, one per `photo_items` row). The parent `posts.status` transitions `PROCESSING → PENDING` only after **all** its frames succeed.

### 1.1 Why Asynchronous (Architecture Decision)

**Approach B — asynchronous, event-driven pipeline** was chosen over synchronous in-request processing:

- Upload floods (pre-event, 10–50MB per file, batch/series uploads) do not affect browsing performance.
- Processing tier can scale independently from the API/Web tier.
- Failure to process one frame does not fail other works; a SERIES can be retried per failed frame.

### 1.2 Flow Diagram (per photo_item)

```
[ BullMQ Queue: image-processing ]  (Producer: NestJS API  →  POST /api/posts, one job per photo_item)
              │
              ▼
    1. Fetch Job Payload (postId, photoItemId, s3Key)
              │
              ▼
    2. Download Original Image Buffer (MinIO GetObject by s3Key)
              │
              ▼
    3. Generate Blurhash Placeholder
              │
              ▼
    4. Bun.Image Derivative Generation (Parallel Execution)
       ├── Thumbnail (Max width 400px, WebP 80%)
       ├── Web Size  (Max width 1200px, WebP 85%)
       └── Lightbox  (Max width 2048px, WebP/AVIF 88%)
              │
              ▼
    5. Upload Derivatives to MinIO Bucket (derivatives/{photoItemId}/...)
              │
              ▼
    6. Database Update (PostgreSQL Transaction, per frame)
       ├── Update `photo_items.blurhash` for this photoItemId
       ├── Insert metadata to `photo_derivatives` (3 rows, FK photo_item_id)
       └── Check parent post aggregation:
           └── IF all sibling photo_items have blurhash != NULL and derivatives exist
               THEN UPDATE `posts.status` -> 'PENDING', `updated_at` = now()
               ELSE leave `posts.status` = 'PROCESSING'
              │
              ▼
    7. (Optional) Notify photographer dashboard — work status PROCESSING → PENDING when last frame completes
```

**Queue:** BullMQ + Redis (self-hosted). Job payload per frame (`cuid2` text ids, **not** `uuid` — `users` ids remain `uuid`/`text`):

```json
{
  "postId": "cuid-post",
  "photoItemId": "cuid-photo-item",
  "s3Key": "raw-uploads/cuid-original.jpg",
  "curated": false
}
```

> For a SINGLE work, one job is enqueued. For a SERIES of 3, three jobs are enqueued (same `postId`, different `photoItemId`). **Curator replacement (Option C)** enqueues a single job with `curated:true` — same pipeline, but `photo_items.source` is already `CURATED` and old derivatives were deleted; worker regenerates them. When `feature_flags.series_enabled=false` or exhibition `ARCHIVED`, no new jobs of that type are enqueued; existing jobs in queue still process to completion.

**MinIO bucket layout (cuid2 s3Key):**

```
s3://pameran-foto/
├── raw-uploads/{cuid}-original.jpg          # original, one per photo_item (private)
└── derivatives/{photoItemId}/               # cuid2 folder
    ├── thumb.webp
    ├── web.webp
    └── lightbox.webp                        # public / CDN-cached, per frame
```

---

## 2. Image Derivative Specification & Output Standards

| Variant | Max Dimension (Longest Side) | Format | Quality | UI Usage |
|---|---|---|---|---|
| **Thumbnail** | `400px` | WebP | `80%` | Mobile grid & small thumbnails in admin (cover of SERIES = first item) |
| **Web** | `1200px` | WebP | `85%` | Justified Gallery Grid & desktop feed |
| **Lightbox** | `2048px` | WebP / AVIF | `88%` | Intercepting Lightbox Fullscreen — SERIES shows carousel |

**Additional rules:**

- **Aspect ratio:** Preserved `100%` without cropping — `fit: 'contain'`.
- **Color Profile:** Original ICC profile is precisely converted to **sRGB** for universal web display compatibility.
- **Naming:** `derivatives/{photoItemId}/{variant}.webp` (or `.avif` for lightbox if AVIF is chosen).
- **Metadata `photo_derivatives`:** `width`, `height`, `size_bytes`, `s3_key`, `url` (public CDN/MinIO URL) must be filled per variant, FK `photo_item_id`.

---

## 3. Component Implementation & Worker Code

### 3.1 Worker Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | **Bun 1.4** | Same as API — single runtime |
| Framework | **NestJS** + `@nestjs/bullmq` | `@Processor('image-processing')` consumer, `concurrency: 2` |
| Queue | **BullMQ + Redis** | Self-hosted via Docker |
| Storage | **MinIO SDK** (S3-compatible) | `getObject` / `putObject` |
| Image | **Bun.Image** (native, since Bun v1.3.14) | No `sharp` / ImageMagick binary |
| Placeholder | `blurhash` | Computed from original buffer, stored on `photo_items.blurhash` |

### 3.2 Bun.Image Integration

Derivative generation uses the native `Bun.Image` API without external binary dependencies. Each job processes **one frame**.

```typescript
// Conceptual implementation — one job per photo_item (cuid2 ids), post-level aggregation
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('image-processing')
export class ImageProcessorConsumer extends WorkerHost {
  async process(job: Job<{ postId: string; photoItemId: string; s3Key: string }>): Promise<void> { // ids are cuid2 text

    const { postId, photoItemId, s3Key } = job.data;

    // 1. Fetch original file from MinIO
    const originalBuffer = await this.storageService.getObject(s3Key);

    // 2. Create image instance via Bun.Image API
    const image = new Bun.Image(originalBuffer);

    // 3. Generate Web Size (max 1200px)
    const webBuffer = await image
      .resize({ width: 1200, fit: 'contain' })
      .toFormat('webp', { quality: 85 })
      .toBuffer();

    // 4. Generate Thumbnail (max 400px)
    const thumbBuffer = await image
      .resize({ width: 400, fit: 'contain' })
      .toFormat('webp', { quality: 80 })
      .toBuffer();

    // 5. Lightbox (max 2048px) — WebP or AVIF
    const lightboxBuffer = await image
      .resize({ width: 2048, fit: 'contain' })
      .toFormat('webp', { quality: 88 })
      .toBuffer();

    // 6. Upload derivatives to MinIO (per photo_item)
    const webKey = `derivatives/${photoItemId}/web.webp`;
    const thumbKey = `derivatives/${photoItemId}/thumb.webp`;
    const lightboxKey = `derivatives/${photoItemId}/lightbox.webp`;

    await Promise.all([
      this.storageService.putObject(webKey, webBuffer, 'image/webp'),
      this.storageService.putObject(thumbKey, thumbBuffer, 'image/webp'),
      this.storageService.putObject(lightboxKey, lightboxBuffer, 'image/webp'),
    ]);

    // 7. Calculate Blurhash
    const blurhashString = await this.generateBlurhash(originalBuffer);

    // 8. Update PostgreSQL — per-frame + post aggregation atomically
    await this.photoItemRepository.markFrameReady(photoItemId, {
      blurhash: blurhashString,
      derivatives: [
        { variant: 'web', s3Key: webKey, width: 1200, height: image.height, sizeBytes: webBuffer.length },
        { variant: 'thumbnail', s3Key: thumbKey, width: 400, height: image.height, sizeBytes: thumbBuffer.length },
        { variant: 'lightbox', s3Key: lightboxKey, width: 2048, height: image.height, sizeBytes: lightboxBuffer.length },
      ]
    });

    // 9. Check if parent post is fully ready -> promote to PENDING
    await this.postsRepository.tryPromoteToPending(postId);
  }

  private async generateBlurhash(buffer: Buffer): Promise<string> {
    // e.g. use `blurhash` npm + small resize first
    return 'L6PZf_e-00_w~qj[f6j[00fQ_3fQ';
  }
}

// Replacement follows the same pipeline — no separate code path
// `curated:true` is only for audit/logging; derivatives are regenerated
// identically and `posts.status` aggregation remains PENDING → PENDING
```

> **Note:** The `Bun.Image` API above is conceptual per the source PRD. Adjust to the final `Bun.Image` signature in the Bun version used (resize/toFormat/toBuffer).

### 3.3 Database Transactions

**Per-frame transaction (`markFrameReady`, also for `curated:true` replacement):**

```sql
BEGIN;
  -- for replacement, blurhash is nulled beforehand and old derivatives already deleted
  UPDATE photo_items SET blurhash = :blurhash, updated_at = now() WHERE id = :photoItemId;
  INSERT INTO photo_derivatives (id, photo_item_id, variant, s3_key, url, width, height, size_bytes)
  VALUES (cuid2, :photoItemId, ...), (cuid2, ...), (cuid2, ...);
COMMIT;
```

**Post aggregation (`tryPromoteToPending`):**

```sql
-- executed after each frame commit, with row-level lock on posts
SELECT COUNT(*) FROM photo_items WHERE post_id = :postId AND blurhash IS NULL;
-- if 0 and no missing derivatives:
UPDATE posts SET status = 'PENDING', updated_at = now()
WHERE id = :postId AND status = 'PROCESSING';
```

If any frame fails, rollback for that frame only — sibling frames still succeed; post stays `PROCESSING` until retry succeeds.

---

## 4. Resilience, Error Handling & Memory Management

### 4.1 Retry Strategy & Dead Letter Queue (DLQ) — same for original and `curated` replacement

**BullMQ configuration (per photo_item job):**

```typescript
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }, // 5s → 25s → 125s
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 }
}
```

**Failure Handling — after 3 consecutive failures for a single frame (e.g. corrupt image file):**

1. Mark the **work** as failed: `UPDATE posts SET status = 'FAILED_PROCESSING', updated_at = now() WHERE id = :postId` (or keep `PROCESSING` with a per-item `failed` flag — implementation choice; recommend work-level `FAILED_PROCESSING` so photographer sees actionable state).
2. Error details are logged to an internal log column (`posts.rejection_reason` or a separate `job_logs`/`admin_audit_logs` table).
3. Admin/photographer receives a notification on the dashboard to **retry the failed frame** (re-enqueue single `photoItemId` job) or **replace/discard** that frame.

> For SERIES, a single failed frame blocks promotion to `PENDING`; other frames' derivatives remain valid — no need to reprocess the whole series.

**DLQ:** Permanently failed frame jobs are moved to the DLQ (BullMQ `failed` set) — no further automatic retry without intervention.

### 4.2 Memory Management for Large Files (50MB+)

Photographers often upload 10–50MB+ files in batches/series right before the event. The Worker must be OOM-resistant.

| Strategy | Configuration |
|---|---|
| **Container memory limit** | `--max-old-space-size=2048` (or `BUN_MAX_OLD_SPACE_SIZE`) per worker instance |
| **Concurrency** | `concurrency: 2` per worker instance — sequential / limited, not unlimited parallel (each job is one frame) |
| **Streaming** | Download/upload via stream if size exceeds threshold (avoid holding full buffer in heap at once) |
| **Horizontal scaling** | Add worker instances (Docker Compose `scale worker=3`) is safer than increasing concurrency per instance |

**Worker health check:** BullMQ `stalled` detection + liveness probe (if orchestrated).

### 4.3 Observability (Recommended)

- Structured log per job: `postId`, `photoItemId`, `s3Key`, `durationMs`, `derivativeSizes`, `blurhash`, `seriesRemaining`.
- Metrics: `jobs_completed`, `jobs_failed`, `job_duration_histogram`, `memory_usage`, `posts_promoted_to_pending_total`.
- Alerts: DLQ depth > 0, memory > 80%, job failure rate > 5% within 10 minutes, posts stuck in `PROCESSING` > 10m (series partially failed).

---

## 5. Worker Configuration (Env & Docker)

Env used by the worker (see `docker-compose.yml`):

```
DATABASE_URL=postgres://...@postgres:5432/...
REDIS_URL=redis://redis:6379
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=pameran-foto
S3_FORCE_PATH_STYLE=true
```

`worker` service in `docker-compose.yml`:

```yaml
worker:
  image: oven/bun:1.4
  working_dir: /app
  command: sh -c "bun install && bun run start:dev"
  volumes:
    - ./apps/worker:/app
  depends_on:
    redis: { condition: service_healthy }
    minio: { condition: service_healthy }

# BullMQ cron (runs in API, not worker, but shares Redis)
# apps/api/src/modules/exhibitions/exhibition.scheduler.ts
# @Cron('0 * * * *') exhibition-scheduler -> UPDATE exhibitions SET phase='ARCHIVED' WHERE phase='LIVE' AND end_date <= now()
```

---

## 6. Cross References

- **General PRD:** `PRD.md` — vision, SERIES (SINGLE|SERIES) works, `feature_flags` kill-switch, `cuid2` domain ids, lifecycle `PRE_EVENT` → `LIVE` → `ARCHIVED`.
- **Backend API:** `PRD-API.md` — schema `posts`/`photo_items`/`photo_derivatives` (`text` cuid2), endpoint `POST /api/posts` (producer, batch), `ARCHIVED` + `FEATURE_DISABLED` rules.
- **DB Schema:** `db-schema.md` — canonical ER diagram (cuid2 for domain tables, `users` stays `uuid`/`text`).
- **Local Infra:** `docker-compose.yml` + `env.example`.
