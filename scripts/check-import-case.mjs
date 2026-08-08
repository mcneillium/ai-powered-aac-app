#!/usr/bin/env node
/**
 * check-import-case.mjs
 *
 * Windows/macOS filesystems are case-insensitive. EAS (and any Linux CI) is not.
 * An import written as `./Services/speechService` resolves fine on Paul's machine
 * and fails at Metro bundle time in the build container. That failure mode is
 * invisible locally by construction, so we assert it explicitly.
 *
 * For every relative import/require in the tree we:
 *   1. resolve it the way Metro would (extension + /index probing, platform variants)
 *   2. compare every path segment against the *actual* on-disk casing
 *   3. flag unresolvable specifiers, directory imports with no index file, and
 *      dynamic `require(a + b)` calls Metro cannot statically resolve
 *
 * Usage:  node scripts/check-import-case.mjs [rootDir ...]
 * Exit:   0 = clean, 1 = violations found
 */

import fs from 'node:fs';
import path from 'node:path';

const SOURCE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'];
// Metro probes platform-specific variants before the bare extension.
const PLATFORM_PREFIXES = ['.android', '.ios', '.native', ''];
const SCAN_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.expo', 'dist', 'web-build', 'coverage',
  '.metro-smoke', 'android', 'ios', 'build', '.firebase', '.claude',
]);

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('.');

/** Cache of dir -> Set of real entry names, so we stat each directory once. */
const dirCache = new Map();
function readDirEntries(dir) {
  let entries = dirCache.get(dir);
  if (entries === undefined) {
    try {
      entries = new Set(fs.readdirSync(dir));
    } catch {
      entries = null;
    }
    dirCache.set(dir, entries);
  }
  return entries;
}

/**
 * Returns null when every segment of `absPath` matches on-disk casing exactly,
 * otherwise the corrected path as it actually exists on disk.
 */
function realCasing(absPath) {
  const parsed = path.parse(path.resolve(absPath));
  const segments = path.resolve(absPath).slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  let drifted = false;

  for (const segment of segments) {
    const entries = readDirEntries(current);
    if (!entries) return null; // parent unreadable — caller already handles missing files
    if (entries.has(segment)) {
      current = path.join(current, segment);
      continue;
    }
    const match = [...entries].find((e) => e.toLowerCase() === segment.toLowerCase());
    if (!match) return null; // does not exist in any casing
    drifted = true;
    current = path.join(current, match);
  }
  return drifted ? current : null;
}

function existsCaseInsensitive(absPath) {
  try {
    return fs.existsSync(absPath);
  } catch {
    return false;
  }
}

/**
 * Metro-ish resolution for a relative specifier. Returns
 * { file } on success, or { error } describing why not.
 */
function resolveRelative(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);

  // 1. exact file (specifier already carries an extension)
  if (existsCaseInsensitive(base) && fs.statSync(base).isFile()) return { file: base };

  // 2. base + [.platform] + ext
  for (const platform of PLATFORM_PREFIXES) {
    for (const ext of SOURCE_EXTS) {
      const candidate = base + platform + ext;
      if (existsCaseInsensitive(candidate) && fs.statSync(candidate).isFile()) {
        return { file: candidate };
      }
    }
  }

  // 3. directory with an index file
  if (existsCaseInsensitive(base) && fs.statSync(base).isDirectory()) {
    for (const platform of PLATFORM_PREFIXES) {
      for (const ext of SOURCE_EXTS) {
        const candidate = path.join(base, `index${platform}${ext}`);
        if (existsCaseInsensitive(candidate)) return { file: candidate };
      }
    }
    return { error: 'directory-without-index' };
  }

  return { error: 'unresolved' };
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (SCAN_EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
}

// Deliberately line-based rather than AST-based: no parser dependency, and a
// false positive here is cheap while a missed mismatch costs a 20-minute EAS build.
const STATIC_IMPORT = /(?:^|[^\w$.])(?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
const BARE_IMPORT = /(?:^|[^\w$.])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_LITERAL = /(?:^|[^\w$.])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_DYNAMIC = /(?:^|[^\w$.])require\s*\(\s*(?!['"])[^)]*\)/g;

/**
 * Blanks out comments, template literals and regex-looking spans, preserving
 * length and newlines so line numbers stay exact. Without this, a comment that
 * merely *mentions* `require(a + b)` is reported as a dynamic require.
 */
function maskNonCode(source) {
  const out = source.split('');
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i += 1) {
      if (out[i] !== '\n') out[i] = ' ';
    }
  };
  let i = 0;
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (two === '//') {
      const end = source.indexOf('\n', i);
      blank(i, end === -1 ? source.length : end);
      i = end === -1 ? source.length : end;
    } else if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (source[i] === '`') {
      let j = i + 1;
      while (j < source.length && !(source[j] === '`' && source[j - 1] !== '\\')) j += 1;
      blank(i, j + 1);
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return out.join('');
}

function specifiersIn(source) {
  const found = new Set();
  for (const re of [STATIC_IMPORT, BARE_IMPORT, REQUIRE_LITERAL]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) found.add(m[1]);
  }
  return [...found];
}

function lineOf(source, specifier) {
  const idx = source.indexOf(specifier);
  if (idx < 0) return 1;
  return source.slice(0, idx).split('\n').length;
}

const files = [];
for (const root of roots) walk(path.resolve(root), files);

const violations = [];
let checked = 0;

for (const file of files) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const source = maskNonCode(raw);

  REQUIRE_DYNAMIC.lastIndex = 0;
  let dyn;
  while ((dyn = REQUIRE_DYNAMIC.exec(source)) !== null) {
    const snippet = dyn[0].trim();
    // `require(someModule)` inside a comment or a re-export helper is noise; only
    // flag ones that look like a built path, which is what Metro chokes on.
    if (/[+`$]/.test(snippet)) {
      violations.push({
        kind: 'dynamic-require',
        file,
        line: source.slice(0, dyn.index).split('\n').length,
        specifier: snippet,
        detail: 'Metro cannot statically resolve a concatenated require path.',
      });
    }
  }

  for (const specifier of specifiersIn(source)) {
    if (!specifier.startsWith('.')) continue; // package specifiers are out of scope
    checked += 1;
    const resolved = resolveRelative(file, specifier);
    if (resolved.error) {
      violations.push({
        kind: resolved.error,
        file,
        line: lineOf(source, specifier),
        specifier,
        detail:
          resolved.error === 'directory-without-index'
            ? 'Resolves to a directory with no index file.'
            : 'Does not resolve to any file on disk.',
      });
      continue;
    }
    const corrected = realCasing(resolved.file);
    if (corrected) {
      violations.push({
        kind: 'case-mismatch',
        file,
        line: lineOf(source, specifier),
        specifier,
        detail: `On disk it is "${path.relative(process.cwd(), corrected).split(path.sep).join('/')}". This resolves on Windows and fails on Linux/EAS.`,
      });
    }
  }
}

const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/');

if (violations.length === 0) {
  console.log(`check-import-case: OK — ${checked} relative specifiers across ${files.length} files, 0 violations.`);
  process.exit(0);
}

console.error(`check-import-case: ${violations.length} violation(s) across ${files.length} files (${checked} relative specifiers checked)\n`);
for (const v of violations) {
  console.error(`  [${v.kind}] ${rel(v.file)}:${v.line}`);
  console.error(`      specifier: ${v.specifier}`);
  console.error(`      ${v.detail}`);
}
process.exit(1);
