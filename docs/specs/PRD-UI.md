---
title: PRD-UI Déclic
status: draft
updated: 2026-09-10
---

# PRD-UI: Déclic — Single-File UI Spec

**Status:** Draft.
**Target reader:** cheap LLM / model. No prior context needed. Everything UI needs is in this file.
**Language rule:** structure in English, all user-facing copy in Indonesian (verbatim).
**Stack (fixed):** TanStack Start + TypeScript + Tailwind CSS v4 + shadcn-style components on Base UI primitives + TanStack Query. Dark-first. No light theme in v1.

## 0. How To Read (rules for LLM)

1. A **work** = one card in gallery. Type `SINGLE` (1 frame) or `SERIES` (2-N frames). Likes, comments, moderation, ordering attach to the **work**, never to a frame.
2. A **frame** = one photo inside a work. Has cover flag (`item_order=0`), blurhash, EXIF, derivatives.
3. Branch UI logic on API error **`code`**, never on `message` text.
4. If exhibition `phase === 'ARCHIVED'`, the whole exhibition is read-only. Disable creates. Reads stay open.
5. Never invent routes, roles, or copy. Use only tables in this file.
6. IDs are opaque strings (cuid2). Never sort by ID. Never construct cursor by hand.

## 1. Context

Déclic is a curated photo exhibition site for UKM CLIC UNNES. Root `/` always shows the latest exhibition. Old exhibitions stay as permanent archive. Four roles: `VIEWER` (default), `PHOTOGRAPHER` (uploads), `CURATOR` (moderates artworks), `ADMIN` (everything + exhibitions/users/settings).

Exhibition lifecycle: `DRAFT` -> `PRE_EVENT` -> `LIVE` -> `ARCHIVED`.

- `DRAFT`: invisible to public. Admin only.
- `PRE_EVENT`: submissions open, curation open, public gallery hidden.
- `LIVE`: public gallery open. Submissions still open until `end_date`.
- `ARCHIVED`: permanent read-only archive. Gallery visible. All writes blocked (one exception: unlike stays open; one exception: owner withdraw of never-published work stays open).

Work statuses: `PROCESSING`, `PENDING`, `APPROVED`, `REJECTED`, `FAILED_PROCESSING`, `UNPUBLISHED`, `PUBLISHED` (legacy alias of visible `APPROVED`, treat as `APPROVED`).

## 2. Routes (full scope, flat table)

| Path | Who can see | Guard UI | Data needed (minimal) | Notes |
|---|---|---|---|---|
| `/` | Everyone (anon ok) | Public. Login only required for like/comment actions. | Latest exhibition (`LIVE`, fallback latest `ARCHIVED`) + its works list. Header: title, poster, start/end date, location. | If no `LIVE`/`ARCHIVED`, show empty-state (see §6). If latest is `ARCHIVED`, show archived banner. Sort: `Curated` default, `Most Liked`, `Recent`. Search by title/photographer (debounce 300ms). Optional `SINGLE`/`SERIES` pills. Infinite scroll. |
| `/archive` | Everyone | Public. | List of `ARCHIVED` exhibitions ordered by start date DESC. Card: poster + title + date. | Click goes to `/exhibition/$slug`. |
| `/exhibition/$slug` | Everyone | Public. | One exhibition by slug + its works. Same grid as `/` but header is that exhibition. | `DRAFT` slug = 404 for non-admin. `PRE_EVENT` slug = 200 with metadata but empty works grid ("coming soon"). `ARCHIVED` = banner + frozen engagement. |
| `/post/$postId` | Everyone | Public. Login wall for like/comment. | One work: all frames ordered by `item_order`, title, caption, photographer, likesCount, comments, per-frame EXIF. Breadcrumb back to exhibition. | Alias `/photo/$postId` redirects here. SSR + shareable. Withdrawn or `UNPUBLISHED` = 404 page `"Karya tidak ditemukan."`. |
| Lightbox modal over gallery (same URL as `/post/$postId`, masked) | Everyone | Public. | Same as detail, in modal. | Click card = open modal, URL bar keeps gallery URL. Refresh/share = full detail page. `Esc` or swipe up/down closes. |
| `/og/$postId` | Server only (social crawler) | None. | Renders PNG preview: cover frame + title + photographer + `SERIES • N` badge + UKM CLIC UNNES branding. | No UI. Server route only. |
| `/about` | Everyone | Public. | Static: exhibition intro, curatorial text, UKM CLIC UNNES profile. | No guard. |
| `/login` | Everyone | Public. | Two buttons: Google, GitHub (OAuth). | If provider not configured: button disabled + tooltip. If all login disabled: banner `"Login saat ini dinonaktifkan — hanya lihat"`. Like/comment/upload buttons open Auth Wall modal showing same banner. |
| `/dashboard` | `PHOTOGRAPHER`, `ADMIN` | Session required, else Auth Wall modal. Wrong role = 403 page. | Own works across exhibitions (all statuses), client-side exhibition filter dropdown. Card shows: exhibition badge, type badge (`SINGLE` / `SERIES • N`), status badge, per-frame progress, rejectionReason if `REJECTED` (owner only). | Withdraw button on `PENDING`, `REJECTED`, `PROCESSING`, `FAILED_PROCESSING`, `UNPUBLISHED`. Confirm dialog, then remove from list on success. |
| `/dashboard/upload` | `PHOTOGRAPHER`, `ADMIN` | Session + role. Blocked if exhibition `ARCHIVED` or `series_enabled=false` for SERIES. | Target exhibition picker (defaults to latest active). Mode toggle `SINGLE`/`SERIES` (auto-switch if >1 file dropped). Max files = `max_series_size` (default 10). | Flow: drag-drop -> validate -> local preview -> EXIF auto-fill -> parallel upload with progress -> create work. See §5.2. |
| `/dashboard/edit/$postId` | Owner or `ADMIN` | Session + owner check. Blocked if `ARCHIVED`. | Work title/caption + frame order list. | Title/caption editable in `PENDING` and `FAILED_PROCESSING`. Frame reorder only in `PENDING`. See §5.2. |
| `/admin/exhibitions` | `ADMIN` | Session + `ADMIN`. Else 403. | Exhibitions CRUD (no delete in v1). Fields: title, slug (unique), description, location, poster, start/end date, phase. Manual phase override. | Poster picker: file picker -> upload -> save key -> instant preview. See §5.5. |
| `/admin/moderation` | `ADMIN`, `CURATOR` | Session + role. | Queue of works per exhibition filter. SERIES shows cover + frame strip. Buttons: Approve, Reject (reason required). | Whole work moderated as one unit. No per-frame approve. Revisi visual via Reject + reason. See §5.3. |
| `/admin/curate` | `ADMIN`, `CURATOR` | Session + role. Disabled if exhibition `ARCHIVED`. | Canvas of works in curated order. Desktop/tablet: drag-drop grid. Mobile: ordered list with Move Up / Move Down + position number input. | Orders works only, not frames inside a series. Optimistic reorder + toast. See §5.3. |
| `/admin/comments` | `ADMIN`, `CURATOR` | Session + role. | Flat comment list per exhibition. Toggle hide per comment. | v1 is flat list. No nested UI. |
| `/admin/users` | `ADMIN` | Session + `ADMIN`. Own row dropdown disabled. | Searchable table: search name/email, role filter, per-row role dropdown (`VIEWER`/`PHOTOGRAPHER`/`CURATOR`/`ADMIN`), bulk-select promote. | Self change blocked with tooltip `"You cannot change your own role"`. Last-admin demote shows 409 error. |
| `/admin/settings` | `ADMIN` | Session + `ADMIN`. | Three toggles: `series_enabled`, `threaded_comments_enabled`, `comments_enabled`. One number input: `max_series_size` (1-20). Link to audit trail. | Banner preview for `maintenance_mode`. See §7. |

## 3. Design Tokens (copy-paste, normative)

Dark-only by lock (shadcn dual-mode scaffold). Structure follows shadcn default:
`@custom-variant dark` + `@theme inline` + `:root` (upstream light defaults,
kept unused) + `.dark` (gallery theme below, active). App always renders
`<html class="dark">`. No theme toggle UI in v1. No light mode in v1.

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));
:root {
  /* upstream shadcn light defaults (kept, unused in v1) */
  --radius: 0.5rem;
}
.dark {
  --background: 240 10% 4%;        /* #0A0A0C gallery canvas only */
  --foreground: 0 0% 96%;
  --card: 240 6% 8%;
  --card-foreground: 0 0% 96%;
  --popover: 240 6% 8%;
  --popover-foreground: 0 0% 96%;
  --primary: 25 95% 53%;           /* #F97316 vivid orange, accents only */
  --primary-foreground: 240 10% 4%;
  --secondary: 240 4% 16%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 4% 16%;
  --muted-foreground: 240 5% 65%;  /* EXIF data, secondary text */
  --accent: 240 4% 20%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62% 30%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 4% 16%;
  --input: 240 4% 16%;
  --ring: 25 95% 53%;              /* orange focus ring */
  --radius: 0.5rem;
}
```

Rules:

- `--primary` orange: CTA, active state, focus ring only. Never large backgrounds.
- Works/covers always sit on `.dark --background`. Never use `:root` light values in v1.
- `SERIES` badge: `--secondary` bg + `--secondary-foreground` text.
- Status badges: `Pending` yellow, `Approved` green, `Rejected` red.
- `--muted-foreground`: EXIF metadata, secondary text.

## 4. Components (use these, do not invent)

| Component | Source | Usage |
|---|---|---|
| `Dialog`, `Sheet` | shadcn / Base UI | Lightbox modal (carousel-aware), per-frame EXIF drawer, Auth Wall modal, confirm dialogs (withdraw, unpublish) |
| `DropdownMenu`, `Select` | shadcn / Base UI | Sort (`Curated`, `Most Liked`, `Recent`), admin status/type filters, user role dropdown |
| `Toast` / `Sonner` | shadcn | Feedback: upload ok, layout saved, per-frame errors, error-code toasts |
| `Badge` | shadcn | Status, `SERIES • N`, `Auto-filled from EXIF` |
| `GalleryGrid` | custom | Main grid container, cover-based justified layout |
| `WorkCard` (`PhotoCard` alias ok) | custom | One work card: cover, hover overlay (title, photographer, Like, type badge) |
| `SeriesCarousel` | custom | Frame carousel in lightbox/detail: dots, `1/N` indicator, per-frame metadata |
| `FrameReorderList` | custom + dnd-kit | Sortable frame list in upload/edit for SERIES `item_order` |
| `CurationCanvas` | custom + dnd-kit | Drag-drop grid of works for `/admin/curate` (desktop/tablet) |

Rules: never style raw HTML for the shadcn rows — always the component. Custom components compose primitives, never reimplement focus/keyboard the primitive already provides. Install Base UI per component as needed, never upfront.

## 5. Screens Detail

### 5.1 Public gallery + lightbox (`/`, `/exhibition/$slug`, `/post/$postId`)

- Grid: justified layout by cover aspect. No crop. Original aspect (`portrait`/`landscape`/`square`) preserved. Uniform row height, width adapts to cover aspect. SERIES card = cover frame (`item_order=0`) + badge `SERIES • N`.
- Images: plain `<img>` + `loading="lazy"` + responsive `sizes`. First 4 covers use `fetchpriority="high"`. Blurhash placeholder from cover frame to prevent layout shift. No framework image optimizer; derivatives are CDN-cached.
- Sort: `Curated` (default, by curated order), `Most Liked` (by likes count), `Recent` (by created date). Search: debounced 300ms on title or photographer name, scoped to current exhibition. Optional type pills `SINGLE`/`SERIES`.
- Infinite scroll with cursor pagination. Cursor is opaque. Never construct by hand. On invalid cursor show validation error, never crash.
- Lightbox modal: route-masked. Click card opens modal, gallery URL stays. Refresh/share loads standalone detail page. Content: `SINGLE` = one image (thumbnail/web/lightbox derivatives). `SERIES` = carousel ordered by `item_order`, dots + `1/N`. Swipe left/right on mobile, arrow keys on desktop cycle frames within work; after last frame, next goes to next work in curated order. Swipe up/down or `Esc` closes. Focus trapped inside modal.
- Metadata panel: drawer/sidebar toggle. Shows current frame EXIF: make, model, fNumber, exposureTime, iso, focalLength, DateTimeOriginal. Switching frames switches metadata.
- Like button: optimistic update (increment locally, rollback on failure). Endpoint is idempotent. Disabled when `ARCHIVED` (except unlike, see §5.6).
- Comments: flat list in v1, sorted by creation time. `parentId` is stored/returned but v1 renders flat. Auth Wall modal for guests, preserves draft comment. Disabled when `ARCHIVED` or when comments flag off.
- OG preview: server route only. Cover + title + photographer + series badge + branding for WhatsApp/X/Telegram unfurl.

### 5.2 Photographer upload + edit (`/dashboard/upload`, `/dashboard/edit/$postId`, `/dashboard`)

Upload:

- Mode toggle `SINGLE` (1 file) vs `SERIES` (2-N files). Auto-switch to `SERIES` if user drops >1 file. Max = `max_series_size` (default 10). Both client and server validate.
- Per-file validation: type allowlist `image/jpeg`, `image/png`, `image/webp`, `image/avif`. Size max 50MB per file, inline error per file. Min dimensions e.g. 1920px on longest side, checked via `new Image()` after `URL.createObjectURL(file)`.
- Instant local preview: `URL.createObjectURL(file)` in sortable list. Zero-CPU, no canvas re-encode (preserves ICC/original). User can drag to reorder (sets `item_order`), remove/replace a frame. Progress: overall + per-file bar during uploads.
- EXIF auto-extract per file with `exifr` before upload. Work-level `title` (from first filename sanitized, e.g. `morning_market_01.jpg` -> `Morning Market`), `caption` (empty, user fills once, shared). Per-frame: camera (`Make` + `Model`), lens (`LensModel`), settings (`FNumber`, `ExposureTime`, `ISO`, `FocalLength`), capture time (`DateTimeOriginal`). Mark auto fields with badge `Auto-filled from EXIF`. Per-frame EXIF stored on frame, shown in lightbox per frame.
- Upload flow (UI-level): 1) request upload URLs, 2) PUT files directly to object storage in parallel (with concurrency limit), 3) create work with `{exhibitionId, type, title, caption, items}`. Work starts `PROCESSING`, promotes to `PENDING` after all frames done. Dashboard shows per-frame progress: in-flight vs failed derived from blurhash + parent status (no separate frame status column).
- Gating: if exhibition `ARCHIVED`, hide/disable upload with archived message. If `series_enabled=false`, hide SERIES toggle/batch UI; attempting SERIES shows `"SERIES creation is temporarily disabled"`. Existing SERIES stay visible.
- Requires `exhibitionId` (defaults to latest active). `ARCHIVED` exhibitions selectable in dashboard filter but read-only (tooltip `"Archived — read only"`, actions disabled).

Edit (`/dashboard/edit/$postId`):

- Title/caption form. Allowed in `PENDING` and `FAILED_PROCESSING`. Blocked otherwise with `EDIT_CLOSED` error.
- Frame reorder list (`FrameReorderList`). Allowed only in `PENDING`. Validates full set (no drops/adds; drops/adds = withdraw + re-upload).
- Photographer frame replacement: not supported. Path is withdraw + re-upload. Curator never edits visuals; revisi visual diminta via `REJECT` + reason.

Dashboard (`/dashboard`):

- Status rendering: `PROCESSING` + spinner, `FAILED_PROCESSING` + Retry button, `PENDING`, `APPROVED`, `REJECTED` (+ `rejectionReason` visible to owner), `PUBLISHED` (treat as approved), `UNPUBLISHED`.
- `FAILED_PROCESSING`: shows Retry (re-enqueues failed frames only) + title edit + withdraw. Reorder stays blocked until `PENDING`.
- Withdraw button (see §5.7).

### 5.3 Moderation queue + curation canvas (`/admin/moderation`, `/admin/curate`)

Moderation queue:

- Per-exhibition filter (`?exhibitionId=`). Cover + frame strip for SERIES. Quick Approve / Reject on whole work. `REJECT` requires reason. SERIES moderated as one unit, no per-frame approve/reject.
- Transitions: `PENDING` -> `APPROVED`/`REJECTED`. `REJECTED` -> `APPROVED` (re-publish). `APPROVED` -> `REJECTED` or `UNPUBLISHED` (admin hide during `LIVE`, no reason needed). `UNPUBLISHED` -> `APPROVED` (re-publish). `PROCESSING`/`FAILED_PROCESSING` cannot be moderated (409). `APPROVE` puts work at bottom of curated order. `PUBLISHED` string is never a write action (rejected as validation error).
- `APPROVED` is staging: publicly visible only when parent exhibition is `LIVE` or `ARCHIVED`. `APPROVED` in `PRE_EVENT` stays hidden until `LIVE` (no bulk update on phase change).

Curation canvas:

- Desktop/tablet: drag-drop grid with dnd-kit (pointer + keyboard sensors). Each sortable item is a work (post), not a frame. SERIES card shows cover + stacked hint.
- Mobile: ordered card list with Move Up / Move Down buttons + direct position number input.
- Intra-series frame order is authorial, not editable here. Only photographer edit changes it.
- Move calculates new order between neighbor works. Sends single reorder call `{postId, prevDisplayOrder, nextDisplayOrder}`. Optimistic reorder + toast `"Layout order saved"`, rollback on failure.
- Disabled when exhibition `ARCHIVED`.

### 5.4 Exhibition management (`/admin/exhibitions`)

- Create/edit: `title`, `slug` (unique kebab-case), `description`, `location`, `poster`, `start_date`, `end_date`, `phase`. No delete in v1 (`ARCHIVED` is terminal; `DRAFT` for mistakes). Create generates ID. Slug collision = inline field error naming taken slug.
- Manual phase override (`PRE_EVENT`/`LIVE`/`ARCHIVED`). Manual `ARCHIVED` triggers same freeze as cron.
- Poster picker (dedicated flow): file picker -> get poster upload URL -> PUT to object storage (`posters/` prefix) -> save key via PATCH -> instant `URL.createObjectURL` preview before save. Same type/size rules as photos.
- Blocked when exhibition `ARCHIVED` for poster/reorder.

### 5.5 Likes + comments (lightbox + detail)

- Like: one like per work (SERIES liked as one unit). Optimistic UI. Double-click storm = single row, count converges. Unlike (DELETE) on not-yet-liked still returns success (204-equivalent, no error).
- Unlike stays enabled in `ARCHIVED` (sole write exception; removing own like adds no data). Like-create blocked in `ARCHIVED`.
- Comments: flat in v1. Create requires login. Hide toggle for curator/admin (soft hide, idempotent, count decrements once). Public sees only visible; admin/curator see all; author sees own hidden flagged.
- Failure precedence for comment create: invisible work (404) -> `ARCHIVED` freeze (403) -> comments flag off (403) -> threading flag off with `parentId` (400). Show frozen tooltip in latter cases.
- No comment edit in v1 (delete + repost is the path). No reactions beyond like. No notifications. Nested replies UI is post-1.0 (API already returns `parentId` for future).

### 5.6 Withdraw (in `/dashboard`)

- Withdraw button on `PENDING`, `REJECTED`, `PROCESSING`, `FAILED_PROCESSING`, `UNPUBLISHED` cards.
- Confirm dialog: `"Withdrawn works cannot be restored"` (no undo) -> optimistic removal -> success removes from list, failure toasts + rollback.
- Withdraw on `APPROVED`/`PUBLISHED` = 409 error toast (curation territory, contact admin). Withdrawn works never render (no tombstone, 404 for everyone including owner).
- In `ARCHIVED`: never-published works can still be withdrawn (cleanup path, no dead-end). `APPROVED`/`PUBLISHED` in `ARCHIVED` = frozen error.
- During `PROCESSING` withdraw: allowed, worker jobs cancelled best-effort, spinner shown alongside button.

### 5.7 Users + settings (`/admin/users`, `/admin/settings`)

Users table:

- Search name/email, role filter, cursor pagination. Per-row role dropdown + bulk-select promote for launch onboarding. Toast + refetch on success.
- Own row dropdown disabled. Last-admin demote surfaces 409 error.

Settings (minimal):

- Three toggles + one number input (`max_series_size` 1-20) over existing endpoints. Validation error if outside 1-20. Grandfathering: lowering limit never invalidates old oversized SERIES; only new creates validate.
- `maintenance_mode` = banner-only in v1 (blocks no writes by itself).

## 6. States (single table, verbatim Indonesian copy)

| Situation | UI | Copy (id, exact) |
|---|---|---|
| No `LIVE` (only `DRAFT`/`PRE_EVENT`) | empty-state grid | `"Pameran berikutnya sedang disiapkan."` |
| Gallery search no hit | empty-state grid | `"Tidak ada karya yang cocok."` |
| Flag off (`series_enabled`, `comments_enabled`) | hidden control / disabled + frozen tooltip | `"Sementara dinonaktifkan"` |
| `ARCHIVED` actions (upload/like-create/comment/reorder) | disabled + tooltip/banner | `"Pameran telah diarsip — hanya lihat"` |
| Upload failure (per frame) | inline error per file + toast | from `details` field errors |
| Login disabled (no OAuth configured) | disabled provider buttons + banner; Auth Wall shows same banner | `"Login saat ini dinonaktifkan — hanya lihat"` |
| `maintenance_mode=true` | top banner on all routes (blocks nothing in v1) | `"Pemeliharaan terjadwal — hanya lihat"` |
| 404 work (incl. withdrawn, `UNPUBLISHED`) | not-found page | `"Karya tidak ditemukan."` |
| Withdraw confirm | confirm dialog | `"Withdrawn works cannot be restored"` (keep English in dialog, no undo) |
| `ARCHIVED` gallery banner (long form) | top banner over grid | `"This exhibition is archived — browsing only"` + disable like/comment creation (unlike stays enabled) |
| Upload into `ARCHIVED` | disabled form + toast | `"Exhibition has been archived, new uploads are closed"` |
| SERIES attempt with flag off | hidden toggle + toast | `"SERIES creation is temporarily disabled"` |
| Dashboard `ARCHIVED` filter | disabled actions + tooltip | `"Archived — read only"` |
| Self role change | disabled dropdown + tooltip | `"You cannot change your own role"` |
| Provider button disabled | disabled button + tooltip | `"Login with <provider> is not configured"` |

API wire messages stay English codes. Only the table above is user-facing Indonesian.

## 7. Guards → UI Mapping

| Condition | UI behavior | API code (for toast branching) |
|---|---|---|
| Not logged in, clicks like/comment/upload | Uniform Auth Wall modal on every surface (gallery, lightbox, detail, dashboard, upload). Preserves state (file-drop, draft comment, pending like). Redirect to `/login` only for direct navigation to `/login`. | `UNAUTHENTICATED` (401) |
| Logged in, insufficient role | 403 page. Routes: `/dashboard/*` requires `PHOTOGRAPHER` or `ADMIN`; `/admin/moderation`, `/admin/curate`, `/admin/comments` require `ADMIN` or `CURATOR`; `/admin/exhibitions`, `/admin/users`, `/admin/settings` require `ADMIN`. | `FORBIDDEN` (403) |
| Exhibition `ARCHIVED`, attempt upload/like-create/comment/reorder | Disable control + tooltip/banner from §6. Unlike stays enabled. Owner withdraw of never-published stays enabled. | `ARCHIVED` (403) |
| `series_enabled=false`, attempt SERIES create | Hide SERIES toggle/batch UI. Toast on attempt. Existing SERIES readable. | `FEATURE_DISABLED` (403 for actions) |
| `comments_enabled=false`, attempt comment | Disable comment inputs everywhere with frozen tooltip. Reads stay open. | `FEATURE_DISABLED` (403) |
| Threading off, send `parentId` | Reject with validation toast. V1 renders flat always. | `FEATURE_DISABLED` (400 for shapes) |
| Withdraw `APPROVED`/`PUBLISHED` | 409 toast (contact admin). | `WITHDRAW_CLOSED` (409) |
| Edit/reorder outside allowed status | 409 toast. Title edit allowed `PENDING`/`FAILED_PROCESSING`; reorder only `PENDING`. | `EDIT_CLOSED` (409) |
| Self role change / last-admin demote | 409 toast + inline handling. | `ROLE_CHANGE_DENIED` (409, `details.reason`: `self` or `last_admin`) |
| Validation (slug collision, bad dates, bad cursor, bad type/count, duplicate key) | Inline field error + toast. Slug collision names the taken slug. | `VALIDATION_ERROR` (400, `details` = field errors) |
| Unknown id/slug, withdrawn work | 404 page `"Karya tidak ditemukan."` | `NOT_FOUND` (404) |
| `maintenance_mode=true` | Banner on all routes, blocks nothing in v1. | None (banner-only) |
| Login disabled | Disabled provider buttons + banner from §6. | None (UI-only) |

Frontend reads exhibition list + flags on mount, caches 10s. All guards are two-layered: fast UI guard + API as final authority. UI guard never replaces API guard.

Minimal API index (UI needs only these names):

- `GET /api/exhibitions`, `GET /api/exhibitions/:slug`, `GET /api/posts?exhibitionId&sort&search&type&cursor&limit`, `GET /api/posts/:id`, `GET /api/posts/mine`
- `POST /api/posts/upload-url`, `POST /api/posts`, `PATCH /api/posts/:id`, `PATCH /api/posts/:id/items/reorder`, `POST /api/posts/:id/retry`, `DELETE /api/posts/:id`
- `POST /api/posts/:id/like`, `DELETE /api/posts/:id/like`, `POST /api/posts/:id/comments`, `GET /api/posts/:id/comments`
- `PATCH /api/admin/curate/reorder`, `PATCH /api/admin/posts/:id/moderate`, `DELETE /api/admin/comments/:id`, `GET /api/admin/audit-logs`
- `POST /api/exhibitions`, `PATCH /api/admin/exhibitions/:id`, `POST /api/admin/exhibitions/:id/poster-upload-url`
- `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`
- `GET /api/feature-flags`, `PATCH /api/admin/feature-flags/:key`, `GET /api/site-settings`, `PATCH /api/admin/site-settings`
- Alias `/api/photos/*` -> `/api/posts/*` (deprecated, same behavior).

## 8. A11y + I18n + Responsive + Motion (checklist, normative)

A11y (WCAG AA):

- [ ] Text contrast >= 4.5:1. Orange `#F97316` on near-black must pass by measurement, not by eye. Muted text on muted bg likewise.
- [ ] Visible focus everywhere. Orange `--ring` on all interactive elements. Never `outline: none` without replacement.
- [ ] Do not reimplement what Base UI gives free. Dialog focus-trap, Escape-to-close, arrow-key nav, toast live-regions come from primitive. Custom `SeriesCarousel`, `CurationCanvas` must wire equivalent keyboard explicitly.
- [ ] Alt text two tiers. Informative (work cover): curatorial one-liner (title + photographer + frame note). Decorative (skeletons, placeholders): empty `alt=""`. EXIF text is data, not alt.
- [ ] Lightbox: `Esc` close, `Left`/`Right` frames/works, `Tab` trapped, `aria-modal`, carousel `aria-roledescription="carousel"`, pagination announced.

I18n:

- [ ] v1 ships Indonesian only (`id` default). All copy lives in typed dictionaries (`lib/i18n/id.ts`, `en.ts` later + `t()` accessor), never inline in components. Copy spread in this file becomes the `id` dictionary at implementation.
- [ ] Language preference persists (stored, default `id`). No i18n library in v1.
- [ ] API codes stay English. Only §6 table is Indonesian surface.

Responsive:

- [ ] Mobile-first. Gallery `1 col -> 2 -> justified`. Lightbox full-screen on mobile. `/admin/curate` canvas desktop/tablet, move up/down fallback on mobile.
- [ ] Images: plain `<img>` + lazy (first 4 high priority) + `sizes` + blurhash against layout shift.

Motion:

- [ ] Transitions <= 200ms ease-out. Skeleton shimmer for loading grids. `prefers-reduced-motion` disables shimmer/carousel autoplay. No other animation.

Performance targets:

- [ ] LCP < 2.0s (first 4 covers high priority + CDN).
- [ ] CLS < 0.05 (cover aspect + blurhash).
- [ ] INP < 150ms (optimistic like/comment).

## 9. Out Of Scope (do not build)

- E-commerce/payments, ticketing/RSVP, public unauthenticated submissions.
- General-purpose gallery (arbitrary curators/tenants).
- Full-text search (substring only), faceted filters (camera/lens), related-works rail.
- Nested replies UI (flat v1; `parentId` already returned for post-1.0, depth capped 1 when it lands).
- Reactions beyond like, comment edit, notifications.
- Photographer frame replacement (withdraw + re-upload is the path), chunked/resumable uploads, in-browser HEIC conversion, in-browser color editor.
- Exhibition delete, scheduled auto-`LIVE`, per-exhibition size limits, scheduled publishing, bulk approve, comment edit history, audit retention/rotation, orphan storage GC, restore/un-withdraw, tombstones.
- Invite-token onboarding, forced session revoke, role request flow, per-exhibition roles.
- `maintenance_mode` enforcement (banner-only in v1), worker flag consumption, `likes_enabled` flag.
- Light theme, i18n library, framework image optimizer.

## 10. Acceptance Checklist

Public:

- [ ] `/` shows latest `LIVE` (fallback latest `ARCHIVED`); no `LIVE`/`ARCHIVED` shows `"Pameran berikutnya sedang disiapkan."`
- [ ] Grid justified, no crop, `SERIES • N` badge, blurhash, infinite scroll, search matches title + photographer (case-insensitive, scoped to exhibition)
- [ ] Sort `Curated`/`Most Liked`/`Recent` orders correctly; `?type=SERIES` filters series only
- [ ] Lightbox masked modal + standalone `/post/$postId` both work; SERIES carousel dots + `1/N`; EXIF drawer per frame; keyboard `Esc`/`Left`/`Right` + focus trap
- [ ] Shared `/post/$postId` unfurls cover + title on WhatsApp
- [ ] `/archive` lists `ARCHIVED` by date; `/exhibition/$slug` scopes correctly; `DRAFT` slug 404 for non-admin; `PRE_EVENT` shows metadata + empty grid
- [ ] `ARCHIVED` banner shows, like-create/comment disabled with frozen tooltip, unlike stays enabled, reads ok

Photographer:

- [ ] Upload SINGLE (1 file) and SERIES (N files) with validation (type/size/1920px), zero-CPU preview, sortable order, batch progress, EXIF badge
- [ ] `series_enabled=false` hides SERIES toggle, attempt toasts disabled message, existing SERIES readable
- [ ] Upload into `ARCHIVED` blocked with archived message
- [ ] Edit title/caption in `PENDING`/`FAILED_PROCESSING`; reorder frames only in `PENDING`; otherwise 409
- [ ] Dashboard shows all statuses + per-frame progress + `rejectionReason` for owner; `FAILED_PROCESSING` shows Retry (failed frames only) + edit + withdraw
- [ ] Withdraw `PENDING`/`REJECTED`/`PROCESSING`/`FAILED_PROCESSING`/`UNPUBLISHED` removes from list; `APPROVED`/`PUBLISHED` toasts `WITHDRAW_CLOSED`; double withdraw idempotent; withdrawn 404 everywhere

Curator/Admin:

- [ ] Moderation queue per exhibition; Approve puts work at bottom; Reject requires reason; SERIES as one unit; `APPROVED` in `PRE_EVENT` hidden until `LIVE`
- [ ] Curation canvas drag-drop (desktop) / move up-down (mobile); reorder saves single rank, no rebalance; disabled in `ARCHIVED`
- [ ] Comment hide decrements count once, public hides, admin sees; idempotent
- [ ] Audit trail readable, filterable by action
- [ ] Exhibitions CRUD (no delete); slug collision inline error; poster picker round-trips with preview; manual phase override writes audit
- [ ] Users table search/filter/promote round-trips; self change disabled; last-admin 409; curator cannot reach users/flags/settings/exhibitions (403)
- [ ] Settings toggles + `max_series_size` 1-20 round-trip; out-of-range validation; grandfathering holds; toggles instant (no 10s wait)
- [ ] Flags: SERIES off blocks new SERIES (403) but reads stay; comments off blocks new comments (403) but reads stay; `parentId` with threading off is 400

Global:

- [ ] Auth Wall modal uniform on all surfaces, preserves state; 403 page on wrong role; anon reads public; no-session write 401
- [ ] All toasts branch on `code`, never message text
- [ ] States table §6 copy verbatim Indonesian
- [ ] A11y/i18n/responsive/motion checklist §8 passes
- [ ] No route/component/copy outside this file

## 11. Glossary (only these terms)

- Work (post): curatorial unit. `SINGLE` or `SERIES`. Liked/commented/moderated/ordered as one.
- Frame (photo_item): one image inside a work. Has `item_order`, blurhash, EXIF, derivatives.
- Cover: frame `item_order=0`. Sizes the gallery card.
- Curated order: public default sort by curated rank (`display_order`).
- Blurhash: placeholder string per frame, prevents layout shift.
- Exhibition: time-boxed event with `phase`. Root `/` = latest.
- Auth Wall: login modal preserving state (file-drop, draft, pending like).
