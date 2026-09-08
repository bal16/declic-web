#!/usr/bin/env bun
/**
 * Materialize the root docker-compose.yml body from the spec
 * (docs/docker-compose.yml). The root file keeps its own header;
 * everything from the `services:` line on is copied from the spec,
 * then normalized with oxfmt (single quotes, canonical whitespace).
 *
 * Usage:
 *   bun run sync:compose          # write the materialized root file
 *   bun run sync:compose --check  # alias: bun scripts/sync-compose.ts --check
 *
 * With --check, exits non-zero when the root body differs from the
 * spec (CI-friendly). Edit the SPEC, never the root body — the root
 * header is the only part owned by the root file.
 */

import { $ } from 'bun';

const SPEC = 'docs/docker-compose.yml';
const ROOT = 'docker-compose.yml';
// Hidden temp file inside the repo so oxfmt picks up .oxfmtrc.jsonc.
const TMP = '.compose-materialized.tmp.yml';
const MARKER = '\nservices:';

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

/** Split a compose file into header (owned locally) and body (from spec). */
function splitBody(
  text: string,
  label: string,
): { header: string; body: string } {
  const i = text.indexOf(MARKER);
  if (i === -1) fail(`missing '${MARKER.trim()}' line in ${label}`);
  return { header: text.slice(0, i), body: text.slice(i + 1) };
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  // Step 1: compose the candidate (root header + spec body).
  const spec = (await Bun.file(SPEC).text()).replace(/\r\n/g, '\n');
  const root = (await Bun.file(ROOT).text()).replace(/\r\n/g, '\n');
  const candidate =
    splitBody(root, ROOT).header + '\n' + splitBody(spec, SPEC).body;
  // Step 2: normalize through oxfmt via a repo-local temp file.
  await Bun.write(TMP, candidate.endsWith('\n') ? candidate : `${candidate}\n`);
  await $`bunx oxfmt ${TMP}`
    .quiet()
    .catch(() => fail(`oxfmt failed on ${TMP}`));
  const formatted = await Bun.file(TMP).text();
  await Bun.file(TMP).unlink();
  // Step 3: compare against (check) or write to (sync) the root file.
  if (formatted === root) {
    console.log(`ok: ${ROOT} body in sync with ${SPEC}`);
    return;
  }
  if (checkOnly) {
    console.error(
      `stale: ${ROOT} body differs from ${SPEC} (run without --check to sync)`,
    );
    process.exit(1);
  }
  await Bun.write(ROOT, formatted);
  console.log(`synced: ${SPEC} -> ${ROOT} (body only, header preserved)`);
}

if (import.meta.main) {
  await main();
}
