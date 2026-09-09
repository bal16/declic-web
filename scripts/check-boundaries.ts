#!/usr/bin/env bun
/**
 * Boundary gate: enforce ADR-005 modular-monolith rules.
 *
 * Usage:
 *   bun run boundaries
 *   bun scripts/check-boundaries.ts
 *
 * Rule A — no deep cross-module imports (apps/api):
 *   A file under apps/api/src/modules/<M>/ may import from another
 *   module <N> only via that module's public entry (public-api.ts).
 *   Anything else (deep internal imports across modules) is a violation.
 *
 * Rule B — worker isolation (apps/worker):
 *   Files under apps/worker/src/ must never import from apps/api/src/.
 *   The worker consumes the queue payload only (see ADR-005 Rule 5);
 *   shared code lives in packages/contracts and packages/db.
 *
 * Allowlist (never violations):
 *   - bare / workspace imports (@nestjs/*, zod, @declic/contracts, ...)
 *   - imports resolving outside the modules dir (e.g. packages/*)
 *   - imports into src/common/ (shared kernel)
 *   - *.test.ts files (tests may stage cross-module fixtures)
 *   - files under modules/examples/ (living skeleton, deleted later)
 *
 * Prints violations and exits non-zero when any exist.
 * Used by the pre-commit hook, CI verify, and release verify jobs.
 */

import { dirname, join, relative, resolve } from 'node:path';

import { Glob } from 'bun';

const API_SRC = 'apps/api/src';
const WORKER_SRC = 'apps/worker/src';
const MODULES_DIR = join(API_SRC, 'modules');
const COMMON_DIR = join(API_SRC, 'common');
const PUBLIC_API = 'public-api.ts';

interface Violation {
  file: string;
  line: number;
  spec: string;
  target: string;
  rule: 'A' | 'B';
}

const IMPORT_RE = /(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g;

/**
 * Return the module name (<M>) for an absolute path inside the
 * modules dir, or null when the path lives outside of it.
 */
function moduleOf(absPath: string): string | null {
  const rel = relative(resolve(MODULES_DIR), absPath);
  if (rel.startsWith('..') || rel === '') return null;
  return rel.split('/')[0] ?? null;
}

/** Check whether an absolute path is inside the shared common/ kernel. */
function isCommon(absPath: string): boolean {
  const rel = relative(resolve(COMMON_DIR), absPath);
  return rel !== '' && !rel.startsWith('..');
}

/** Check whether an absolute path is inside apps/api/src/. */
function isApiSrc(absPath: string): boolean {
  const rel = relative(resolve(API_SRC), absPath);
  return rel !== '' && !rel.startsWith('..');
}

/**
 * Resolve an import specifier to an absolute file path.
 * Handles relative specs (./, ../) and the `@/` alias (anchored at the
 * importer's app src — the single sanctioned spelling per ADR-007),
 * and returns null for bare imports or dangling paths.
 * Bare imports (including @declic/* workspace packages) are
 * out of scope — the allowlist permits them without resolution.
 */
function resolveSpec(fromFile: string, spec: string): string | null {
  // Step 1: skip bare / workspace imports (allowlisted by design).
  if (!spec.startsWith('.') && !spec.startsWith('@/')) {
    return null;
  }
  // Step 2: map the @/ alias to a repo-anchored base.
  // The alias root depends on the importer: api files anchor at
  // apps/api/src, worker files anchor at apps/worker/src.
  let anchored = spec;
  if (spec.startsWith('@/')) {
    const base = fromFile.startsWith(resolve(WORKER_SRC))
      ? WORKER_SRC
      : API_SRC;
    anchored = join(base, spec.slice(2));
  } else {
    // Step 3: plain relative import — resolve against the importer dir.
    anchored = resolve(dirname(fromFile), spec);
  }
  // Step 4: probe candidate files (exact, +.ts, /index.ts).
  const abs = resolve(anchored);
  const candidates = [abs, `${abs}.ts`, join(abs, 'index.ts')];
  for (const c of candidates) {
    if (Bun.file(c).size > 0) return c;
  }
  // Step 5: dangling spec (deleted file, type-only dir) — leave to typecheck.
  return null;
}

/** Check whether a relative scan path is a test or skeleton exemption. */
function isExempt(rel: string): boolean {
  if (rel.endsWith('.test.ts')) return true;
  if (rel.split('/')[1] === 'examples') return true;
  return false;
}

/** Scan api modules for Rule A violations (deep cross-module imports). */
async function scanApi(violations: Violation[]): Promise<number> {
  // Step 1: enumerate every TS file under the api modules dir.
  let scanned = 0;
  const glob = new Glob('modules/**/*.ts');
  for await (const rel of glob.scan({ cwd: API_SRC, onlyFiles: true })) {
    // Step 2: skip test fixtures and the living skeleton.
    if (isExempt(rel)) continue;
    const fromModule = rel.split('/')[1] ?? '';
    const absPath = resolve(API_SRC, rel);
    const text = await Bun.file(absPath).text();
    scanned += 1;
    // Step 3: inspect each static import/export specifier.
    for (const match of text.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? '';
      const target = resolveSpec(absPath, spec);
      if (!target) continue;
      // Step 4: imports into common/ or outside modules/ are allowlisted.
      if (isCommon(target)) continue;
      const targetModule = moduleOf(target);
      if (!targetModule || targetModule === fromModule) continue;
      // Step 5: the only legal cross-module edge is via public-api.ts.
      if (target.endsWith(`/${PUBLIC_API}`)) continue;
      const line = text.slice(0, match.index ?? 0).split('\n').length;
      violations.push({
        file: `${API_SRC}/${rel}`,
        line,
        spec,
        target: relative(process.cwd(), target),
        rule: 'A',
      });
    }
  }
  return scanned;
}

/** Scan worker sources for Rule B violations (worker -> api imports). */
async function scanWorker(violations: Violation[]): Promise<number> {
  // Step 1: enumerate every TS file under the worker src dir.
  let scanned = 0;
  const glob = new Glob('**/*.ts');
  for await (const rel of glob.scan({ cwd: WORKER_SRC, onlyFiles: true })) {
    // Step 2: skip test fixtures (may reference api types as fixtures).
    if (rel.endsWith('.test.ts')) continue;
    const absPath = resolve(WORKER_SRC, rel);
    const text = await Bun.file(absPath).text();
    scanned += 1;
    // Step 3: any resolved import landing in apps/api/src/ is a violation.
    for (const match of text.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? '';
      const target = resolveSpec(absPath, spec);
      if (!target) continue;
      if (!isApiSrc(target)) continue;
      const line = text.slice(0, match.index ?? 0).split('\n').length;
      violations.push({
        file: `${WORKER_SRC}/${rel}`,
        line,
        spec,
        target: relative(process.cwd(), target),
        rule: 'B',
      });
    }
  }
  return scanned;
}

async function main(): Promise<void> {
  // Step 1: run both scanners and collect violations.
  const violations: Violation[] = [];
  const apiScanned = await scanApi(violations);
  const workerScanned = await scanWorker(violations);
  // Step 2: report failures with actionable rule references.
  if (violations.length > 0) {
    console.error(`boundary gate failed: ${violations.length} violation(s):`);
    for (const v of violations) {
      const hint =
        v.rule === 'A'
          ? 'import via public-api.ts (ADR-005 Rule 1)'
          : 'worker must not import apps/api (ADR-005 Rule 5)';
      console.error(
        `  [Rule ${v.rule}] ${v.file}:${v.line} imports '${v.spec}' -> ${v.target} (${hint})`,
      );
    }
    process.exit(1);
  }
  // Step 3: report the passing scan scope for CI logs.
  console.log(
    `boundary gate passed: ${apiScanned} api file(s) + ${workerScanned} worker file(s) scanned, no violations`,
  );
}

if (import.meta.main) {
  await main();
}
