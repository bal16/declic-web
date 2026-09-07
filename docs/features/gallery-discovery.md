---
aliases:
  - Gallery Discovery
tags:
  - declic
  - feature
  - gallery
status: draft
updated: 2026-09-07
---

# Feature: Gallery & Discovery (public reads, lightbox, OG)

**Status:** Specced ([[PRD]] 0.4-draft) — not implemented
**Owner modules:** `posts` (reads), `exhibitions` (scoping)
**Related:** [[PRD-API]] §4.0 (cursor schema), [[PRD-FE]] §3.1,
[[exhibition-lifecycle]] (latest/archive scoping)

---

## 1. User stories

- As a visitor (no login), I can browse the latest exhibition grid,
  search by title/photographer, sort (Curated / Most Liked / Recent),
  and open any work in a lightbox or shareable detail page.
- As a visitor, shared links (`/post/$postId`) render rich previews
  (WhatsApp/X/Telegram) with cover + title + photographer + branding.
- As a photographer, `GET /api/posts/mine` powers my `/dashboard` list
  (all my statuses, nested items).

## 2. API — `GET /api/posts`

**Access:** Public (no auth). If a session exists, additional field
`isLiked` is included. **Scoped to an exhibition** — defaults to latest
published exhibition (see [[exhibition-lifecycle]]).

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `exhibition_id` | `cuid2` | latest exhibition | Filter by exhibition; omit for latest (`start_date DESC`) |
| `exhibition_slug` | `string` | — | Alternative (e.g. `declic-2026`) |
| `sort` | `enum` | `curated` | `curated` (by `posts.display_order`), `most_liked` (by `likes_count`), `recent` (by `posts.created_at` — **not** `id`) |
| `search` | `string` | — | Substring match on `posts.title` or `users.name` |
| `cursor` | `string` | — | Opaque `base64url(JSON)` per [[PRD-API]] §4.0 — **never raw cuid2 sort** |
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

**Performance:** `< 50ms` (composite index `(exhibition_id, status)`

- `likes_count`/`comments_count` cache + CDN). Only `status = PUBLISHED
AND deleted_at IS NULL` **within the requested exhibition** appears
publicly (except ADMIN). Cover for SERIES is `items[0]`.

## 3. API — `GET /api/posts/mine` & `GET /api/posts/:id`

- **`/mine`:** `PHOTOGRAPHER` (own data), `ADMIN` (all data). All
  statuses owned by the user, nested `items` (cuid2 ids). Powers
  `/dashboard` (see [[series-upload]] §6).
- **`/:id` (cuid2):** public if `PUBLISHED`, owner/admin any status. All
  `photo_items` ordered by `item_order` with derivatives.
- **Alias:** `GET /api/photos/:id` → `GET /api/posts/:id` (deprecated).

## 4. Frontend (`/`, `/archive`, `/post/$postId`, `/og/$postId`)

Summary (full UI spec: [[PRD-FE]] §3.1):

- **Grid:** justified layout by cover aspect (no crop), `SERIES • N`
  badge, `useInfiniteQuery` cursor pagination, blurhash placeholders
  (CLS `< 0.05`), `<img>` + CDN with priority on first 4 covers
  (LCP `< 2.0s`).
- **Sort/search:** `Curated` (LexoRank) / `Most Liked` (`likes_count`) /
  `Recent`; debounced `?search=`; optional `?type=` pills.
- **Lightbox:** route-masked modal (TanStack Router masking; refresh
  unmasks to detail), SERIES carousel (dots + `1/N`), per-frame EXIF
  drawer, keyboard (`Esc`/`←`/`→`, focus trap).
- **OG:** `/og/$postId` server route (Satori + resvg) — cover + title +
  photographer + `SERIES • N` + CLIC branding.
- **ARCHIVED:** banner + disabled engagement (see
  [[exhibition-lifecycle]] §5).

## 5. Worker

No involvement (reads serve stored derivatives + `blurhash`).

## 6. Schema touch

Reads `posts` (+ `photo_items`, `photo_derivatives`, `users` join).
Relies on composite `(exhibition_id, status)` index (see
[[db-schema]]). No new tables.

## 7. Edge cases

- Malformed cursor → `400 VALIDATION_ERROR` (never 500).
- `search` matches photographer name across exhibitions → scoped to
  requested exhibition only.
- SERIES with 0 ready items (mid-processing) → excluded until `PENDING`
  (never leaks `PROCESSING` publicly).

## 8. Out of scope (post-1.0)

- Full-text search (substring only); faceted filters (camera, lens);
  related-works rail.

## 9. Acceptance checklist

- [ ] Public gallery `< 50ms` p95, `/` = latest exhibition
- [ ] Cursor walk `curated` stable across reorder mid-pagination
- [ ] Shared `/post/$postId` unfurls with cover + title on WhatsApp
- [ ] `ARCHIVED` gallery readable, engagement frozen
