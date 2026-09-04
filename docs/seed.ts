/**
 * Seed — Déclic (PRD 0.4-draft)
 * Source of truth for initial data referenced by PRD-API §2.9 and db-schema §1.
 * Run: `bun docs/seed.ts` (idempotent, ON CONFLICT DO NOTHING) — or `bun run seed` via apps/api.
 *
 * Tables:
 * - feature_flags (row-per-flag, key PK, enabled bool)
 * - site_settings (singleton id=1, typed)
 * - exhibitions (latest + archive example)
 *
 * IDs: cuid2 for domain tables (posts/photo_items/...), uuid/text for users (Better Auth).
 */

import { createId } from '@paralleldrive/cuid2';

// ── Feature flags (row-per-flag, scalable: add flag via INSERT, no migration) ──
export const featureFlagsSeed = [
  {
    key: 'series_enabled' as const,
    enabled: true,
    description: 'Kill-switch SERIES creation. When false, POST /api/posts type=SERIES → 403 FEATURE_DISABLED',
  },
  {
    key: 'threaded_comments_enabled' as const,
    enabled: false,
    description: 'When false, POST /api/posts/:id/comments with parentId → 400. UI flat',
  },
] as const;

// ── Site settings — singleton id=1, global wide limits (not flags) ──
export const siteSettingsSeed = {
  id: 1 as const,
  site_title: 'Déclic — Pameran UKM CLIC UNNES',
  site_description: 'Momen yang diabadikan',
  max_series_size: 10 as const, // CHECK 1..20, grandfathering: old SERIES with 10 remain valid if later lowered to 5
  maintenance_mode: false as const,
  contact_email: null as string | null,
  instagram_url: null as string | null,
} as const;

// ── Exhibitions — root "/" = latest by start_date DESC ──
export const exhibitionsSeed = [
  {
    id: createId(),
    title: 'Déclic 2026',
    slug: 'declic-2026',
    description: 'Pameran perdana Déclic — CLIC UNNES',
    phase: 'PRE_EVENT' as const, // PRE_EVENT | LIVE | ARCHIVED | DRAFT
    location: 'Gedung CLIC UNNES',
    poster_s3_key: null as string | null,
    start_date: new Date('2026-09-01T00:00:00Z'),
    end_date: new Date('2026-09-30T23:59:59Z'), // cron LIVE→ARCHIVED when end_date <= now()
  },
] as const;

// ── Example run (Drizzle / SQL) — idempotent ──
// await db.insert(featureFlags).values(featureFlagsSeed).onConflictDoNothing({ target: featureFlags.key });
// await db.insert(siteSettings).values(siteSettingsSeed).onConflictDoNothing({ target: siteSettings.id });
// await db.insert(exhibitions).values(exhibitionsSeed).onConflictDoNothing({ target: exhibitions.slug });

// Caching: both tables are tiny (2 + 1 rows) — cache in-memory 10s TTL + invalidate on PATCH.
// See PRD-API §2.9 / §4.6 and db-schema §1 for cache + invalidation details.
