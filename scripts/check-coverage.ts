#!/usr/bin/env bun
/**
 * Coverage gate: every tested app must reach the minimum line coverage.
 *
 * Usage:
 *   bun scripts/check-coverage.ts [--min 90]
 *
 * For each app it runs `bun test --coverage` (lcov reporter), parses the
 * per-line hits itself (DA/FNDA records — no trust in reporter summaries),
 * prints a table and exits non-zero when any app falls below the minimum.
 * Used by the release workflow as a hard gate; run locally anytime.
 */

import { $ } from 'bun';

const APPS = ['apps/api', 'apps/worker', 'apps/web'];
const DEFAULT_MIN = 90;

interface Totals {
  linesFound: number;
  linesHit: number;
  funcsFound: number;
  funcsHit: number;
}

export function parseLcov(text: string): Totals {
  const totals: Totals = {
    linesFound: 0,
    linesHit: 0,
    funcsFound: 0,
    funcsHit: 0,
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('DA:')) {
      const hits = Number(line.slice(3).split(',')[1] ?? 0);
      totals.linesFound += 1;
      if (hits > 0) totals.linesHit += 1;
    } else if (line.startsWith('FNDA:')) {
      const hits = Number(line.slice(5).split(',')[0] ?? 0);
      totals.funcsFound += 1;
      if (hits > 0) totals.funcsHit += 1;
    }
  }
  return totals;
}

function pct(hit: number, found: number): number {
  if (found === 0) return 100;
  return (hit / found) * 100;
}

async function main(): Promise<void> {
  const flagIndex = process.argv.indexOf('--min');
  const min =
    flagIndex !== -1 ? Number(process.argv[flagIndex + 1]) : DEFAULT_MIN;
  if (!Number.isFinite(min) || min < 0 || min > 100) {
    console.error(`error: --min must be a number between 0 and 100`);
    process.exit(2);
  }

  let failed = false;
  for (const app of APPS) {
    // Run inside the app dir so coverage/ lands next to the code it covers.
    await $`bun test --coverage --coverage-reporter=lcov --coverage-reporter=text src/`.cwd(
      app,
    );
    const lcov = await Bun.file(`${app}/coverage/lcov.info`).text();
    const t = parseLcov(lcov);
    const lines = pct(t.linesHit, t.linesFound);
    const funcs = pct(t.funcsHit, t.funcsFound);
    const ok = lines >= min;
    if (!ok) failed = true;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${app}: lines ${lines.toFixed(1)}% ` +
        `(${t.linesHit}/${t.linesFound}), funcs ${funcs.toFixed(1)}% ` +
        `(${t.funcsHit}/${t.funcsFound}) [min ${min}%]`,
    );
  }

  if (failed) {
    console.error(`\ncoverage gate failed: an app is below ${min}% lines`);
    process.exit(1);
  }
  console.log(`\ncoverage gate passed: all apps >= ${min}% lines`);
}

if (import.meta.main) {
  await main();
}
