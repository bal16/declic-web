#!/usr/bin/env bun
/**
 * Boundary gate: enforce ADR-005 modular-monolith rules inside apps/api.
 *
 * Usage:
 *   bun scripts/check-boundaries.ts
 *
 * Rule: a file under apps/api/src/modules/<M>/ may import from another
 * module <N> only via that module's public entry (public-api.ts).
 * Anything else (deep internal imports across modules) is a violation.
 *
 * Exemptions (until the first real module lands, per ADR-005 §2 Rule 5):
 * - files under modules/examples/ are skipped entirely (living skeleton);
 * - imports from src/common/ are always allowed (shared kernel);
 * - *.test.ts files are skipped (tests may stage cross-module fixtures).
 *
 * Prints violations and exits non-zero when any exist.
 * Used by the verify job in CI; run locally anytime.
 */

import { dirname, join, relative, resolve } from 'node:path';

import { Glob } from 'bun';

const API_SRC = 'apps/api/src';
const MODULES_DIR = join(API_SRC, 'modules');
const PUBLIC_API = 'public-api.ts';

interface Violation {
  file: string;
  line: number;
  spec: string;
  target: string;
}

const IMPORT_RE = /(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g;

function moduleOf(absPath: string): string | null {
  const rel = relative(resolve(MODULES_DIR), absPath);
  if (rel.startsWith('..') || rel === '') return null;
  return rel.split('/')[0] ?? null;
}

function resolveSpec(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // bare / aliased imports are out of scope
  const abs = resolve(dirname(fromFile), spec);
  const candidates = [abs, `${abs}.ts`, join(abs, 'index.ts')];
  for (const c of candidates) {
    if (Bun.file(c).size > 0) return c;
  }
  // Dangling spec (deleted file, type-only dir) — leave to typecheck, not this gate.
  return null;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  let scanned = 0;

  const glob = new Glob('modules/**/*.ts');
  for await (const rel of glob.scan({ cwd: API_SRC, onlyFiles: true })) {
    if (rel.endsWith('.test.ts')) continue;
    const fromModule = rel.split('/')[1] ?? '';
    if (fromModule === 'examples') continue; // living skeleton exemption
    const absPath = resolve(API_SRC, rel);
    const text = await Bun.file(absPath).text();
    scanned += 1;

    for (const match of text.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? '';
      const target = resolveSpec(absPath, spec);
      if (!target) continue;
      const targetModule = moduleOf(target);
      if (!targetModule || targetModule === fromModule) continue;
      if (target.endsWith(`/${PUBLIC_API}`)) continue;
      const line = text.slice(0, match.index ?? 0).split('\n').length;
      violations.push({
        file: `${API_SRC}/${rel}`,
        line,
        spec,
        target: relative(process.cwd(), target),
      });
    }
  }

  if (violations.length > 0) {
    console.error(
      `boundary gate failed: ${violations.length} deep cross-module import(s) (see ADR-005 Rule 1 — import via public-api.ts):`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} imports '${v.spec}' -> ${v.target}`);
    }
    process.exit(1);
  }
  console.log(
    `boundary gate passed: ${scanned} file(s) scanned, no deep cross-module imports`,
  );
}

if (import.meta.main) {
  await main();
}
