---
aliases:
  - Exhibition Lifecycle
  - Multi-Exhibition
tags:
  - declic
  - feature
  - exhibitions
status: draft
updated: 2026-09-07
---

# Feature: Multi-Exhibition Lifecycle (root = latest, cron archive, freeze)

**Status:** Specced ([[PRD]] 0.4-draft) — not implemented
**Owner modules:** `exhibitions`, `queue` (scheduler), `audit`
**Related:** [[PRD-API]] §2.2 (schema), §4.0 (error contract),
[[PRD-FE]] §2.1/§2.3 (gallery + `/admin/exhibitions`), [[db-schema]],
[[gallery-discovery]] (scoped reads), [[engagement]] (freeze)

---

## 1. User stories

- As a visitor, `/` always shows the **latest** exhibition; past ones
  live on at `/archive` and `/exhibition/$slug` (permanent, read-only).
- As an admin, I create the next exhibition as `DRAFT` (invisible),
  open it (`PRE_EVENT` → `LIVE`), and it archives itself at `end_date`
  via cron — with manual override when the cron misfires.
- As a photographer, I submit into an active exhibition; when it is
  `ARCHIVED` I see why uploads/likes/comments stop working.

## 2. Lifecycle

`DRAFT` → `PRE_EVENT` → `LIVE` → `ARCHIVED` (per `exhibitions.phase`).

- `DRAFT`: **invisible-to-public** — excluded by default from
  `GET /api/exhibitions` and all public gallery queries; ADMIN bypass
  via `?phase=DRAFT`. Prepare the next show while the current is `LIVE`.
- `PRE_EVENT`: **closed for public gallery** — submissions open, curation begins; public grid/lightbox do not render this exhibition (root `/` skips it). Photographer dashboard + upload allowed.
- `LIVE`: public spike window; submissions still allowed until `end_date`. Root `/` resolves to latest `LIVE` (fallback latest `ARCHIVED` when no `LIVE`).
- `ARCHIVED`: cron-driven read-only freeze (see §5).

## 3. API — exhibitions CRUD

### `GET /api/exhibitions` (public)

List ordered by `start_date DESC`. `?phase=LIVE|ARCHIVED` optional
(`DRAFT` excluded by default; `PRE_EVENT` excluded from public gallery — root `/` never resolves to `DRAFT`/`PRE_EVENT`). Root `/` uses latest `LIVE` (fallback
latest `ARCHIVED`) as `exhibition_id` default.

#### `GET /api/exhibitions/:slug` (public, cuid2 or slug)

Detail with `postsCount` (published only for public; all for ADMIN).
Includes `poster` url.

#### `GET /api/exhibitions/:id/posts` (public)

Alias for `GET /api/posts?exhibition_id=:id` — gallery scoped to that
exhibition (see [[gallery-discovery]]).

#### `POST /api/exhibitions` (ADMIN)

Create: `{ title, slug, description, location, poster_s3_key,
start_date, end_date, phase }` → `id=cuid2`. Slug unique.

> Poster upload: **dedicated endpoint** `POST /api/admin/exhibitions/:id/poster-upload-url`
> (ADMIN-only, `phase != ARCHIVED` on `:id`; `DRAFT`/`PRE_EVENT`/`LIVE` allowed).
> Body `{ filename, contentType, fileSizeBytes }` (single file, same
> allowlist/size rules as photos, key prefix `posters/` — never
> `POST /api/posts/upload-url`, which is photographer-accessible and
> scoped to `raw-uploads/`). Response `{ uploadUrl, s3Key, expiresIn }`,
> then `PATCH /api/admin/exhibitions/:id { "poster_s3_key":
> "posters/cuid-poster.jpg" }` → `200`. Flow: create exhibition first
> (no poster) → presign with the new `:id` → PUT → PATCH (no
> circular dependency: no presign before the exhibition exists).

#### `PATCH /api/admin/exhibitions/:id` (ADMIN, cuid2)

Update `title`/`slug`/`description`/`location`/`poster_s3_key`/
`start_date`/`end_date`/`phase`. Phase change audited
(`admin_audit_logs.action=exhibition.phase_change`). Manual `ARCHIVED`
triggers same freeze logic as cron.

## 4. Scheduler (BullMQ cron `exhibition-scheduler`, hourly `0 * * * *`)

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

## 5. ARCHIVED freeze (read-only archive)

When `phase === 'ARCHIVED'`: gallery stays visible (`/archive`,
`/exhibition/$slug`), but `POST /upload-url`, `POST /posts`,
`POST /likes`, `POST /comments`, reorder, replace, revert →
`403 {code:"ARCHIVED"}`. Curation reorder blocked for that exhibition.
Likes/comments already stored stay readable (`likesCount` etc.).

## 6. Frontend (`/`, `/archive`, `/exhibition/$slug`, `/admin/exhibitions`)

Summary (full UI spec: [[PRD-FE]] §2.1/§2.3):

- `/` resolves latest via `GET /api/exhibitions?limit=1` then gallery;
  exhibition header (title, poster, dates, location); `ARCHIVED` banner
  - disabled engagement when applicable.
- `/admin/exhibitions`: CRUD + **poster picker** (dedicated presign →
  PUT → `PATCH {poster_s3_key}`, instant preview) + manual phase
  override + scheduler status hint.

## 7. Worker

No image work. Scheduler lives in API (shares Redis). Note in
[[PRD-Worker]] §5 is a pointer only.

## 8. Schema touch

`exhibitions` table (cuid2, `slug` UNIQUE, indexes on `phase`,
`start_date DESC`, `end_date`); `posts.exhibition_id` FK (see
[[db-schema]]). No new tables beyond what exists.

## 9. Edge cases

- No `LIVE` exhibition (gap between shows) → `/` falls back to latest
  `ARCHIVED` with banner; uploads require explicit `exhibitionId`.
- No `LIVE` nor `ARCHIVED` (only `DRAFT`/`PRE_EVENT`) → `/` returns
  `200` empty-state "Pameran berikutnya sedang disiapkan." (never falls
  back to `DRAFT`); photographers with a session see a dashboard nudge
  when a `PRE_EVENT` exhibition is open.
- `end_date` moved forward while `LIVE` → next cron run archives.
- Slug collision on create → `400 VALIDATION_ERROR` (unique).
- Two exhibitions `LIVE` simultaneously → allowed by schema; `/`
  picks latest `start_date` (documented, not prevented).

## 10. Out of scope (post-1.0)

- Ticketing/RSVP; per-exhibition `max_series_size` (global only);
  scheduled auto-`LIVE` at `start_date` (manual `PRE_EVENT`→`LIVE`).

## 11. Acceptance checklist

- [ ] `/` shows latest `LIVE`; after cron, shows next/archived + banner
- [ ] No `LIVE`/`ARCHIVED` → `/` empty-state "Pameran berikutnya sedang disiapkan."
- [ ] Cron flips `LIVE`→`ARCHIVED` at `end_date` + audit row
- [ ] `ARCHIVED`: upload/like/comment/reorder/replace → `403 ARCHIVED`
- [ ] `DRAFT` invisible publicly, visible to ADMIN with `?phase=DRAFT`
- [ ] Poster picker round-trips through dedicated presign (`POST /api/admin/exhibitions/:id/poster-upload-url` → PUT `posters/` → `PATCH {poster_s3_key}`)
