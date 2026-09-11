---
aliases:
  - Design System
tags:
  - declic
  - frontend
  - design
status: draft
updated: 2026-09-09
---

# DESIGN — Déclic Design System Contract

**Status:** Draft (for owner review — tokens not yet implemented in `styles.css`)
**Related:** [PRD-FE](../specs/PRD-FE.md) §4 (decision history), [frontend](./frontend.md) (implementation guide), `../../apps/web/src/styles.css`

PRD-FE §4 decided the *look* (dark gallery, orange accent, shadcn-compatible).
This file is the *implementation contract*: exact tokens, component set,
and standards. On conflict between an example here and PRD-FE §4, this
file wins for implementation (flag the drift when you see it).

---

## 1. Tokens (shadcn dual-mode scaffold, locked to dark in v1)

Follow shadcn convention for Tailwind v4 exactly: `@custom-variant dark`,
semantic CSS variables mapped through `@theme inline` in
`apps/web/src/styles.css`, `:root` (light) + `.dark` override. v1 is
dark-only by lock, not by removal: `<html class="dark">` is always set,
there is no theme toggle UI. The `:root` light values are the upstream
shadcn defaults, kept for scaffold/component compat and never activated
in v1. Light mode UI remains out of scope.

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... same mapping as shadcn scaffold (card, popover, primary, */
  /* secondary, muted, accent, destructive, border, input, ring) */
}
:root {
  /* upstream shadcn light defaults (kept, unused in v1) */
  --radius: 0.5rem;
}
.dark {
  /* Déclic gallery theme (active in v1) */
  --background: 240 10% 4%;   /* #0A0A0C gallery canvas only */
  --foreground: 0 0% 96%;
  --card: 240 6% 8%;
  --popover: 240 6% 8%;
  --primary: 25 95% 53%;      /* #F97316 orange, accents only */
  --secondary: 240 4% 16%;
  --muted: 240 4% 16%;
  --muted-foreground: 240 5% 65%;
  --accent: 240 4% 20%;
  --destructive: 0 62% 30%;
  --border: 240 4% 16%;
  --input: 240 4% 16%;
  --ring: 25 95% 53%;
}
```

Palette (`.dark` values, from PRD-FE §4.1, unchanged):

| Token                                  | Value                         | Use                                                                         |
| -------------------------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| `--background`                         | `240 10% 4%` (`#0A0A0C`)      | gallery canvas only                                                         |
| `--foreground`                         | `0 0% 96%`                    | main text                                                                   |
| `--card` / `--popover`                 | `240 6% 8%`                   | containers, overlays                                                        |
| `--primary`                            | `25 95% 53%` (`#F97316` orange) | curatorial accents ONLY (CTA, active, focus ring) — never large backgrounds |
| `--secondary` / `--muted` / `--accent` | `240 4% 16–20%`               | buttons, borders, inputs                                                    |
| `--muted-foreground`                   | `240 5% 65%`                  | EXIF data, secondary text                                                   |
| `--destructive`                        | `0 62% 30%`                   | destructive actions                                                         |
| `--border` / `--input`                 | `240 4% 16%`                  |                                                                             |
| `--ring`                               | `25 95% 53%`                  | focus ring (see §4)                                                         |
| `--radius`                             | `0.5rem`                      |                                                                             |

Rules: `--primary` never backgrounds; works/covers always sit on
`.dark --background`; `SERIES` badge = `--secondary` bg + `--secondary-foreground`
text. Never use the `:root` light values in v1
(app is always `.dark`); a future light mode = design new `:root`
gallery-light values, no structural change.

## 2. Component set (shadcn-style, Base UI primitives)

Copy-paste into `apps/web/src/components/ui/` (own the code — no
component-registry dependency). Headless behavior from **Base UI**
(shadcn's current primitive, not Radix). Install per component as
needed, never upfront.

| Component | Source | Usage |
|---|---|---|
| `Dialog`, `Sheet` | shadcn/Base UI | `LightboxModal` (carousel-aware), per-frame EXIF drawer |
| `DropdownMenu`, `Select` | shadcn/Base UI | sort options, admin filters |
| `Toast`/`Sonner` | shadcn | feedback toasts (upload ok, layout saved, per-frame errors) |
| `Badge` | shadcn | statuses (`Pending` yellow, `Approved` green, `Rejected` red), `SERIES • N`, `Auto-filled from EXIF` |
| `GalleryGrid`, `WorkCard`, `CurationCanvas`, `SeriesCarousel`, `FrameReorderList` | custom (+ dnd-kit where noted) | see [PRD-FE](../specs/PRD-FE.md) §4.2 |

Rules: never style raw HTML for these — always the component (variants
via `cva`-style props); custom components compose primitives, never
reimplement focus/keyboard handling the primitive already provides.

## 3. a11y baseline (WCAG AA, 4 items)

1. **Contrast ≥ 4.5:1 for text.** Orange `#F97316` on near-black MUST pass
   by measurement, not by eye — verify the ratio when implementing §1
   and record it here. `muted-foreground` on `muted` likewise.
2. **Visible focus everywhere.** `--ring` orange ring on all interactive
   elements; never `outline: none` without a replacement.
3. **Don't reimplement what Base UI gives free.** Dialog focus-trap,
   Escape-to-close, arrow-key navigation, toast live-regions come from
   the primitive — custom components (`SeriesCarousel`,
   `CurationCanvas`) MUST wire the equivalent
   keyboard behavior explicitly (documented per component at build time).
4. **Alt text, two tiers.** Informative (work cover):
   curatorial one-liner (title + photographer + frame note). Decorative
   (skeletons, placeholders): empty `alt=""`. EXIF text is data, not alt.

## 4. i18n (Indonesian default, English ready)

- **v1 ships Indonesian only** (`id` default). All UI copy lives in
  typed dictionaries (`lib/i18n/id.ts`, `lib/i18n/en.ts` + `t()` accessor),
  never inline in components — English translates later per page,
  without touching components.
- Language preference persists (stored, default `id`); copy already
  spread across PRD-FE becomes the `id` dictionary at implementation.
- No i18n library in v1 (dictionaries + context suffice); revisit if
  pluralization/routing-per-locale is ever needed.

## 5. Responsive + motion (standards)

- **Breakpoints:** mobile-first; gallery `1 col → 2 → justified`;
  lightbox full-screen on mobile; `/admin/curate` canvas desktop/tablet
  with move up/down fallback on mobile (per [PRD-FE](../specs/PRD-FE.md) §2.3).
- **Images:** plain `<img>` + `loading="lazy"` (`fetchpriority="high"`
  first 4) + responsive `sizes`; blurhash placeholder against CLS (no
  framework optimizer).
- **Motion:** transitions ≤ 200ms ease-out; skeleton shimmer for
  loading grids; `prefers-reduced-motion` disables shimmer/carousel
  autoplay. No other animation without a line in this section.

## 6. Empty / error states (single table)

| Situation | UI | Copy (id) |
|---|---|---|
| No `LIVE` (only `DRAFT`/`PRE_EVENT`) | empty-state grid | `"Pameran berikutnya sedang disiapkan."` |
| Gallery search no hit | empty-state grid | `"Tidak ada karya yang cocok."` |
| Flag off (`series_enabled`, `comments_enabled`) | hidden control / disabled + frozen tooltip | `"Sementara dinonaktifkan"` / frozen notice |
| `ARCHIVED` actions | disabled + tooltip | `"Pameran telah diarsip — hanya lihat"` |
| Upload failure (per frame) | inline error per file + toast | from `details` field errors |
| Login disabled (no OAuth) | disabled provider buttons + banner | `"Login saat ini dinonaktifkan — hanya lihat"` |
| `maintenance_mode` | top banner all routes | `"Pemeliharaan terjadwal — hanya lihat"` |
| 404 work (incl. withdrawn) | not-found page | `"Karya tidak ditemukan."` |
| Blank/ugly display name | fallback render (no new copy) | `trim(name) \|\| email-prefix \|\| "Fotografer"` per [auth-rbac](../features/auth-rbac.md) §2.1 |

API stays English codes (`{code,message?,details?}` wire messages are
developer-facing); user-facing copy above is the only Indonesian surface.

---

## Cross references

- Decision history (palette, component table): [PRD-FE](../specs/PRD-FE.md) §4
- Implementation guide (structure, data flow, guards, tests): [frontend](./frontend.md)
- API error codes consumed by toasts: [PRD-API](../specs/PRD-API.md) §4.0
- States spec source: [PRD-FE](../specs/PRD-FE.md) §2–§3, [engagement](../features/engagement.md) §5
