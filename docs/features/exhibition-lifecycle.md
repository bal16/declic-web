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

**Status:** Specced ([PRD](../specs/PRD.md) 0.4-draft) — not implemented
**Owner modules:** `exhibitions`, `queue` (scheduler), `audit`
**Related:** [PRD-API](../specs/PRD-API.md) §2.2 (schema), §4.0 (error contract),
[PRD-FE](../specs/PRD-FE.md) §2.1/§2.3 (gallery + `/admin/exhibitions`), [db-schema](../data/db-schema.md),
[gallery-discovery](./gallery-discovery.md) (scoped reads), [engagement](./engagement.md) (freeze)

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

Paginated per [PRD-API](../specs/PRD-API.md) §4.0 cursor pattern (`start_date DESC` + `id` tiebreaker,
`limit` default `20` max `50`): `{ data: [{id, title, slug, phase, posterUrl, location, startDate, endDate, postsCount}], nextCursor }`.
`?phase=LIVE|ARCHIVED` optional
(`DRAFT` excluded by default; `PRE_EVENT` excluded from public gallery — root `/` never resolves to `DRAFT`/`PRE_EVENT`). Root `/` uses latest `LIVE` (fallback
latest `ARCHIVED`) as `exhibitionId` default.

#### `GET /api/exhibitions/:slug` (public, cuid2 or slug)

**Response `200 OK`:** `{ id, title, slug, description, phase, posterUrl, location, startDate, endDate, postsCount }`.
`postsCount: integer` — `APPROVED`+visible works only for public;
all non-deleted works for `ADMIN`. Includes `poster` url.
Errors: `404 NOT_FOUND` (unknown slug; `DRAFT` slug is `404` for non-ADMIN).
`PRE_EVENT` slug → `200` with exhibition metadata but an empty works
grid for non-ADMIN (container visible as "coming soon", works hidden).
The `?phase=DRAFT` ADMIN bypass also applies on `:slug` detail (not
just the list). Non-latest `LIVE` exhibitions (two `LIVE` at once is
allowed) are reachable only via `/exhibition/$slug` — `/archive` lists
`ARCHIVED` only.

#### `GET /api/exhibitions/:id/posts` (public)

Alias for `GET /api/posts?exhibitionId=:id` — gallery scoped to that
exhibition, same cursor contract (see [gallery-discovery](./gallery-discovery.md)).

#### `POST /api/exhibitions` (ADMIN)

**Request Body:** `{ title*, slug*, start_date*, end_date*, description?, location?, poster_s3_key?, phase? }`
(`*` required; `phase` defaults to `PRE_EVENT`; `slug` unique, kebab-case).

**Response `201 Created`:** the created exhibition (cuid2 `id`) with `posts_count: 0`.
Errors: `400 VALIDATION_ERROR` (missing field, bad date range `end_date <= start_date`, slug collision).

> Poster upload: **dedicated endpoint** (NEW for 1.0) `POST /api/admin/exhibitions/:id/poster-upload-url`
> (ADMIN-only, `phase != ARCHIVED` on `:id`; `DRAFT`/`PRE_EVENT`/`LIVE` allowed).
> Body `{ filename, contentType, fileSizeBytes }` (single file, same
> allowlist/size rules as photos, key prefix `posters/`, `expiresIn: 900` — never
> `POST /api/posts/upload-url`, which is photographer-accessible and
> scoped to `raw-uploads/`). Response `{ uploadUrl, s3Key, expiresIn }`,
> then `PATCH /api/admin/exhibitions/:id { "posterS3Key":
> "posters/cuid-poster.jpg" }` → `200`. Flow: create exhibition first
> (no poster) → presign with the new `:id` → PUT → PATCH (no
> circular dependency: no presign before the exhibition exists).

#### `PATCH /api/admin/exhibitions/:id` (ADMIN, cuid2)

Partial body — any of `title`/`slug`/`description`/`location`/`poster_s3_key`/
`start_date`/`end_date`/`phase` (at least one required).

**Response `200 OK`:** the updated exhibition. Phase change emits
`AuditRequestedEvent` (`action=exhibition.phase_change`, `payload: {from, to, via:"manual"}`). Manual `ARCHIVED`
triggers same freeze logic as cron.
Errors: `404 NOT_FOUND`; `400 VALIDATION_ERROR` (slug collision, bad date range).

> No `DELETE` in v1 — exhibitions are never deleted (`ARCHIVED` is the
> terminal state; use `DRAFT` for mistaken/test rows). Deletion would
> need cascade-vs-block answers for works, derivatives, Object Storage objects
> (`raw-uploads/`, `derivatives/`, `posters/`), and dangling
> `phase_change` audit rows — deferred post-1.0 with a retention policy.

## 4. Scheduler (BullMQ cron `exhibition-scheduler`, hourly `0 * * * *`)

```typescript
// apps/api/src/modules/exhibitions/exhibition.scheduler.ts
@Cron('0 * * * *')
async handle() {
  const toArchive = await db.select().from(exhibitions)
    .where(and(eq(exhibitions.phase,'LIVE'), lte(exhibitions.end_date, new Date())));
  for (const ex of toArchive) {
    await db.update(exhibitions).set({ phase:'ARCHIVED', updated_at: new Date() }).where(eq(exhibitions.id, ex.id));
    // audit via event (best-effort) — never a direct insert (ADR-005 Rule 2)
    this.events.emit(new AuditRequestedEvent({ action:'exhibition.phase_change', adminId:null, targetId: ex.id, payload:{from:'LIVE', to:'ARCHIVED', via:'cron'}}));
    // no mirror — phase lives only in exhibitions table
  }
}
```

## 5. ARCHIVED freeze (read-only archive)

When `phase === 'ARCHIVED'`: gallery stays visible (`/archive`,
`/exhibition/$slug`), but `POST /api/posts/upload-url`, `POST /api/posts`,
`POST /api/posts/:id/like`, `POST /api/posts/:id/comments`, reorder, replace, revert →
`403 {code:"ARCHIVED"}`. Curation reorder blocked for that exhibition.
Likes/comments already stored stay readable (`likesCount` etc.);
`DELETE /api/posts/:id/like` (unlike) stays `204`. Exception: owner
withdraw of never-published works stays `204` (cleanup path, see
[withdraw-work](./withdraw-work.md) §2) — the freeze protects public
content, and an unpublished work has none.

## 6. Frontend (`/`, `/archive`, `/exhibition/$slug`, `/admin/exhibitions`)

Summary (full UI spec: [PRD-FE](../specs/PRD-FE.md) §2.1/§2.3):

- `/` resolves latest via `GET /api/exhibitions?limit=1` then gallery;
  exhibition header (title, poster, dates, location); `ARCHIVED` banner
  - disabled engagement when applicable.
- `/admin/exhibitions`: CRUD + **poster picker** (dedicated presign →
  PUT → `PATCH {poster_s3_key}`, instant preview) + manual phase
  override + scheduler status hint.

## 7. Worker

No image work. Scheduler lives in API (shares Redis). Note in
[PRD-Worker](../specs/PRD-Worker.md) §5 is a pointer only.

## 8. Schema touch

`exhibitions` table (cuid2, `slug` UNIQUE, indexes on `phase`,
`start_date DESC`, `end_date`); `posts.exhibition_id` FK (see
[db-schema](../data/db-schema.md)). No new tables beyond what exists.

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
- [ ] Manual `PATCH .../exhibitions/:id {phase}` flips phase + writes `exhibition.phase_change` audit (`via:"manual"`)
