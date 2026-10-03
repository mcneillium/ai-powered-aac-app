// src/services/predictionEngine.js
// Ranks next-word suggestions for the fixed suggestion row. Pure functions:
// no storage, no network, so the same code runs in the app, in tests and in
// the offline evaluation (scripts/eval-predictions.js).
//
// Three evidence sources, combined by weighted score:
//   1. personal  — what this user has said before (word, pair and triple
//                  counts that fade with a 30-day half-life). Only used when
//                  the user has turned learning on.
//   2. seed      — a small built-in model of common AAC continuations.
//   3. model     — the bundled neural model's ranked words, kept only if the
//                  word is real vocabulary (it otherwise emits tokens such as
//                  "xxx" from its training transcripts).
//
// Suggestions only ever appear in the suggestion row. Nothing here can move,
// hide or reorder a board button.

import { seedNext } from '../data/seedLanguageModel';

export const START = '<s>';
const DAY = 86400000;
const HALF_LIFE_DAYS = 30;

const WEIGHTS = { trigram: 3.2, bigram: 2.2, unigram: 0.5, seed: 1.1, model: 0.6 };

export const norm = (w) => String(w || '').toLowerCase().trim();

/** A count that fades with time since it was last used. */
export function decayed(entry, now) {
  if (!entry) return 0;
  const c = typeof entry === 'number' ? entry : entry.c || 0;
  const t = typeof entry === 'number' ? now : entry.t || now;
  const ageDays = Math.max(0, (now - t) / DAY);
  return c * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

// Saturating evidence: 1 use ≈ 0.4, 3 uses ≈ 0.67, 10 uses ≈ 0.87.
const sat = (x, k = 1.5) => (x <= 0 ? 0 : x / (x + k));

/** An empty personal model. */
export function emptyModel() {
  return { uni: {}, seq2: {}, seq3: {} };
}

/**
 * Record that `label` was chosen after `context` (earlier message entries).
 * Mutates and returns the model.
 */
export function learn(model, context, label, now = Date.now()) {
  const w = norm(label);
  if (!w) return model;
  const ctx = (context || []).map(norm).filter(Boolean);
  const p1 = ctx.length ? ctx[ctx.length - 1] : START;
  const p2 = ctx.length > 1 ? ctx[ctx.length - 2] : (ctx.length === 1 ? START : null);
  const bump = (map, key) => {
    const e = map[key] || { c: 0, t: now };
    map[key] = { c: decayed(e, now) + 1, t: now };
  };
  bump(model.uni, w);
  bump(model.seq2, `${p1}|${w}`);
  if (p2) bump(model.seq3, `${p2}|${p1}|${w}`);
  return model;
}

/** Remove everything learned about one word (user control). */
export function forget(model, label) {
  const w = norm(label);
  delete model.uni[w];
  for (const map of [model.seq2, model.seq3]) {
    Object.keys(map).forEach((k) => {
      if (k.split('|').pop() === w) delete map[k];
    });
  }
  return model;
}

/**
 * Rank candidate next words.
 * @param {object} p
 * @param {string[]} p.context       message so far (board labels)
 * @param {object}   [p.model]       personal model (ignored when learning is off)
 * @param {boolean}  [p.learning]    use personal evidence
 * @param {string[]} [p.modelWords]  neural model output, best first
 * @param {Set<string>|string[]} [p.vocabulary] known words (lower case)
 * @param {Set<string>|string[]} [p.blocked]    words the user never wants suggested
 * @param {number}   [p.limit]
 * @param {number}   [p.now]
 * @returns {{ word: string, score: number, source: string, reason: string|null }[]}
 */
export function rank({
  context = [], model = null, learning = false, modelWords = [],
  vocabulary = null, blocked = [], limit = 8, now = Date.now(),
}) {
  let ctx = context.map(norm).filter(Boolean);
  // A finished sentence ("...started today.") means the next word starts a
  // new one.
  if (ctx.length && /[.?!]$/.test(ctx[ctx.length - 1])) ctx = [];
  const p1 = ctx.length ? ctx[ctx.length - 1] : START;
  const p2 = ctx.length > 1 ? ctx[ctx.length - 2] : (ctx.length === 1 ? START : null);
  const vocab = vocabulary ? new Set([...vocabulary].map(norm)) : null;
  const block = new Set([...(blocked || [])].map(norm));
  const scores = new Map();
  const add = (word, part, amount) => {
    if (!word || amount <= 0) return;
    const s = scores.get(word) || { word, score: 0, parts: {} };
    s.score += amount;
    s.parts[part] = (s.parts[part] || 0) + amount;
    scores.set(word, s);
  };

  if (learning && model) {
    const pre3 = p2 ? `${p2}|${p1}|` : null;
    const pre2 = `${p1}|`;
    if (pre3) {
      for (const [k, e] of Object.entries(model.seq3 || {})) {
        if (k.startsWith(pre3)) add(k.slice(pre3.length), 'trigram', WEIGHTS.trigram * sat(decayed(e, now)));
      }
    }
    for (const [k, e] of Object.entries(model.seq2 || {})) {
      if (k.startsWith(pre2)) add(k.slice(pre2.length), 'bigram', WEIGHTS.bigram * sat(decayed(e, now)));
    }
    // Single-word frequency only nudges words that already have some
    // contextual support, or fills an empty start-of-message row.
    const uni = Object.entries(model.uni || {});
    for (const [w, e] of uni) {
      if (scores.has(w) || p1 === START) add(w, 'unigram', WEIGHTS.unigram * sat(decayed(e, now), 4));
    }
  }

  // Seed: the last two words together first (sentence starters such as
  // "I feel" arrive as two words), then the last word on its own.
  const seedPhrase = p2 && p2 !== START ? seedNext(`${p2} ${p1}`) : [];
  const seedWord = seedNext(p1);
  seedPhrase.forEach((w, i) => add(w, 'seed', WEIGHTS.seed * (1 - i / (seedPhrase.length + 1))));
  seedWord.forEach((w, i) => add(w, 'seed', WEIGHTS.seed * (seedPhrase.length ? 0.6 : 1) * (1 - i / (seedWord.length + 1))));

  const mw = (modelWords || []).map(norm).filter((w) => !vocab || vocab.has(w));
  mw.forEach((w, i) => add(w, 'model', WEIGHTS.model * (1 - i / (mw.length + 1))));

  return [...scores.values()]
    .filter((s) => !block.has(s.word) && s.word !== p1 && s.word !== START)
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
    .slice(0, limit)
    .map((s) => {
      const personal = (s.parts.trigram || 0) + (s.parts.bigram || 0) + (s.parts.unigram || 0);
      const learned = personal > 0 && personal >= s.score / 2;
      let reason = null;
      if (learned) reason = s.parts.trigram ? 'you said this before' : 'you often say';
      return { word: s.word, score: s.score, source: learned ? 'personal' : (s.parts.seed ? 'seed' : 'model'), reason };
    });
}

/**
 * Place ranked words into a fixed number of slots. A word that is still
 * suggested keeps the slot it was in, so the row does not shuffle under the
 * user's finger; new words fill the free slots best-first. Empty slots stay
 * empty (null) rather than collapsing the row.
 */
export function placeInSlots(previous, ranked, n) {
  const top = ranked.slice(0, n);
  const wordOf = (x) => (x && typeof x === 'object' ? x.word : x);
  const byWord = new Map(top.map((r) => [wordOf(r), r]));
  const slots = new Array(n).fill(null);
  (previous || []).slice(0, n).forEach((p, i) => {
    const w = wordOf(p);
    if (w && byWord.has(w)) {
      slots[i] = byWord.get(w);
      byWord.delete(w);
    }
  });
  const rest = [...byWord.values()];
  for (let i = 0; i < n && rest.length; i++) {
    if (!slots[i]) slots[i] = rest.shift();
  }
  return slots;
}

/**
 * Display form of a suggestion: the board's own spelling when the word is on
 * the board ("I", "TV"), otherwise as learned.
 */
export function displayForm(word, casing) {
  return (casing && casing.get(norm(word))) || word;
}

/** Migrate the earlier profile shape (word counts + "a b" pair keys). */
export function modelFromLegacyProfile(profile, now = Date.now()) {
  const m = emptyModel();
  if (!profile) return m;
  const recency = profile.wordRecency || {};
  for (const [w, c] of Object.entries(profile.wordFrequencies || {})) {
    if (c > 0) m.uni[norm(w)] = { c, t: recency[w] || now };
  }
  for (const [k, c] of Object.entries(profile.bigrams || {})) {
    const i = k.indexOf(' ');
    if (i <= 0 || c <= 0) continue;
    const a = norm(k.slice(0, i));
    const b = norm(k.slice(i + 1));
    m.seq2[`${a}|${b}`] = { c, t: recency[b] || now };
  }
  return m;
}
