/**
 * Source hygiene.
 *
 * A NUL byte reached `src/services/switchScanService.js` during this project's
 * 2026-08-08 editing session — inside a template literal, where it was
 * functionally invisible: every test passed, lint passed, and the production
 * bundle built. It would have shipped.
 *
 * Control characters in source are exactly the class of defect that survives
 * every other gate, so they get their own.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['src', 'scripts', 'test', 'functions'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist']);
const EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.json']);

function collect(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collect(path.join(dir, entry.name), out);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const files = [
  ...SCAN_DIRS.flatMap((d) => collect(path.join(ROOT, d))),
  path.join(ROOT, 'App.js'),
  path.join(ROOT, 'index.js'),
  path.join(ROOT, 'firebaseConfig.js'),
].filter((f) => fs.existsSync(f));

describe('source hygiene', () => {
  test('the file list is non-empty (guards against a silently broken walker)', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  test('no source file contains a control character', () => {
    const offenders = [];
    for (const file of files) {
      const bytes = fs.readFileSync(file);
      for (let i = 0; i < bytes.length; i += 1) {
        const b = bytes[i];
        // Allow tab (9), LF (10), CR (13). Everything else below 0x20 is a
        // control character with no business in source.
        if (b < 0x20 && b !== 9 && b !== 10 && b !== 13) {
          offenders.push({
            file: path.relative(ROOT, file).split(path.sep).join('/'),
            offset: i,
            byte: `0x${b.toString(16).padStart(2, '0')}`,
          });
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
