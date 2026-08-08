#!/usr/bin/env node
/**
 * rules-test.mjs — run the security-rules suite against the Firebase emulator.
 *
 * `firebase emulators:exec` starts the emulator, runs the command, and tears
 * the emulator down again, so there is no stray process to clean up if a test
 * throws.
 *
 * The emulator is a Java program. If there is no JDK on the machine this script
 * says so precisely and exits 2, which the gate suite reports as a skip rather
 * than a failure — "these tests could not run" and "these tests failed" are
 * different facts and must not be collapsed into one.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const java = spawnSync('java', ['-version'], { encoding: 'utf8', shell: process.platform === 'win32' });
if (java.error || java.status !== 0) {
  process.stderr.write(
    'rules-test: no Java runtime found, so the Firebase emulator cannot start.\n' +
      '\n' +
      'The rules suite in test/rules/ is written and checked in; it has simply never\n' +
      'been executed. Install a JDK 17+ and re-run:\n' +
      '\n' +
      '  winget install --id EclipseAdoptium.Temurin.17.JDK\n' +
      '  npm run test:rules\n' +
      '\n' +
      'Until then, database.rules.json is covered only by the static structural\n' +
      'checks in src/__tests__/databaseRules.static.test.js, which verify shape and\n' +
      'coverage but cannot verify behaviour.\n',
  );
  process.exit(2);
}

const result = spawnSync(
  'npx',
  [
    'firebase',
    'emulators:exec',
    '--only',
    'database',
    '--project',
    'commai-rules-test',
    // Quoted as one argument: with `shell: true` on Windows an unquoted string
    // is re-split by cmd, and `--ci` ends up being parsed by the firebase CLI.
    '"npx jest --config test/rules/jest.config.js --ci"',
  ],
  { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', timeout: 900_000 },
);

process.exit(result.status ?? 1);
