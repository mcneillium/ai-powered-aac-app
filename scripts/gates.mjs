#!/usr/bin/env node
/**
 * gates.mjs — the single quality gate for this repo.
 *
 * Node rather than a shell script so it behaves identically on Paul's Windows
 * machine, on an EAS/Linux container, and in GitHub Actions.
 *
 * Several gates were already failing when this was written (expo-doctor version
 * drift, npm peer-dependency conflicts inside @tensorflow/tfjs-react-native).
 * Gating those on "green" would mean gating on work nobody has scheduled, so
 * they are gated on **not getting worse** against scripts/gates.baseline.json.
 * The gates that matter most — bundle and import-case — are absolute.
 *
 * Usage:
 *   node scripts/gates.mjs                 # everything
 *   node scripts/gates.mjs --fast          # skip bundle + expo-doctor (~40s vs ~3min)
 *   node scripts/gates.mjs --only=lint,test
 *   node scripts/gates.mjs --skip=bundle
 *   node scripts/gates.mjs --json          # machine-readable only
 *   node scripts/gates.mjs --write-baseline
 *
 * Exit 0 = every selected gate passed (or was skipped). Exit 1 = at least one failed.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'gates.baseline.json');
const LOG_DIR = process.env.GATES_LOG_DIR
  ? path.resolve(process.env.GATES_LOG_DIR)
  : path.join(ROOT, '.claude', 'overnight', 'logs');

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const JSON_ONLY = has('--json');
const WRITE_BASELINE = has('--write-baseline');
const only = valueOf('only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
const skip = new Set((valueOf('skip')?.split(',') ?? []).map((s) => s.trim()).filter(Boolean));
if (has('--fast')) {
  skip.add('bundle');
  skip.add('expo-doctor');
}
const LABEL = valueOf('label') ?? 'adhoc';

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

fs.mkdirSync(LOG_DIR, { recursive: true });

const say = (...args) => {
  if (!JSON_ONLY) console.log(...args);
};

let logSeq = 0;
function run(command, args, { cwd = ROOT, timeoutMs = 300_000, logName } = {}) {
  logSeq += 1;
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const file = path.join(LOG_DIR, `gate-${LABEL}-${logSeq}-${logName ?? command}.log`);
  try {
    fs.writeFileSync(
      file,
      `$ ${command} ${args.join(' ')}\ncwd=${cwd}\nexit=${result.status}\nsignal=${result.signal}\nms=${Date.now() - started}\n\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}\n`,
    );
  } catch {
    /* logging must never fail a gate */
  }
  return {
    status: result.status,
    stdout,
    stderr,
    timedOut: result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM',
    ms: Date.now() - started,
    log: path.relative(ROOT, file).split(path.sep).join('/'),
  };
}

/** Each gate returns { status: 'pass'|'fail'|'skip', detail, metrics? }. */
const GATES = [
  {
    id: 'typecheck',
    title: 'tsc --noEmit',
    run() {
      if (!fs.existsSync(path.join(ROOT, 'tsconfig.json'))) {
        return { status: 'skip', detail: 'no tsconfig.json' };
      }
      const r = run('npx', ['tsc', '--noEmit'], { logName: 'tsc' });
      return r.status === 0
        ? { status: 'pass', detail: 'no type errors' }
        : { status: 'fail', detail: `tsc exited ${r.status}`, log: r.log };
    },
  },

  {
    id: 'lint',
    title: 'eslint (errors=0, warnings <= baseline)',
    run() {
      const out = path.join(LOG_DIR, 'eslint-report.json');
      const r = run('npx', ['eslint', '.', '--ext', '.js,.jsx', '-f', 'json', '-o', out], {
        logName: 'eslint',
      });
      let errors = 0;
      let warnings = 0;
      try {
        for (const f of JSON.parse(fs.readFileSync(out, 'utf8'))) {
          errors += f.errorCount;
          warnings += f.warningCount;
        }
      } catch {
        return { status: 'fail', detail: 'could not parse eslint report', log: r.log };
      }
      const metrics = { errors, warnings };
      if (errors > baseline.lint.errors) {
        return { status: 'fail', detail: `${errors} errors (baseline ${baseline.lint.errors})`, metrics, log: r.log };
      }
      if (warnings > baseline.lint.warnings) {
        return {
          status: 'fail',
          detail: `${warnings} warnings, up from baseline ${baseline.lint.warnings}`,
          metrics,
          log: r.log,
        };
      }
      return {
        status: 'pass',
        detail: `${errors} errors, ${warnings} warnings (baseline ${baseline.lint.warnings})`,
        metrics,
      };
    },
  },

  {
    id: 'test',
    title: 'jest (all pass, count >= baseline)',
    run() {
      const r = run('npx', ['jest', '--ci', '--silent'], { logName: 'jest', timeoutMs: 600_000 });
      const blob = `${r.stdout}\n${r.stderr}`;
      const suites = /Test Suites:.*?(\d+) total/.exec(blob);
      const tests = /Tests:.*?(\d+) total/.exec(blob);
      const failed = /Tests:.*?(\d+) failed/.exec(blob);
      const metrics = {
        suites: suites ? Number(suites[1]) : null,
        tests: tests ? Number(tests[1]) : null,
        failed: failed ? Number(failed[1]) : 0,
      };
      if (r.status !== 0) {
        return { status: 'fail', detail: `jest exited ${r.status}, ${metrics.failed} failing`, metrics, log: r.log };
      }
      if (metrics.tests !== null && metrics.tests < baseline.test.tests) {
        return {
          status: 'fail',
          detail: `${metrics.tests} tests, fewer than baseline ${baseline.test.tests} — tests were removed or skipped`,
          metrics,
          log: r.log,
        };
      }
      return { status: 'pass', detail: `${metrics.suites} suites, ${metrics.tests} tests`, metrics };
    },
  },

  {
    id: 'rules',
    title: 'firebase rules tests (emulator)',
    run() {
      const dir = path.join(ROOT, 'test', 'rules');
      if (!fs.existsSync(dir)) {
        return { status: 'skip', detail: 'test/rules/ not present' };
      }
      const r = run('npm', ['run', '--silent', 'test:rules'], { logName: 'rules', timeoutMs: 600_000 });
      return r.status === 0
        ? { status: 'pass', detail: 'rules suite green' }
        : { status: 'fail', detail: `rules suite exited ${r.status} (is the emulator installed?)`, log: r.log };
    },
  },

  {
    id: 'import-case',
    title: 'import case + resolution (absolute gate)',
    run() {
      const r = run('node', ['scripts/check-import-case.mjs', '.'], { logName: 'import-case' });
      return r.status === 0
        ? { status: 'pass', detail: r.stdout.trim().split('\n').pop() ?? 'clean' }
        : { status: 'fail', detail: 'unresolvable or mis-cased relative imports — this is the versionCode 19 failure class', log: r.log };
    },
  },

  {
    id: 'expo-doctor',
    title: 'expo-doctor (no new failing checks)',
    run() {
      const r = run('npx', ['expo-doctor'], { logName: 'expo-doctor', timeoutMs: 600_000 });
      const m = /(\d+) checks? failed/.exec(`${r.stdout}${r.stderr}`);
      const failedChecks = m ? Number(m[1]) : r.status === 0 ? 0 : 1;
      const metrics = { failedChecks };
      if (failedChecks > baseline.expoDoctor.failedChecks) {
        return {
          status: 'fail',
          detail: `${failedChecks} failing checks, up from baseline ${baseline.expoDoctor.failedChecks}`,
          metrics,
          log: r.log,
        };
      }
      return {
        status: 'pass',
        detail: `${failedChecks} failing checks (baseline ${baseline.expoDoctor.failedChecks})`,
        metrics,
      };
    },
  },

  {
    id: 'bundle',
    title: 'production Metro bundle (absolute gate)',
    run() {
      const outDir = path.join(ROOT, '.metro-smoke');
      fs.rmSync(outDir, { recursive: true, force: true });
      const r = run(
        'npx',
        ['expo', 'export', '--platform', 'android', '--output-dir', '.metro-smoke', '--clear'],
        { logName: 'bundle', timeoutMs: 1_200_000 },
      );
      if (r.status !== 0) {
        const why = /Unable to resolve module[^\n]*/.exec(`${r.stdout}${r.stderr}`);
        return {
          status: 'fail',
          detail: why ? why[0].slice(0, 200) : `expo export exited ${r.status}`,
          log: r.log,
        };
      }
      let bytes = 0;
      const jsDir = path.join(outDir, '_expo', 'static', 'js', 'android');
      try {
        for (const f of fs.readdirSync(jsDir)) bytes += fs.statSync(path.join(jsDir, f)).size;
      } catch {
        return { status: 'fail', detail: 'export succeeded but produced no android bundle', log: r.log };
      }
      const base = baseline.bundle.androidBytes;
      const deltaPct = base ? ((bytes - base) / base) * 100 : 0;
      const metrics = { androidBytes: bytes, deltaPct: Number(deltaPct.toFixed(2)) };
      const note = base
        ? `${(bytes / 1e6).toFixed(2)} MB (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}% vs baseline)`
        : `${(bytes / 1e6).toFixed(2)} MB`;
      // Size is reported, never enforced: an accessibility feature that costs
      // 6% of bundle is a trade Paul should make, not one a gate should veto.
      return { status: 'pass', detail: note, metrics };
    },
  },

  {
    id: 'tree',
    title: 'npm ls --all (no new invalid resolutions)',
    run() {
      const r = run('npm', ['ls', '--all'], { logName: 'npm-ls', timeoutMs: 300_000 });
      const invalid = (`${r.stdout}\n${r.stderr}`.match(/^npm error invalid:/gm) ?? []).length;
      const metrics = { invalidCount: invalid };
      if (invalid > baseline.npmLs.invalidCount) {
        return {
          status: 'fail',
          detail: `${invalid} invalid resolutions, up from baseline ${baseline.npmLs.invalidCount}`,
          metrics,
          log: r.log,
        };
      }
      return {
        status: 'pass',
        detail: `${invalid} invalid resolutions (baseline ${baseline.npmLs.invalidCount})`,
        metrics,
      };
    },
  },
];

const selected = GATES.filter((g) => (only ? only.includes(g.id) : true) && !skip.has(g.id));
const results = [];

say(`\ngates: ${selected.length} selected  (logs → ${path.relative(ROOT, LOG_DIR).split(path.sep).join('/')})\n`);

for (const gate of selected) {
  const started = Date.now();
  let outcome;
  try {
    outcome = gate.run();
  } catch (err) {
    outcome = { status: 'fail', detail: `gate threw: ${err?.message ?? err}` };
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  results.push({ id: gate.id, title: gate.title, seconds: Number(seconds), ...outcome });
  const mark = outcome.status === 'pass' ? 'PASS' : outcome.status === 'skip' ? 'SKIP' : 'FAIL';
  say(`  ${mark.padEnd(4)}  ${gate.id.padEnd(12)} ${outcome.detail ?? ''}  (${seconds}s)`);
}

const failed = results.filter((r) => r.status === 'fail');
const summary = {
  ok: failed.length === 0,
  label: LABEL,
  passed: results.filter((r) => r.status === 'pass').length,
  failed: failed.length,
  skipped: results.filter((r) => r.status === 'skip').length,
  gates: results,
};

if (WRITE_BASELINE) {
  const next = { ...baseline };
  for (const r of results) {
    if (r.status === 'skip' || !r.metrics) continue;
    if (r.id === 'lint') next.lint = r.metrics;
    if (r.id === 'test') next.test = r.metrics;
    if (r.id === 'expo-doctor') next.expoDoctor = r.metrics;
    if (r.id === 'tree') next.npmLs = r.metrics;
    if (r.id === 'bundle') next.bundle = { androidBytes: r.metrics.androidBytes };
  }
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  say('\nbaseline rewritten.');
}

const summaryPath = path.join(LOG_DIR, `gates-${LABEL}.json`);
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

if (JSON_ONLY) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  say(`\n${summary.ok ? 'GATES GREEN' : 'GATES RED'} — ${summary.passed} pass, ${summary.failed} fail, ${summary.skipped} skip`);
  if (failed.length) {
    say('failing gates:');
    for (const f of failed) say(`  - ${f.id}: ${f.detail}${f.log ? `  → ${f.log}` : ''}`);
  }
  say(`summary → ${path.relative(ROOT, summaryPath).split(path.sep).join('/')}\n`);
}

process.exit(summary.ok ? 0 : 1);
