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
const names = new Set();
for (const src of sourceMap.sources || []) {
  const i = src.lastIndexOf('node_modules/');
  if (i < 0) continue;
  const parts = src.slice(i + 'node_modules/'.length).split('/');
  names.add(parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]);
}
const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
Object.keys(rootPkg.dependencies || {}).forEach(n => names.add(n));

const LICENSE_FILES = /^(licen[cs]e|copying)(\.(md|txt|markdown))?$/i;
const texts = {}; // hash -> text (identical licence texts stored once)
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `t${(h >>> 0).toString(36)}`;
};

const packages = [];
const missing = [];
for (const name of [...names].sort()) {
  const dir = path.join(ROOT, 'node_modules', name);
  const pjPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pjPath)) continue; // e.g. virtual modules
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  const license = typeof pj.license === 'string' ? pj.license
    : (pj.license && pj.license.type) || (Array.isArray(pj.licenses) ? pj.licenses.map(l => l.type).join(' OR ') : 'UNKNOWN');
  const file = fs.readdirSync(dir).find(f => LICENSE_FILES.test(f));
  let textId = null;
  if (file) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8').trim();
    textId = hash(text);
    texts[textId] = text;
  } else {
    missing.push(name);
  }
  packages.push({ name, version: pj.version, license, textId });
}

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
  texts,
  standardTexts,
}));
console.log(`Wrote ${packages.length} packages, ${Object.keys(texts).length} distinct licence texts to ${path.relative(ROOT, OUT)}`);
console.log(`Without LICENSE file (standard text used): ${missing.length}`);
const nonPermissive = packages.filter(p => /GPL|AGPL|SSPL|NC|UNKNOWN|UNLICENSED/i.test(p.license) && !/OR (MIT|BSD|Apache)/i.test(p.license));
if (nonPermissive.length) console.warn('Review these licences:', nonPermissive.map(p => `${p.name} (${p.license})`).join(', '));
