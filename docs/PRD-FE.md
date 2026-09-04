# PRD Frontend: Déclic — Web Application

**Version:** 0.4-draft (2026-09-01)  
**App Version:** 0.x pre-release — `1.0.0` at first exhibition launch (PRD draft version is independent of app semver)
**Main Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, dnd-kit, exifr  
**Target:** Web Client (Visitor, Photographer, Admin)  
**Status:** Draft
**Last updated:** 2026-09-01

> This document is the technical specification for the **Frontend Web** of the Déclic platform. For API and image pipeline specifications, see `PRD-API.md` and `PRD-Worker.md`. For general product context, see `PRD.md`. This version reflects **multi-exhibition** (root `/` = latest exhibition, `/archive` + `/exhibition/[slug]`), **SERIES** (`SINGLE`/`SERIES` with `photo_items`), **ARCHIVED freeze** (likes/comments read-only), **runtime feature flags**, and **cuid2** ids.

---

## 1. Overview & Frontend Scope

This document defines the technical specifications and user interface (UI) design for the Déclic web application.

The web app serves **three user types** within a **single unified Next.js system** (App Router) with access separation based on **Role-Based Access Control (RBAC)** and **Session Guard**:

| Role | Frontend Access | Guard |
|---|---|---|
| **Visitor** | Gallery of works, work detail/lightbox, likes & comments on works (login required for interactions) | Public, Auth Wall for actions |
| **Photographer** | Personal dashboard, upload SINGLE/SERIES works, edit Pending works (reorder frames) | `SessionGuard` + `Role=PHOTOGRAPHER` |
| **Admin/Curator** | Moderation per work, curation canvas (order works), comment moderation | `SessionGuard` + `Role=ADMIN` |

A **work (post)** is either `SINGLE` (one `photo_items` row) or `SERIES` (2–N frames). Likes/comments/curation attach to the **work**; derivatives/blurhash/exif are per **frame**. Gallery grid shows a work as one card (cover = first frame).

**Code location:** `apps/web` (Next.js, Bun 1.4) — see `docker-compose.yml`.

---

## 2. Route Map & Page Architecture (Sitemap)

### 2.1 Public Area (Visitor)

| Route | Description |
|---|---|
| `/` | **Gallery Home Page (latest exhibition)** — Immersive grid of **works from the latest `PUBLISHED`/`LIVE` exhibition** (resolved via `GET /api/exhibitions?limit=1` then `GET /api/posts?exhibition_id=latest`). Shows exhibition header (title, poster, `start_date`/`end_date`, location) + justified layout by cover image, search (`title`/photographer), sorting (`Curated`, `Most Liked`, `Recent`). Filter `SINGLE`/`SERIES` pills optional. When latest is `ARCHIVED`, banner `"This exhibition is archived — browsing only"` and likes/comments disabled. |
| `/archive` | **Archive List** — Grid/list of past `ARCHIVED` exhibitions (`GET /api/exhibitions?phase=ARCHIVED`) ordered by `start_date DESC`, with poster + title + date. |
| `/exhibition/[slug]` | **Exhibition Detail** — Gallery scoped to that `exhibitions.slug` (`GET /api/exhibitions/:slug` + `GET /api/posts?exhibition_slug=:slug`). Same grid/lightbox as `/` but header shows that exhibition’s metadata. `ARCHIVED` banner + frozen engagement if needed. |
| `@modal/(.)post/[id]` | **Work Lightbox Intercepting Route** — Immersive modal over the grid without full page reload, synced with URL. For `SERIES`, carousel of frames. Uses Next.js **Parallel & Intercepting Routes**. Alias `@modal/(.)photo/[id]` kept for BC → redirects to `post`. Respects `ARCHIVED` freeze (like/comment buttons disabled with tooltip). |
| `/post/[id]` | **Work Detail Standalone Page** — Fallback / direct link for individual works (includes `exhibition` breadcrumb). SEO-friendly & shareable. Shows all frames. Alias `/photo/[id]` → `/post/[id]`. |
| `/post/[id]/opengraph-image` | **Dynamic OpenGraph Image** — Automatic social media preview via `next/og` (`ImageResponse`). For SERIES, uses cover frame + series badge + exhibition title. |
| `/about` | **About Exhibition & CLIC** — Exhibition introduction page, curatorial description, and profile of UKM CLIC UNNES. |

### 2.2 Photographer Area (Contributor Dashboard)

| Route | Description | Guard |
|---|---|---|
| `/dashboard` | **Contributor Work List** — Manages uploaded **works** (cuid2 ids) scoped to selected exhibition (dropdown `GET /api/exhibitions`), and their moderation status (`PROCESSING`, `PENDING`, `APPROVED`, `REJECTED`, `PUBLISHED`). Shows `exhibition` badge + type badge (`SINGLE`/`SERIES` • N frames) and per-frame progress. Defaults to latest exhibition. | `PHOTOGRAPHER`, `ADMIN` |
| `/dashboard/upload` | **Work Upload Form** — Drag-and-drop zone for **1–N files** (SINGLE or SERIES) into selected exhibition, automatic EXIF extraction (`exifr`) per file, zero-CPU previews, sortable `item_order`, batch MinIO Presigned URLs. Gated by `feature_flags.series_enabled` and **exhibition `phase`** — when `ARCHIVED` or `series_enabled=false`, SERIES toggle hidden and blocked with `ARCHIVED`/`FEATURE_DISABLED`. Max `max_series_size` from flags. Requires `exhibitionId` (defaults to latest non-`ARCHIVED`). | `PHOTOGRAPHER`, `ADMIN` (checks `exhibitions.phase != ARCHIVED` + `FeatureFlagGuard` + `ExhibitionPhaseGuard`) |
| `/dashboard/edit/[id]` | **Work Edit Form** — Edits `title`/`caption` for the work (cuid2 `id`) and reorders/replaces frames inside a `SERIES` while status is `PENDING` (and exhibition not `ARCHIVED`). | Owner only |

### 2.2.1 Exhibition Selection

Upload and dashboard lists are **scoped to `exhibitions.id`**. Header dropdown (`GET /api/exhibitions`) lets photographer pick active `PRE_EVENT`/`LIVE` exhibition; `ARCHIVED` exhibitions appear disabled with `"Archived — read only"` tooltip. `POST /api/posts` requires `exhibitionId` (or defaults to latest active).

### 2.3 Admin / Curator Area

| Route | Description | Guard |
|---|---|---|
| `/admin/exhibitions` | **Exhibition Management** — CRUD `exhibitions` (`title`/`slug`/`description`/`location`/`poster`/`start_date`/`end_date`/`phase`). Create `cuid2`, edit slug unique, manual `ARCHIVED` transition, poster upload via Presigned URL. | `ADMIN` |
| `/admin/moderation` | **Moderation Queue** — Reviews incoming **works** per selected exhibition (filter `?exhibition_id=`), cover + frame strip for SERIES, quick **Approve** or **Reject** on whole work including `rejectionReason`. Each frame has **Replace with curated version** button (see §3.2.1). | `ADMIN` |
| `/admin/curate` | **Visual Layout Canvas** (Desktop/Tablet optimized) — Drag-and-drop canvas editor per exhibition for arranging public order of **works** (`posts.display_order` LexoRank scoped to `exhibition_id`). Series work as one card (cover, `CURATED` badge if any frame replaced). Mobile fallback: move up/down. Disabled when exhibition `ARCHIVED`. | `ADMIN` |
| `/admin/comments` | **Comment Moderation** — Monitors and filters work-level comment threads per exhibition (`is_hidden` toggle, flat list in v1). | `ADMIN` |

> All routes under `/dashboard/*` and `/admin/*` are protected by an **Auth Guard** (Middleware + HOC) that verifies the Better Auth session and `role` before rendering.

---

## 3. Key Features & UI Interaction Specs

### 3.1 Public Exhibition & Lightbox (`/`, `/post/[id]`)

#### Justified Dynamic Grid (works)

- Each **work** is one card in the justified layout. For `SERIES`, the card uses the **cover frame** (`photo_items` with `item_order=0`) for sizing/aspect; a badge `SERIES • N` is overlaid.
- Photos are displayed in their **original aspect ratio** (`portrait`/`landscape`/`square`) **without cropping**.
- Justified calculation balances rows — uniform row height, width adapts to cover aspect.
- Components: `<GalleryGrid />` (custom, iterates works) + `<WorkCard />` (formerly `<PhotoCard />`, kept as alias) with hover overlay: title, photographer, type badge, Like button, `likesCount`.

#### Sorting & Lightweight Search

- **Sorting Options:**
  - `Curated` (default) — based on `posts.display_order` (LexoRank)
  - `Most Liked` — `ORDER BY posts.likes_count DESC` (denormalized, see PRD-API §2.2)
  - `Recent` — `ORDER BY posts.created_at DESC`
- **Search Bar:** Fast **debounced query** (300ms) by `posts.title` or `photographer.name`. Query is forwarded as `?search=` to `GET /api/posts`. Optional type filter `?type=SERIES` pills.
- **Infinite Scrolling** remains via `TanStack Query` `useInfiniteQuery` with cursor on posts.

#### Infinite Scrolling & Blurhash Placeholder

- Uses **cursor-based pagination** via `TanStack Query` (`useInfiniteQuery`) — `cursor` + `limit` + `nextCursor` from `GET /api/posts?exhibition_id=...` (or `exhibition_slug`). Default `exhibition_id` is latest exhibition resolved on page load.
- Placeholder: **blurhash** from the cover frame's `photo_items.blurhash` to prevent **CLS** (see §5).
- Next.js `<Image />` with responsive `sizes` + `loading="lazy"` except for first 4 works (`priority`).
- **ARCHIVED banner:** When `exhibitions.phase === 'ARCHIVED'`, grid shows top banner `"This exhibition is archived — likes and comments are frozen"` and disables like/comment buttons (tooltip `ARCHIVED`).

#### Lightbox Intercepting Modal (`@modal/(.)post/[id]`)

- Uses Next.js **Parallel & Intercepting Routes** — clicking a work card opens the modal without full reload, URL remains `/post/[id]` (shareable, back-button aware).
- **Content:**
  - `SINGLE`: one image (thumbnail/web/lightbox derivatives from the sole `photo_item`).
  - `SERIES`: **carousel** of frames (ordered by `item_order`). Dots + `1/N` indicator. Swipe left/right on mobile, arrow keys on desktop cycle frames **within** the work; after last frame, next swipe navigates to next work in `curated` order.
- **Gesture:** Swipe left/right navigates frames; swipe up/down or `Esc` closes.
- **Interactions:**
  - **Like** button with **Optimistic UI Update** on the **work** (`posts.likes_count` + `isLiked` locally before response, rollback on failure — endpoint `POST /api/posts/:id/like` idempotent; **disabled + `403 ARCHIVED` when exhibition is `ARCHIVED`**).
  - Interactive **comment** thread with **Auth Wall** — thread is per work (`comments.post_id`). Flat in v1; `parent_id` is returned but ignored. **Frozen when `ARCHIVED`** (input disabled, banner shown).
  - **Metadata Panel Toggle** — Drawer/sidebar shows per-frame EXIF for the currently visible frame (`make`, `model`, `fNumber`, `exposureTime`, `iso`, `focalLength`, `DateTimeOriginal`), plus ability to switch frames and see each frame's metadata.
- **Accessibility:** `Esc` to close, `←`/`→` to navigate frames/works, `Tab` trapped inside modal, `aria-modal`, carousel has `aria-roledescription="carousel"`.

#### Social Sharing & Dynamic OG Image (`/post/[id]/opengraph-image`)

- Integrates `@vercel/og` / `next/og` for dynamic `ImageResponse`.
- When a `/post/[id]` link is shared to WhatsApp / X / Telegram, the preview card shows the **cover frame** high-res + title + photographer + `SERIES • N` badge + **UKM CLIC UNNES** branding.
- File: `apps/web/app/post/[id]/opengraph-image.tsx` (alias `photo/[id]` → redirect).

### 3.2 Photographer Work Upload Form (`/dashboard/upload`)

#### Client-Side Drag & Drop Zone & Zero-CPU Preview (batch)

- **Upload mode toggle:** `SINGLE` (single file) vs `SERIES` (multiple files, 2–N). Toggle auto-switches if user drops N>1 files. Max per series configurable (e.g. 10) — validated both client and API.
- **Validation per file:**
  - File type: `image/jpeg`, `image/png`, `image/webp` (allowlist, synced with API `upload-url` validation)
  - Size: max **50MB** per file (configurable, inline error per file)
  - Minimum dimensions: e.g. `1920px` on the longest side — checked async via `new Image()` after `URL.createObjectURL(file)`
- **Instant Local Preview:** `URL.createObjectURL(file)` renders instantly in a sortable list (no canvas re-encode) — guarantees ICC profile and original integrity, zero-CPU. User can **drag to reorder** frames to set `item_order`, remove/replace a frame, and see per-frame status.
- **Progress:** Batch progress bar (overall + per file) during MinIO PUTs.

#### Auto-Extract EXIF Metadata (`exifr`, per frame)

When files are dropped, `exifr` reads each file buffer locally (before upload):

| Form Field | EXIF Source (per frame) | Example |
|---|---|---|
| **Work Title** | File name of first file (sanitized: `morning_market_01.jpg` → `Morning Market`) — **one title per work** (shared) | `Morning Market — Triptych` |
| **Work Caption** | Empty, user fills once for the work | `Three moments from the same morning` |
| **Camera (per frame)** | `Make` + `Model` | `Sony ILCE-7M4` |
| **Lens (per frame)** | `LensModel` | `FE 35mm F1.4 GM` |
| **Technical Settings (per frame)** | `FNumber` (`f/2.8`), `ExposureTime` (`1/500s`), `ISO`, `FocalLength` (`35mm`) | `f/2.8 · 1/500s · ISO 100` |
| **Capture Time (per frame)** | `DateTimeOriginal` | `2026-08-20 17:42` |

- Work-level fields (`title`, `caption`) are **shared**; per-frame EXIF is stored on `photo_items.exif_metadata` and shown in the lightbox per frame.
- `Auto-filled from EXIF` badge (shadcn `<Badge />`) marks auto-populated per-frame fields.

#### Direct MinIO Upload via Presigned URLs (batch)

```
[Browser] --(1) POST /api/posts/upload-url {files: [{filename, contentType, fileSizeBytes} x N]}--> [NestJS API]
[Browser] <--(2) {uploads: [{uploadUrl, s3Key} x N]}---------------------------------------- [NestJS API]
[Browser] --(3) PUT uploadUrl (each file, parallel with progress)--------------------------> [MinIO] x N
[Browser] --(4) POST /api/posts {exhibitionId: "cuid-exhibition", type, title, caption, items: [{s3Key, exifMetadata} x N]}--> [NestJS API] -> BullMQ x N jobs
```

- Step (3) goes directly browser → MinIO (saves server bandwidth), N PUTs in parallel (with concurrency limit).
- Step (4) triggers **N** `image-processing` jobs (one per `photo_item`). Work status starts `PROCESSING`, dashboard shows per-frame progress and promotes to `PENDING` → `APPROVED`/`REJECTED` as a whole.

#### 3.2.1 Curator Replacement (Admin, Option C)

**Flow (non-destructive, blocked when `exhibitions.phase === 'ARCHIVED'`):**

```
[Admin] --(1) POST /api/posts/upload-url (curated file)--> [API] -- presigned URL
[Admin] --(2) PUT curated file --> [MinIO] raw-uploads/cuid-curated.jpg
[Admin] --(3) POST /api/admin/posts/:postId/frames/:itemId/replace {s3Key}--> [API]
        → UPDATE photo_items source=CURATED, audit old_s3_key, delete old derivatives
        → enqueue image-processing job (same worker pipeline, blurhash + 3 derivatives)
[Admin] --(4) Poll GET /api/posts/:id (items blurhash) --> worker done
```

- UI in `/admin/moderation` frame row: button `Replace` → file picker → instant `URL.createObjectURL` preview → **side-by-side diff viewer** (left: current `web.webp`, right: new preview) with slider. Badge `CURATED` (gold) on replaced frames; tooltip shows `audit` time.
- Original file stays in `raw-uploads/` (audit `payload.old_s3_key`); no delete. Revert: admin can pick `Revert` → `POST /api/admin/photo-items/:itemId/revert` (optional v1.1).
- Disabled when exhibition `ARCHIVED` with banner `"Archived — replacements frozen"`.

### 3.3 Admin Visual Layout Editor (`/admin/curate`)

#### Drag-and-Drop Grid Canvas (`dnd-kit`, works)

- **Desktop & Tablet:** Interactive grid canvas using `@dnd-kit/core` + `@dnd-kit/sortable` (pointer + keyboard sensors) where **each sortable item is a work** (post), not a frame. SERIES work card shows cover + stacked frames hint.
- Component: `<CurationCanvas />` (custom, sortable grid of works with blurhash preview of cover).

#### Mobile Fallback Experience

- On mobile, displays an **ordered card list of works** (instead of drag grid) with controls:
  - **[Move Up]** / **[Move Down]** buttons (operating on `posts.display_order`)
  - Direct position number input
- Intra-series frame order (`photo_items.item_order`) is **not** editable here — only in photographer's edit view. Curation orders works; frame order is authorial.

#### Fractional Indexing Sync

- When a work is moved, the UI calculates a new `display_order` (LexoRank / fractional index) between `prevDisplayOrder` and `nextDisplayOrder` of neighboring **works**.
- Sends `PATCH /api/admin/curate/reorder { postId, prevDisplayOrder, nextDisplayOrder }` — **O(1)** update, no full table rebalance. Legacy `photoId` alias still accepted.
- Optimistic reorder in UI + `Layout order saved` toast / rollback on API failure.

---

## 4. Design System & Component Tokens (shadcn/ui Compatible)

### 4.1 Visual Theme & Color Palette (Dark Mode First)

Theme is designed with a dark backdrop like a photography exhibition space — **dark-first**, fully compatible with Tailwind HSL variables / shadcn/ui.

```css
:root {
  /* Slate/Zinc Dark Exhibition Theme */
  --background: 240 10% 4%;        /* #0A0A0C Dark Gallery Canvas */
  --foreground: 0 0% 96%;           /* #F5F5F7 Main Text */
  
  --card: 240 6% 8%;               /* #131316 Card Container */
  --card-foreground: 0 0% 96%;
  
  --popover: 240 6% 8%;
  --popover-foreground: 0 0% 96%;
  
  --primary: 43 74% 49%;           /* #D4AF37 Warm Gold Accent */
  --primary-foreground: 240 10% 4%;
  
  --secondary: 240 4% 16%;         /* Muted Slate Button/Borders */
  --secondary-foreground: 0 0% 98%;
  
  --muted: 240 4% 16%;
  --muted-foreground: 240 5% 65%;  /* Secondary Text / EXIF Data */
  
  --accent: 240 4% 20%;
  --accent-foreground: 0 0% 98%;
  
  --destructive: 0 62% 30%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 4% 16%;
  --input: 240 4% 16%;
  --ring: 43 74% 49%;
  --radius: 0.5rem;
}
```

**Usage rules:**

- `--primary` (Warm Gold `#D4AF37`) only for curatorial accents (CTA, active state, focus ring) — not for large backgrounds.
- `--muted-foreground` for EXIF metadata / secondary text.
- All works/covers are displayed on top of `--background` dark for maximum contrast.
- `SERIES` badge uses `--secondary` background with `--secondary-foreground` text.

### 4.2 UI Components (Enhancing shadcn/ui Primitives)

| Component | Source | Usage |
|---|---|---|
| `<Dialog />` & `<Sheet />` | shadcn/ui | `LightboxModal` (now carousel-aware) and per-frame EXIF drawer |
| `<DropdownMenu />` & `<Select />` | shadcn/ui | Sorting options (`Curated`, `Most Liked`, `Recent`) and admin status/type filters (`SINGLE`/`SERIES`) |
| `<Toast />` / `<Sonner />` | shadcn/ui | Feedback: `"Work uploaded successfully"`, `"Layout order saved"`, per-frame upload errors |
| `<Badge />` | shadcn/ui | Moderation status (`Pending` yellow, `Approved` green, `Rejected` red) + `SERIES • N` + `"Auto-filled from EXIF"` + `CURATED` (gold, admin-replaced frame) |
| `<GalleryGrid />` | Custom | Main grid container rendering **works** (cover-based justified layout) |
| `<WorkCard />` (`<PhotoCard />` alias) | Custom | Work card with cover hover overlay (title, photographer, Like, type badge, `CURATED` indicator if any frame curated) |
| `<CurationCanvas />` | Custom (dnd-kit) | Drag-and-drop grid canvas of **works** for curator panel (desktop) |
| `<SeriesCarousel />` | Custom | Frame carousel inside lightbox/detail (dots, 1/N, per-frame metadata, `CURATED` badge per frame) |
| `<FrameReorderList />` | Custom (dnd-kit) | Sortable frame list in upload/edit for SERIES `item_order` |
| `<CuratedDiffViewer />` | Custom | Side-by-side slider diff for curator replacement (current vs new preview, in `/admin/moderation`) |

---

## 5. Frontend Performance & Core Web Vitals

| Metric | Target | Strategy |
|---|---|---|
| **Largest Contentful Paint (LCP)** | `< 2.0s` | Next.js `<Image />` with `priority` on first 4 **work covers** in viewport; responsive `sizes`; CDN cache for per-frame derivatives |
| **Cumulative Layout Shift (CLS)** | `< 0.05` | Measured cover aspect ratio (`width`/`height` from first `photo_items` derivative) + **blurhash** placeholder before load |
| **Interaction to Next Paint (INP)** | `< 150ms` | **Optimistic updates** on work Likes & Comments (`posts.likes_count` via TanStack Query `onMutate` + rollback) |
| **Accessibility (a11y)** | WCAG AA | Full keyboard in Lightbox carousel (`Esc` close, `←`/`→` frame/work, `Tab` trap), pagination announced, `alt` from work `title` + frame index |

**Additional optimizations:**

- `useInfiniteQuery` with `staleTime` + `cacheTime` for gallery of works — no excessive refetch when navigating back from Lightbox.
- Dynamic import for `CurationCanvas` + `SeriesCarousel` (only loads `dnd-kit`/carousel code on `/admin/curate` and `/post/[id]`).
- Series lightbox prefetches next frame's `web` derivative.

---

## 6. Better Auth Integration & Token/Cookie Handling

### 6.1 Client SDK

```typescript
import { useSession } from "better-auth/react";
// or import { authClient } from "@/lib/auth-client"

const { data: session, isPending } = useSession();
// session.user.name, session.user.email, session.user.image, session.user.role
```

- `better-auth` is mounted on the **NestJS API** (`@thallesp/nestjs-better-auth`), not on Next.js — `apps/web` acts only as a client.
- Frontend env: `NEXT_PUBLIC_API_URL=http://localhost:3001`, `NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3001`.

### 6.2 Session Handling (Cookie vs Bearer)

| Client | Mechanism | Configuration |
|---|---|---|
| **Web (Next.js)** | First-party cookie: `HTTP-Only`, `Secure`, `SameSite=Lax` | Web & API must share the same registrable domain (`app.declic.com` + `api.declic.com`) via `trustedOrigins` + CORS. Fallback: reverse-proxy `apps/web` proxies `/api/*` → API |
| **Mobile (future)** | `Authorization: Bearer <token>` via Better Auth `bearer()` plugin | No cookies, hits `api.*` directly |

### 6.3 Auth Guard Component

```typescript
// apps/web/middleware.ts or HOC
// - /dashboard/*  → requires session + role PHOTOGRAPHER|ADMIN
// - /admin/*      → requires session + role ADMIN
// - If not logged in → redirect to /login or show Auth Wall modal
// - If insufficient role → 403 page
```

- Guard is **two-layered**: Middleware (fast redirect) + API `RolesGuard` + `FeatureFlagGuard` + `ExhibitionPhaseGuard` (final authority — UI guard does not replace API guard).
- Additional upload/engagement guards:
  - if selected `exhibitions.phase === 'ARCHIVED'`, `/dashboard/upload` shows `"Exhibition has been archived, new uploads are closed"` (API also returns `403`).
  - if `feature_flags.series_enabled === false`, upload form hides SERIES toggle/batch UI and shows `"SERIES creation is temporarily disabled"` on attempt (API returns `403 FEATURE_DISABLED`). Existing SERIES works remain visible.
  - if `exhibitions.phase === 'ARCHIVED'`, like/comment buttons everywhere (gallery, lightbox, `/post/[id]`) are **disabled** with tooltip `"This exhibition is archived — likes and comments are frozen"` (API returns `403 ARCHIVED` on POST). Reads remain.
  - Frontend reads `GET /api/exhibitions` (latest) + `GET /api/feature-flags` on mount; polling/cache 10s TTL. All `id` params are `cuid2` text — never sorted lexicographically; pagination uses `created_at` cursor. Root `/` auto-resolves to latest exhibition (`start_date DESC`).

---

## 7. Cross References

- **General PRD:** `PRD.md` — vision, multi-exhibition (latest at `/`), SERIES works, per-exhibition lifecycle + `ARCHIVED` freeze + cron, system architecture.
- **Backend API:** `PRD-API.md` — `exhibitions` CRUD + `POST /api/posts` scoped to `exhibitionId`, `GET /api/posts?exhibition_id`, `GET /api/exhibitions` + scheduler `exhibition-scheduler`, `ARCHIVED` freeze, RBAC + phase + flag guards.
- **Image Worker:** `PRD-Worker.md` — `image-processing` per `photo_item` (`cuid2`), aggregation to `posts.status`, scheduler note (no worker change for exhibitions).
- **DB Schema:** `db-schema.md` — canonical ER (`exhibitions` → `posts` → `photo_items` + `photo_derivatives`, `cuid2` domain ids).
- **Local Infra:** `docker-compose.yml` + `env.example` — services `web` (Next.js), `api` (NestJS), `worker`, `postgres`, `redis`, `minio`.
