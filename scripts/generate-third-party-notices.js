#!/usr/bin/env node
/* eslint-env node */
// Generates src/data/thirdPartyNotices.json — the open-source notices shown
// in Settings › About › Open-source licences.
//
// Which packages: everything Metro actually put in the app's JS bundle (read
// from the bundle's source map) plus the app's direct runtime dependencies
// (which also cover native-only modules). Build-time tools are not shipped
// and are not listed.
//
// Usage:
//   npx expo export --platform android --dump-sourcemap --output-dir /tmp/exp
//   node scripts/generate-third-party-notices.js /tmp/exp/_expo/static/js/android/<bundle>.hbc.map
//
// Re-run whenever dependencies change.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src/data/thirdPartyNotices.json');
const mapPath = process.argv[2];
if (!mapPath) {
  console.error('Pass the path to the exported bundle source map.');
  process.exit(1);
}

const sourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

// Resolve each bundled source to the package directory it actually came
// from, including nested node_modules copies (which can be other versions
// with other notices than the root copy).
const packageDirs = new Set();
for (const src of sourceMap.sources || []) {
  const i = src.lastIndexOf('node_modules/');
  if (i < 0) continue;
  const parts = src.slice(i + 'node_modules/'.length).split('/');
  const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  const rel = `${src.slice(0, i)}node_modules/${name}`.replace(/^\/+/, '');
  packageDirs.add(path.join(ROOT, rel));
}
const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
Object.keys(rootPkg.dependencies || {}).forEach(n => packageDirs.add(path.join(ROOT, 'node_modules', n)));

const LICENSE_FILES = /^(licen[cs]e|copying)(\.(md|txt|markdown))?$/i;
const texts = {}; // hash -> text (identical licence texts stored once)
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `t${(h >>> 0).toString(36)}`;
};

// For packages published without a LICENSE file, the copyright holder comes
// from package.json so the standard text is never shown without it.
function copyrightFrom(pj) {
  const person = (a) => (typeof a === 'string' ? a.replace(/\s*[<(].*$/, '') : a && a.name);
  const holder = person(pj.author)
    || (Array.isArray(pj.contributors) && pj.contributors.map(person).filter(Boolean).join(', '))
    || (Array.isArray(pj.maintainers) && pj.maintainers.map(person).filter(Boolean).join(', '));
  return holder ? `Copyright (c) ${holder}` : `Copyright (c) the ${pj.name} authors`;
}

const byKey = new Map(); // name@version -> entry (distinct copies kept)
const missing = [];
for (const dir of [...packageDirs].sort()) {
  const pjPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pjPath)) continue; // e.g. virtual modules
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  const key = `${pj.name}@${pj.version}`;
  if (byKey.has(key)) continue;
  const license = typeof pj.license === 'string' ? pj.license
    : (pj.license && pj.license.type) || (Array.isArray(pj.licenses) ? pj.licenses.map(l => l.type).join(' OR ') : 'UNKNOWN');
  const file = fs.readdirSync(dir).find(f => LICENSE_FILES.test(f));
  let textId = null;
  let copyright = null;
  if (file) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8').trim();
    textId = hash(text);
    texts[textId] = text;
  } else {
    copyright = copyrightFrom(pj);
    missing.push(pj.name);
  }
  byKey.set(key, { name: pj.name, version: pj.version, license, textId, copyright });
}
const packages = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

// Fonts bundled by @expo/vector-icons are separate works with their own
// notices (sources: github.com/ionic-team/ionicons and
// github.com/google/material-design-icons LICENSE files).
const fonts = [
  { name: 'Ionicons (icon font)', license: 'MIT', copyright: 'Copyright (c) 2015-present Ionic (http://ionic.io/)' },
  { name: 'Material Icons (icon font)', license: 'Apache-2.0', copyright: 'Copyright Google LLC' },
];

// Licence texts for packages that ship no LICENSE file in node_modules, keyed
// by SPDX id. The Apache-2.0 text is required by its section 4(a).
const STANDARD = {
  'Apache-2.0': 'apache-2.0.txt',
  MIT: 'mit.txt',
};
const standardTexts = {};
for (const [spdx, file] of Object.entries(STANDARD)) {
  const p = path.join(__dirname, 'licenses', file);
  if (fs.existsSync(p)) standardTexts[spdx] = fs.readFileSync(p, 'utf8').trim();
}

fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  note: 'Packages shipped in the app bundle. Packages without a LICENSE file in their published package use the standard text for their SPDX licence.',
  packages,
  fonts,
  texts,
  standardTexts,
}));
console.log(`Wrote ${packages.length} packages, ${Object.keys(texts).length} distinct licence texts to ${path.relative(ROOT, OUT)}`);
console.log(`Without LICENSE file (standard text used): ${missing.length}`);
const nonPermissive = packages.filter(p => /GPL|AGPL|SSPL|NC|UNKNOWN|UNLICENSED/i.test(p.license) && !/OR (MIT|BSD|Apache)/i.test(p.license));
if (nonPermissive.length) console.warn('Review these licences:', nonPermissive.map(p => `${p.name} (${p.license})`).join(', '));
