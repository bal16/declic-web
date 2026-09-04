# PRD: Déclic — Pameran Online UKM CLIC

**Version:** 0.4-draft (2026-09-01)  
**App Version:** 0.x pre-release — `1.0.0` at first exhibition launch (PRD draft version is independent of app semver)
**Status:** Draft
**Owner:** TBD
**Last updated:** 2026-09-01

> **Changelog 0.4-draft:** Added **Option C — curator non-destructive replacement** (`photo_items.source` `ORIGINAL`→`CURATED`, `POST /api/admin/posts/:postId/frames/:itemId/replace`, audit `photo_item.replace`, diff viewer `CuratedDiffViewer`, blocked when `ARCHIVED`). See `PRD-API.md §2.4/§4.4`, `db-schema.md` `PHOTO_ITEMS.source`, `PRD-FE.md §3.2.1`, `PRD-Worker.md` `curated:true` payload.

---

## 0. Platform Name: Déclic

The platform is named **Déclic**.

### 0.1 Background

This platform is built for **UKM Fotografi & Sinematografi CLIC UNNES**
(Universitas Negeri Semarang), a student photography and cinematography club
established in 2004. **CLIC** is a French acronym for *"Club Leisure
d'Images Chasseurs"*, translated as *"Komunitas Pemburu Foto"* (Photo
Hunters Community). Fittingly, *"clic"* is also the French word for
*"click"* — the sound of a camera shutter or a mouse click.

### 0.2 Rationale

- **Direct wordplay on CLIC.** *Déclic* is a French word meaning a
  "trigger" or "decisive moment" — commonly used to describe the instant a
  photographer presses the shutter. It shares its root with "clic," keeping
  the platform's identity visibly connected to the club's own name and its
  French origin, without simply being "CLIC" plus a generic suffix.
- **Poetic fit for the subject matter.** As an exhibition of captured
  moments, "déclic" (the triggering moment) is thematically apt — the name
  itself describes what photography is.
- **Short, memorable, brandable.** A single word, easy to use as a domain
  name and easy to remember, distinct from generic terms like "gallery" or
  "exhibition."
- **Tagline potential.** Works naturally with taglines such as *"Déclic:
  momen yang diabadikan"* ("the moment, captured").

---

## 1. Overview

Déclic is a website for **curated photo exhibitions** (UKM CLIC UNNES). Multiple
photographers contribute their own work under individual accounts; an admin
reviews and curates every submission before it goes public. Each **exhibition**
(DB: `exhibitions`) is a time-boxed event with its own `start_date`/`end_date`/`phase` (`PRE_EVENT`, `LIVE`, `ARCHIVED`) and collection of works. The site **always shows the latest published exhibition at `/` (root/public)**; older exhibitions remain accessible as a permanent online archive at `/archive` and `/exhibition/[slug]`.

A **work** (DB: `posts`) belongs to one `exhibitions.id` and is the curatorial unit. It is either:

- **SINGLE** — one photo (`photo_items` count = 1), or
- **SERIES** — 2–N photos grouped as one work (e.g. diptych/triptych, photo essay) sharing a single title/caption and moderation status. Likes/comments/curation operate on the work, not on individual frames. Individual frames (DB: `photo_items`) hold per-image assets (`original_s3_key`, `blurhash`, `exif_metadata`) and order (`item_order`).

### 1.1 Problem statement

The exhibition needs a digital home that lets several photographers submit
work independently, gives the curator (admin) control over what's shown and
in what order, and gives the public an easy way to browse, react to, and
discuss the collection — both during the live event (when traffic is spiky)
and indefinitely afterward (as a lower-traffic archive).

### 1.2 Goals

- Let multiple photographers upload and manage their own submissions — as **SINGLE** or **SERIES** works.
- Give the admin full curatorial control: approve/reject each **work** (post), and
  arrange the final display order/layout at work granularity (LexoRank on `posts.display_order`).
- Let the public browse, like, and comment on published **works** (likes/comments attach to `posts`, not individual `photo_items`; a series is liked/commented as one unit).
- Handle a traffic spike around the physical event (e.g. opening night,
  social media shares) without degrading the experience.
- Transition cleanly from "live event" to "permanent archive" without a
  rebuild.
- Avoid vendor lock-in — every piece of infrastructure should be portable
  to a different host/provider with minimal rework.

### 1.3 Non-goals (for v1)

- Selling prints or digital copies (no e-commerce/payments).
- Ticketing or RSVP for the physical event.
- Public (unauthenticated) submissions — only registered photographers can
  contribute.
- ~~Multi-exhibition support~~ — **now in scope (v1.2):** root `/` shows **latest published exhibition**; previous exhibitions live on as archive at `/archive` + `/exhibition/[slug]`. General-purpose gallery (arbitrary curators/tenants) remains out of scope.

---

## 2. Users & Roles

| Role | Description | Key capabilities |
|---|---|---|
| **Visitor** | Any member of the public | Browse photos, like/react, comment (requires login) |
| **Photographer** | Contributor with an account | Upload photos, view own submission status, edit/withdraw pending submissions |
| **Admin** | Curator | Approve/reject submissions, arrange display order/layout, moderate comments |

All roles authenticate via OAuth (Google or GitHub) — there is no
email/password flow. Visitors must log in to like or comment, but can browse
without an account.

---

## 3. Timeline & Lifecycle (per exhibition)

Each `exhibitions` row has its own lifecycle; **root `/` always renders the latest `PUBLISHED`/`LIVE` exhibition** (by `start_date DESC`). Lifecycle is stored in `exhibitions.phase` (`PRE_EVENT` → `LIVE` → `ARCHIVED`).

1. **PRE_EVENT** — photographers submit works (SINGLE/SERIES), admin curates, upload rush. `POST /api/posts/upload-url` + `POST /api/posts` allowed.
2. **LIVE** — physical opening + online gallery live. Traffic spike 10–50×. Submissions still allowed until `end_date`.
3. **ARCHIVED** — triggered automatically by **BullMQ cron** when `end_date <= now()` (hourly job, see §8.4). Exhibition becomes **permanent read-only archive**: public gallery stays visible at `/archive` + `/exhibition/[slug]` but **submissions close and likes/comments freeze** (`403 FEATURE_DISABLED`, see §8.4). Older archives remain browsable forever; root shows the next latest exhibition.

> Cron: BullMQ queue `exhibition-scheduler` (not `pg_cron`) runs hourly → `UPDATE exhibitions SET phase='ARCHIVED' WHERE phase='LIVE' AND end_date <= now()`.

---

## 4. Functional Requirements

### 4.1 Visitor

- Browse the **latest exhibition at `/`** (grid/gallery view, individual work view) — a **SERIES** appears as one card (cover frame) in the grid; detail/lightbox shows a carousel of its frames. Browse older exhibitions at `/archive` and `/exhibition/[slug]`.
- Like/react to a published **work** (requires login) — one like per work, not per frame. **Frozen when its exhibition is `ARCHIVED`** (read-only archive, shows frozen notice).
- Comment on a published **work** (requires login) — thread is per work (`comments.post_id`); optional `parent_id` for v1 is reserved but UI is flat. **Frozen when `ARCHIVED`.**
- View work details (photographer credit, caption, per-frame metadata panel) — always allowed even in `ARCHIVED`.
- View exhibition metadata (title, poster, `start_date`/`end_date`, location) on `/exhibition/[slug]` header.

### 4.2 Photographer

- Log in via Google or GitHub OAuth.
- Upload **works** (with metadata: title, caption, etc.):
  - **SINGLE:** one image + metadata.
  - **SERIES:** 2–N images uploaded together as one work (max configurable, e.g. 10), sharing title/caption/moderation status; per-frame `item_order`, `exif_metadata`, and preview are kept on `photo_items`.
- View the moderation status of each **work** (`posts.status`: pending / approved /
  rejected) — individual frames have no independent status.
- Edit or withdraw a **work** while it's still pending (reorder frames within a series, replace a frame, edit title/caption).

### 4.3 Admin

- Log in via Google or GitHub OAuth (same auth system, elevated role).
- Manage **exhibitions** at `/admin/exhibitions` — create/edit `title`/`slug`/`start_date`/`end_date`/`location`/`poster`, manual phase override (`PRE_EVENT`/`LIVE`/`ARCHIVED`), slug unique. Creation auto-generates `cuid2` id.
- Review pending **works** per exhibition; approve or reject each **work** (status on `posts`; rejection reason shared for the whole work).
- Arrange the display order/layout of approved **works** per exhibition (ordering is on `posts.display_order`; frames inside a SERIES keep `photo_items.item_order`).
- **Curator replacement (non-destructive, Option C)** — admin/curator may upload a **curated replacement** for any frame (`photo_items`) while `exhibitions.phase != ARCHIVED` (e.g. color consistency). Original `original_s3_key` is kept via audit log (`admin_audit_logs` payload `old_s3_key`), `photo_items.source` flips `ORIGINAL` → `CURATED`, `blurhash` + derivatives are regenerated via the same worker pipeline. Original file stays in `raw-uploads/` (not deleted) for archive honesty. Revert possible via audit.
- Moderate (remove) inappropriate comments (per work thread; `is_hidden` + optional `parent_id`).
- Audit trail for admin actions (`admin_audit_logs`) including `feature_flag.toggle`, `exhibition.phase_change`, and `photo_item.replace`.
- Manage the pre-event → archive transition — scheduled via `end_date` cron; manual override allowed. Replacements are **blocked when `ARCHIVED`**.

---

## 5. Non-Functional Requirements

- **Scale:** hundreds of photos at launch; moderate traffic baseline with
  expected spikes of 10–50x around the physical event (opening night, social
  shares).
- **Performance:** public gallery pages should stay fast under spike load —
  this is treated primarily as a caching/CDN problem, not a compute-scaling
  problem (see Section 7).
- **Portability:** no component should be tied to a single cloud vendor.
  Every service must be deployable via Docker on any VPS/provider.
- **Security:** admin-only actions (approve/reject, layout, comment
  moderation) must be properly authorized, not just hidden in the UI.

---

## 6. System Architecture

```
                         ┌─────────────────┐
                         │   CDN / proxy    │  ← serves images + static assets,
                         │  (Cloudflare or  │     absorbs traffic spikes
                         │  Nginx/Caddy)    │
                         └────────┬─────────┘
                                  │
   ┌──────────────┐      ┌───────▼────────┐      ┌──────────────────────┐
    │ TanStack web  │◄────►│  NestJS API     │◄────►│   PostgreSQL          │
   │  (public +    │      │  (Bun 1.4)      │      │  (exhibitions, posts, │
   │  photographer │      │                 │      │   photo_items, users, │
   │  + admin UI)  │      │  + Better Auth  │      │   likes, comments)    │
   └──────────────┘      │  (OAuth mounted  │      │   sessions, order)    │
                          │   here)          │      └──────────────────────┘
                          └───────┬─────────┘
                                  │
                         ┌─────────▼─────────┐
                         │  MinIO (S3-compat) │  ← originals per photo_item + derivatives
                         │  self-hosted        │
                         └─────────┬─────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  BullMQ + Redis (queue)    │
                    └─────────────┬─────────────┘
                                  │
                         ┌─────────▼─────────┐
                         │  NestJS worker      │  ← resize/compress/format per photo_item
                         │  (Bun 1.4, Bun.Image)│    via @nestjs/bullmq consumer
                         └───────────────────┘
```

Work model: `exhibitions` (phase, start/end, slug, poster) → `posts` (exhibition_id, type SINGLE|SERIES, status, display_order) → `photo_items` (item_order, original_s3_key, blurhash, exif) → `photo_derivatives` (per frame). Root `/` = latest `PUBLISHED` exhibition.

Roles are enforced at the API layer based on the authenticated session, not
just in the frontend UI. Runtime feature flags (`feature_flags` table `id=1`: `series_enabled`, `threaded_comments_enabled`, `max_series_size`) provide a **kill-switch without deploy** — e.g. disabling new `SERIES` creation while keeping existing SERIES readable.

**ID generation:** Domain tables (`posts`, `photo_items`, `photo_derivatives`, `comments`, `admin_audit_logs`) use **cuid2** (`text` PK, app-generated via `@paralleldrive/cuid2`); `users` stays Better Auth-managed (`uuid`/`text`). Ordering/pagination uses `created_at` + `display_order`, never lexicographic `id`.

---

## 7. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | **Bun 1.4** (stable, Rust-based) | Used across web, API, and worker |
| Frontend | **TanStack Start (React) + TypeScript**, Tailwind CSS | SSR/streaming + prerender for public gallery SEO and fast first load |
| Backend API | **NestJS** on Bun | Modular structure: auth, photos, moderation, layout, comments/likes |
| Worker | **NestJS** on Bun, `@nestjs/bullmq` | Consumes image-processing jobs asynchronously |
| Database | **PostgreSQL** (self-hosted via Docker) | Relational data: users, exhibitions, posts, photo_items, likes, comments, ordering, audit logs |
| Object storage | **MinIO** (self-hosted, S3-compatible) | Chosen over LocalStack for dev/prod parity — same tool in dev and production; stores one original per `photo_items` + poster per `exhibitions` |
| Queue | **BullMQ + Redis** (self-hosted) | Decouples upload from image processing + **exhibition-scheduler cron** (`LIVE` → `ARCHIVED`) |
| Image processing | **Bun.Image** (native, built into Bun since v1.3.14) | Drop-in alternative to `sharp`; no native module compilation needed |
| Auth | **Better Auth**, mounted on the NestJS API via `@thallesp/nestjs-better-auth` | OAuth-only (Google + GitHub); API owns user/session/account tables directly |
| CDN | **Cloudflare** (or self-hosted Nginx/Caddy for zero third-party dependency) | Caches public images/assets to absorb event-day spikes |
| Deployment | **Docker Compose** on a VPS of choice (Hetzner, DigitalOcean, etc.) | No managed/vendor-specific services required |

### 7.1 Why these choices (key decisions log)

- **Bun over Node.js**: single consistent runtime across web/API/worker;
  Bun 1.4 is the first stable release on Bun's Rust-rewritten core, with
  substantial performance and memory improvements over the prior Zig runtime.
- **Bun.Image over `sharp`**: removes the need for native module
  compilation in Docker images entirely, and keeps the worker on the same
  runtime as the rest of the stack (no Node/Bun hybrid needed).
- **MinIO over LocalStack**: LocalStack emulates broad AWS services (Lambda,
  SQS, etc.) we don't use; MinIO is production-grade S3-compatible storage
  that can be the *same* tool in both dev and production, giving true
  dev/prod parity.
- **Better Auth over Auth.js**: Better Auth is the OAuth-only choice
  distributed with better multi-client support out of the box.
  Since September 2025, the Auth.js team has joined Better Auth, and
  Better Auth is now the recommended default for new projects. Critically,
  mounting it on the **API** (rather than the frontend, as is typical with
  Auth.js) makes the API the single source of truth for user data — no
  separate sync step is needed, and it scales cleanly to future clients
  (mobile apps in React Native/Expo, or fully native Kotlin/Swift apps)
  without redesigning the auth architecture. Native mobile clients would
  use Better Auth's `bearer()` token plugin instead of cookies, calling the
  same REST endpoints directly.
- **No vendor lock-in**: every stateful service (Postgres, Redis, MinIO)
  runs self-hosted via Docker; CDN is the only piece with a soft dependency
  on a third party (Cloudflare), and even that is swappable for a
  self-hosted reverse proxy.

---

## 8. Hard Problems & Design Decisions

### 8.1 Image ingestion & delivery pipeline (highest risk)

**Problem:** Photographers upload large original files (10–50MB+), often in
a batch right before the event. Processing must not block uploads or degrade
the public-facing site.

**Decision: Approach B — asynchronous, event-driven pipeline.**

Flow: photographer uploads directly to MinIO via a pre-signed URL → API
records metadata with a `processing` status → a job is pushed to a BullMQ
queue → a NestJS worker consumes the job, generates derivatives (thumbnail,
medium, lightbox sizes) using `Bun.Image`, and updates the status in
Postgres → the photographer's dashboard reflects the updated status.

This was chosen over synchronous in-request processing because it decouples
upload traffic from the public site's performance — a flood of pre-event
uploads never touches the browsing experience — and because the processing
tier can scale independently of the web/API tier.

**Client-side processing scope:** the browser is used only for local
preview (rendering a thumbnail from the selected file before upload) and
client-side validation (file type, size, minimum dimensions) — never for
generating the actual published derivatives. This keeps the stored original
untouched for archival purposes and keeps output quality/consistency
independent of the uploader's device or browser. `Bun.Image` in the worker
remains the single source of truth for every image size shown publicly.

### 8.2 Moderation workflow state machine

Every **work (post)** moves through: `draft → pending review → approved / rejected →
published`. Series is moderated as one unit — frames cannot be approved individually. Admin can also reorder published **works** independently of the
approval step (`posts.display_order`; intra-series order is `photo_items.item_order`). **Curator replacement** (Option C) is allowed on any `photo_items` of a work while its exhibition is not `ARCHIVED` — non-destructive, audited, derivatives regenerated (`photo_items.source` `ORIGINAL` → `CURATED`). Open question: what happens to likes/comments if an already
published **work** is later un-published (soft delete vs hard removal of
engagement data) — **decided v1.2:** `ARCHIVED` freeze + soft `UNPUBLISHED` keeps engagement rows but hidden from public (`status` filter). Denormalized `likes_count`/`comments_count` on `posts` are kept as optional cache (updated via transaction/trigger) to keep `GET /api/posts` <50ms; source of truth remains `likes`/`comments` tables.

### 8.3 Spiky traffic vs. moderate baseline

Public traffic is expected to spike 10–50x around the physical event
(opening night, social shares). This is addressed primarily through
aggressive CDN caching of public images and pages, keeping the spike from
ever reaching the app/API tier for read-heavy traffic.

### 8.4 Archive transition (now defined — v1.2)

**Decision (agreed):** Each exhibition auto-transitions `LIVE` → `ARCHIVED` via **BullMQ cron** (`exhibition-scheduler`, hourly) when `exhibitions.end_date <= now()`. No `pg_cron` — same Redis/BullMQ stack as image processing.

What changes at `ARCHIVED`:

- **Gallery stays visible** — at `/archive` and `/exhibition/[slug]` (permanent read-only archive). Root `/` automatically shows the next latest `PUBLISHED`/`LIVE` exhibition.
- **Submissions freeze:** `POST /api/posts/upload-url` + `POST /api/posts` → `403` (`Exhibition has been archived, new uploads are closed`).
- **Engagement freezes:** `POST /likes` + `POST /comments` → `403 FEATURE_DISABLED` (`Exhibition has been archived, likes and comments are frozen`). Reads remain.
- **Curation:** admin can still reorder? **No** — archive is read-only; reorder blocked via `EventPhaseGuard` for that exhibition.
- Manual override remains via `PATCH /api/admin/exhibitions/:id` (`phase`) if cron misfires.

### 8.5 Cross-origin session cookies (deployment constraint)

**Problem:** Better Auth uses cookie-based sessions for the web client. If
the web frontend and API are deployed on different top-level domains, browsers
increasingly treat that session cookie as a third-party cookie — and Safari
and Firefox already block third-party cookies by default, with a growing
share of Chrome users doing the same.

**Decision:** Web and API **must** be deployed under the same registrable
top-level domain (e.g. `app.pameranfoto.com` and `api.pameranfoto.com`), so
the session cookie is treated as first-party. This must be configured
explicitly via Better Auth's `trustedOrigins` and CORS settings on the API.
If a same-domain deployment isn't possible for some reason, a reverse-proxy
rewrite (API traffic proxied through the web app's own domain) is the
fallback. Native mobile clients sidestep this entirely by using token-based
auth (`bearer()` plugin) instead of cookies.

---

## 9. Open Questions

- [x] Exact behavior of the pre-event → archive transition (Section 8.4) — **decided v1.2:** BullMQ cron `LIVE` → `ARCHIVED` at `end_date`, gallery stays visible at `/archive`, submissions + likes/comments freeze.
- [x] What happens to likes/comments if a published photo is later un-published (Section 8.2) — **decided v1.2:** `ARCHIVED` freeze + soft `UNPUBLISHED` keeps engagement rows but hidden from public (`status` filter).
- [ ] Final choice of production domain structure (needed to lock in the cookie/CORS configuration from Section 8.5).
- [ ] Whether a mobile client (Expo/React Native, or native Kotlin/Swift) is in scope for a future version — the current architecture supports it without redesign, but it is not part of v1 scope.
- [ ] Exhibition poster storage limits and slug collision UX for `/exhibition/[slug]`.

---

## 10. Development Environment

A full local development stack (Postgres, Redis, MinIO, API, worker, web) is
defined in `docker-compose.yml`, using the same technology choices as
production for dev/prod parity. See the accompanying `docker-compose.yml`
and `.env.example` files.
