#!/usr/bin/env node
/**
 * preflight.mjs — "would this survive an EAS build?"
 *
 * versionCode 19 failed at Metro bundling on EAS while every local check was
 * green. The root cause (see docs/release/metro-bundling-postmortem.md) was an
 * import of a module that did not exist — invisible to lint, invisible to jest,
 * and only fatal once Metro walks the production module graph.
 *
 * This script is the cheap local stand-in for that 20-minute round trip. It
 * reproduces the container's install (`npm ci`, not `npm install`), then runs
 * the two checks that would have caught the failure.
 *
 * NOT wired to a git hook on purpose — `npm ci` blows away node_modules, which
 * is far too intrusive to run behind Paul's back on every commit. Opt in:
 *
 *   node scripts/preflight.mjs              # full: npm ci + checks + bundle
 *   node scripts/preflight.mjs --no-install # skip npm ci (fast, ~2 min)
 *
 * Exit 0 = an EAS production bundle should succeed.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_INSTALL = process.argv.includes('--no-install');

function step(label, command, args, timeoutMs) {
  process.stdout.write(`\n── ${label}\n   $ ${command} ${args.join(' ')}\n`);
  const started = Date.now();
  const r = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    timeout: timeoutMs,
    env: { ...process.env, CI: '1' },
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  if (r.status !== 0) {
    process.stdout.write(`\n   FAILED after ${seconds}s (exit ${r.status})\n`);
    return false;
  }
  process.stdout.write(`   ok (${seconds}s)\n`);
  return true;
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
let easNode = null;
try {
  easNode = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'))?.build?.production?.node ?? null;
} catch {
  /* eas.json is optional for this check */
}
if (easNode) {
  const easMajor = Number(easNode.split('.')[0]);
  if (easMajor !== nodeMajor) {
    process.stdout.write(
      `\n!  Node major mismatch: local v${process.versions.node}, eas.json production pins ${easNode}.\n` +
        `   Preflight still catches resolution and syntax failures, but a Node-version-specific\n` +
        `   failure will only show up on EAS. Consider matching locally before a release build.\n`,
    );
  }
}

if (!SKIP_INSTALL) {
  fs.rmSync(path.join(ROOT, 'node_modules'), { recursive: true, force: true });
  if (!step('clean install exactly as the build container does', 'npm', ['ci'], 1_800_000)) process.exit(1);
}

if (!step('import case + resolution sweep (Linux-safe)', 'node', ['scripts/check-import-case.mjs', '.'], 120_000)) {
  process.stdout.write(
    '\nThis is the versionCode 19 failure class. Every violation above resolves on a\n' +
      'case-insensitive Windows filesystem and fails inside the EAS Linux container.\n',
  );
  process.exit(1);
}

if (!step('gates: typecheck, lint, tests, tree', 'node', ['scripts/gates.mjs', '--skip=bundle,expo-doctor', '--label=preflight'], 900_000)) {
  process.exit(1);
}

fs.rmSync(path.join(ROOT, '.metro-smoke'), { recursive: true, force: true });
if (!step(
  'production Metro bundle to disk',
  'npx',
  ['expo', 'export', '--platform', 'android', '--output-dir', '.metro-smoke', '--clear'],
  1_800_000,
)) {
  process.exit(1);
}

// The bundle exists — now check it is a bundle that can actually reach Firebase.
// EXPO_PUBLIC_* values are inlined at build time, so a build environment without
// them produces an app that throws in getDatabase() at module scope. That is a
// crash on launch, and it is only visible by looking inside the artefact.
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const jsDir = path.join(ROOT, '.metro-smoke', '_expo', 'static', 'js', 'android');
let inlined = false;
try {
  for (const f of fs.readdirSync(jsDir)) {
    const blob = fs.readFileSync(path.join(jsDir, f), 'latin1');
    if (/firebasedatabase\.app|firebaseio\.com/.test(blob) && (!projectId || blob.includes(projectId))) {
      inlined = true;
      break;
    }
  }
} catch {
  /* handled below */
}
if (!inlined) {
  process.stdout.write(
    '\n── FAILED: the bundle contains no resolved Firebase config.\n' +
      '   EXPO_PUBLIC_FIREBASE_* were not set when Metro ran, so the shipped app would\n' +
      '   initialise Firebase with undefined values and crash on launch.\n' +
      '   Locally: copy .env.example to .env and fill it in.\n' +
      '   On EAS:  npx eas env:list  — the production environment needs every key.\n\n',
  );
  process.exit(1);
}
process.stdout.write('   ok — Firebase config is inlined in the bundle\n');

process.stdout.write('\nPREFLIGHT GREEN — safe to spend EAS build minutes.\n');
process.stdout.write('   npx eas build --profile production --platform android\n\n');
