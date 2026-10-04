/* eslint-env node */
// scripts/eval/lib.js
// Shared helpers for the prediction build + offline evaluation scripts.
// Node only (never bundled into the app).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(__dirname, 'data');

// The engine lives in src/ as ES modules. Node 22 can require() them, but
// prints a one-off "reparsing as ES module" warning per file; silence only
// that warning so the evaluation output stays readable.
const origEmitWarning = process.emitWarning;
process.emitWarning = function filtered(warning, ...rest) {
  const msg = String(warning && warning.message ? warning.message : warning);
  const code = rest[0] && typeof rest[0] === 'object' ? rest[0].code : rest[1];
  if (code === 'MODULE_TYPELESS_PACKAGE_JSON' || msg.includes('Reparsing as ES module')) return;
  return origEmitWarning.call(process, warning, ...rest);
};

function requireSrc(rel) {
  return require(path.join(ROOT, 'src', rel));
}

/** Deterministic PRNG (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, seed) {
  const r = rng(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Parse seed-corpus.txt into tagged sentences. Duplicate sentences (same
 * normalised text) are merged so a train/test split can never contain the
 * same sentence on both sides.
 */
function loadSeedCorpus() {
  const { tokenize } = requireSrc('services/prediction/tokenize.js');
  const text = fs.readFileSync(path.join(DATA_DIR, 'seed-corpus.txt'), 'utf8');
  let contexts = ['general'];
  let mode = 'any';
  const byKey = new Map();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('@')) {
      const c = /contexts=([\w,]+)/.exec(line);
      const m = /mode=(\w+)/.exec(line);
      contexts = c ? c[1].split(',') : ['general'];
      mode = m ? m[1] : 'any';
      continue;
    }
    const key = tokenize(line).join(' ');
    if (!key) continue;
    const prev = byKey.get(key);
    if (prev) {
      for (const c of contexts) if (!prev.contexts.includes(c)) prev.contexts.push(c);
      if (prev.mode !== mode) prev.mode = 'any';
    } else {
      byKey.set(key, { text: line, key, contexts: contexts.slice(), mode });
    }
  }
  return [...byKey.values()];
}

/** Parse personas.txt into ordered synthetic persona sequences. */
function loadPersonas() {
  const text = fs.readFileSync(path.join(DATA_DIR, 'personas.txt'), 'utf8');
  const personas = [];
  let cur = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('===')) {
      const attr = (name) => (new RegExp(`${name}=(\\S+)`).exec(line) || [])[1];
      cur = { id: attr('id'), role: attr('role'), mode: attr('mode'), context: attr('context'), sentences: [] };
      personas.push(cur);
      continue;
    }
    if (cur) cur.sentences.push(line);
  }
  return personas;
}

/**
 * Board vocabulary from src/data/coreVocabulary.js.
 * @returns {{ labels: string[], location: Map<string, 'home'|'page'>,
 *             multi: { tokens: string[], where: 'home'|'page' }[] }}
 *   location: where a single word can be tapped (home page = 1 action,
 *   any other page = 2 actions: navigate + tap).
 *   multi: multi-word buttons ("I want", "thank you", "I need help").
 */
function loadBoard() {
  const { tokenize } = requireSrc('services/prediction/tokenize.js');
  const { corePages } = requireSrc('data/coreVocabulary.js');
  const labels = [];
  const location = new Map();
  const multi = [];
  for (const [pageId, page] of Object.entries(corePages)) {
    for (const b of page.buttons) {
      if (b.navigateTo) continue;
      labels.push(b.label);
      const toks = tokenize(b.label);
      if (toks.length > 1) {
        multi.push({ tokens: toks, where: pageId === 'home' ? 'home' : 'page' });
        continue;
      }
      if (toks.length !== 1) continue;
      const w = toks[0];
      if (pageId === 'home') location.set(w, 'home');
      else if (!location.has(w)) location.set(w, 'page');
    }
  }
  return { labels, location, multi };
}

module.exports = { ROOT, DATA_DIR, requireSrc, rng, shuffle, loadSeedCorpus, loadPersonas, loadBoard };
