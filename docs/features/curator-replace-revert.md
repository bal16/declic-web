---
aliases:
  - Curator Replace
  - Curator Revert
tags:
  - declic
  - feature
  - curation
status: draft
updated: 2026-09-07
---

# Feature: Curator Replace & Revert (Option C, non-destructive)

**Status:** Specced ([PRD](../specs/PRD.md) 0.4-draft) — not implemented
**Owner modules:** `posts` (frame update), `queue` (re-job), `audit`
**Related:** [PRD-API](../specs/PRD-API.md) §4.0 (error contract), [PRD-FE](../specs/PRD-FE.md) §3.2.1
(`CuratedDiffViewer`), [PRD-Worker](../specs/PRD-Worker.md) (`curated:true` payload),
[db-schema](../data/db-schema.md) (`photo_items.source`), [ADR-005](../adr/ADR-005-modular-monolith.md) Rule 2

---

## 1. User stories

- As a curator (CURATOR), I can upload a color-corrected replacement for
  any frame so the exhibition has a consistent look — without destroying
  the photographer's original.
- As a curator, I can undo my latest replacement when the
  correction was wrong (each call undoes one replace; repeatable).
- As a viewer, I see a `CURATED` badge on corrected frames (honesty:
  what I see is not exactly the shutter file).

## 2. API — `POST /api/admin/posts/:postId/frames/:itemId/replace` (NEW for 1.0, ADMIN + CURATOR, cuid2)

**Access:** `ADMIN`, `CURATOR`. **Blocked when parent exhibition is
`ARCHIVED`** (`403 ARCHIVED`). **Blocked while the frame is
mid-processing** (`photo_items.blurhash IS NULL` → `409
{code:"FRAME_PROCESSING"}` — one regeneration at a time).

**Request Body:**

```json
{
  "s3Key": "raw-uploads/cuid-curated-replacement.jpg",
  "exifMetadata": { "make": "Sony", "fNumber": 8 }
}
```

> `s3Key` must have been uploaded via `POST /api/posts/upload-url`
> (admin presigned URL, same allowlist, same `raw-uploads/` bucket).
> Original file at old `photo_items.original_s3_key` is **not deleted**.

**API Actions (transactional):**

1. Validate `photo_items.post_id == :postId` (mismatch → `404 {code:"NOT_FOUND"}`).
2. Verify `s3Key` exists in Object Storage (HEAD).
3. Fetch old `photo_items` row; capture `old_s3_key`, `old_source`,
   `old_exif_metadata`.
4. `UPDATE photo_items SET original_s3_key=:s3Key, source='CURATED',
   exif_metadata=COALESCE(:exifMetadata, exif_metadata), blurhash=NULL,
   updated_at=now() WHERE id=:itemId`.
5. Delete old `photo_derivatives` for that `photo_item_id` (avoid stale
   CDN; recommended over keep-until-overwrite).
6. Enqueue **one** `image-processing` job `{ postId, photoItemId: itemId,
   s3Key, curated: true, revert: false }` (same pipeline as [PRD-Worker](../specs/PRD-Worker.md)).
7. Emit `AuditRequestedEvent` `{ action:'photo_item.replace',
   adminId, targetId:itemId, payload:{ postId,
   old_s3_key, new_s3_key: s3Key, old_source, new_source:'CURATED' } }`
   (never a direct insert — [ADR-005](../adr/ADR-005-modular-monolith.md) Rule 2).

**Response `202 Accepted`:** `{ photoItemId, status:"PROCESSING" }` —
gallery shows old derivatives until worker completes (then new cover if
`item_order=0`).

## 3. API — `POST /api/admin/posts/:postId/frames/:itemId/revert` (NEW for 1.0, ADMIN + CURATOR, cuid2)

**Access:** `ADMIN`, `CURATOR`. **Blocked when parent exhibition is
`ARCHIVED`** (`403 {code:"ARCHIVED"}`). Stack of single-levels: each call undoes exactly the
**latest not-yet-undone** replace (repeatable — call again to walk further back).

**Request Body:** empty (`{}`). The server always resolves the latest
unreverted `photo_item.replace` audit row; no `from_audit_id` is accepted
(history is linear — chaining is tracked server-side, see step 2).

**API Actions (transactional):**

1. Validate `photo_items.post_id == :postId` (mismatch → `404 {code:"NOT_FOUND"}`).
2. Fetch the latest `admin_audit_logs` row with
   `action='photo_item.replace'` and `target_id=:itemId` that has **no**
   matching `photo_item.revert` row (server links each revert to the
   replace it undoes via `payload.from_audit_id` — written server-side,
   never accepted from input). If none →
   `409 {code:"NOTHING_TO_REVERT"}` (all replaces already undone, or never replaced).
3. If frame mid-processing (`photo_items.blurhash IS NULL`) →
   `409 {code:"FRAME_PROCESSING"}`.
4. Verify audited `old_s3_key` exists in Object Storge (HEAD); if gone →
   `409 {code:"ORIGINAL_MISSING"}`.
5. `UPDATE photo_items SET original_s3_key=:old_s3_key,
   source=:old_source, exif_metadata=:old_exif_metadata, blurhash=NULL,
   updated_at=now() WHERE id=:itemId`. Each call undoes one unreverted replace;
   repeat the call to walk further back; each revert writes its own audit row
   (with `payload.from_audit_id` pointing at the consumed replace row).
6. Delete current `photo_derivatives` for that `photo_item_id`.
7. Enqueue **one** job `{ postId, photoItemId: itemId, s3Key: old_s3_key,
   curated: false, revert: true }` (`revert:true` is audit/logging
   signal only).
8. Emit `AuditRequestedEvent` `{ action:'photo_item.revert',
   adminId, targetId:itemId, payload:{ postId,
   restored_s3_key: old_s3_key, restored_source: old_source,
   from_audit_id } }`.

**Response `202 Accepted`:** `{ photoItemId, status:"PROCESSING" }`.
History: `GET /api/admin/audit-logs?targetId=:itemId` (see
[curation-moderation](./curation-moderation.md) §5).

## 4. Frontend (`/admin/moderation`)

Summary (full UI spec: [PRD-FE](../specs/PRD-FE.md) §3.2.1):

- Per-frame **Replace** button → file picker → instant preview →
  **side-by-side diff slider** (`CuratedDiffViewer`: current `web.webp`
  vs new) → confirm → `202`, frame shows spinner until worker done.
- `CURATED` gold badge + audit-time tooltip on replaced frames.
- **Revert** button + confirm (names the undone replace, one level) →
  mini audit timeline under the frame (from audit-logs endpoint).
- Both disabled with `"Archived — replacements frozen"` when `ARCHIVED`.

## 5. Worker

Same pipeline, `curated:true` / `revert:true` are logging signals only
(see [PRD-Worker](../specs/PRD-Worker.md)). Replacement regenerates `blurhash` + 3
derivatives; `posts.status` aggregation unaffected (`PENDING` stays).

## 6. Schema touch

`photo_items.source` (`ORIGINAL`→`CURATED`), `updated_at` (see
[db-schema](../data/db-schema.md)). Old keys live on in `admin_audit_logs` payloads; old
files stay in `raw-uploads/`. No new tables.

## 7. Edge cases

- Replace on `PROCESSING` frame (initial upload unfinished) → allowed?
  **No** — same `FRAME_PROCESSING` guard (one regeneration at a time).
- Replace twice → two audit rows; revert walks back one level per call.
- Cover frame (`item_order=0`) replaced → gallery cover swaps after
  worker completes (CDN cache key changes with new `s3_key`).

## 8. Out of scope (post-1.0)

- In-browser color editor (curator uploads finished files); full-restore
  to photographer's original in one call; per-frame approve/reject.

## 9. Acceptance checklist

- [ ] Replace → `202`, `source=CURATED`, derivatives regenerate, badge shows
- [ ] Revert → restores prior `s3Key`, `photo_item.revert` audit row
- [ ] Revert with no replace history → `409 NOTHING_TO_REVERT`
- [ ] Replace while `blurhash IS NULL` → `409 FRAME_PROCESSING`
- [ ] `postId` ↔ `itemId` mismatch → `404 NOT_FOUND`
- [ ] Replace/revert in `ARCHIVED` → `403 ARCHIVED`
- [ ] Original file still in `raw-uploads/` after replace
