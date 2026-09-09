#!/usr/bin/env bun
/**
 * Sync non-markdown source files into their Obsidian-readable companion
 * notes (docs/*.md). Obsidian only renders `.md` as notes — `.yml`, `.ts`
 * and extensionless example files cannot be opened in the vault — so each
 * companion embeds a fenced mirror of its source between markers:
 *
 *   <!-- sync:<key> start -->
 *   ...generated — do not edit, run `bun scripts/sync-docs-mirrors.ts`...
 *   <!-- sync:<key> end -->
 *
 * Usage:
 *   bun scripts/sync-docs-mirrors.ts [--check]
 *
 * With --check, exits non-zero when any mirror is stale (CI-friendly).
 * Edit the SOURCE file, never the fenced block.
 */

/** One source file mirrored into the fenced block of a companion note. */
interface Mirror {
  key: string;
  src: string;
  dst: string;
  lang: string;
}

const MIRRORS: Mirror[] = [
  {
    key: 'compose',
    src: 'docs/docker-compose.yml',
    dst: 'docs/docker-compose.md',
    lang: 'yaml',
  },
  { key: 'seed', src: 'docs/seed.ts', dst: 'docs/seeds.md', lang: 'ts' },
  // Single source: root .env.example is what runtimes read (Compose,
  // bun --env-file, Vite envDir); docs/env.md only mirrors it for
  // Obsidian readability (decision 9a, audit 2026-09-08).
  { key: 'env', src: '.env.example', dst: 'docs/env.md', lang: 'bash' },
];

/** Wrap source text in a fenced code block for the companion note. */
function buildBlock(m: Mirror, content: string): string {
  return [`\`\`\`${m.lang}`, content.trimEnd(), '```'].join('\n');
}

/** CLI entry: sync every mirror, or report staleness with --check. */
async function main(): Promise<void> {
  // Step 1: detect check-only mode (CI-friendly, writes nothing).
  const checkOnly = process.argv.includes('--check');
  let stale = false;

  // Step 2: reconcile each mirror source with its companion note.
  for (const m of MIRRORS) {
    const src = (await Bun.file(m.src).text()).replace(/\r\n/g, '\n');
    const dstFile = Bun.file(m.dst);
    if (!(await dstFile.exists())) {
      console.error(`missing companion note: ${m.dst} (source: ${m.src})`);
      process.exit(2);
    }
    const dst = (await dstFile.text()).replace(/\r\n/g, '\n');
    const start = `<!-- sync:${m.key} start -->`;
    const end = `<!-- sync:${m.key} end -->`;
    const si = dst.indexOf(start);
    const ei = dst.indexOf(end);
    if (si === -1 || ei === -1 || ei < si) {
      console.error(`missing markers ${start} / ${end} in ${m.dst}`);
      process.exit(2);
    }
    const before = dst.slice(0, si + start.length);
    const after = dst.slice(ei);
    const next = `${before}\n${buildBlock(m, src)}\n${after}`;
    if (next === dst) {
      console.log(`ok: ${m.dst} in sync with ${m.src}`);
      continue;
    }
    stale = true;
    if (checkOnly) {
      console.error(
        `stale: ${m.dst} differs from ${m.src} (run without --check to sync)`,
      );
      continue;
    }
    await Bun.write(m.dst, next.endsWith('\n') ? next : `${next}\n`);
    console.log(`synced: ${m.src} -> ${m.dst}`);
  }

  // Step 3: fail when any mirror was stale in check-only mode.
  if (stale && checkOnly) process.exit(1);
}

if (import.meta.main) {
  await main();
}
