// src/services/prediction/personalModel.js
// The user's own, bounded n-gram counts with exponential recency decay.
//
// Pure data functions — no storage, no React. The predictor owns one of these
// state objects; personalStore.js persists its exported JSON.
//
// Every count is stored as { c, t }: the count as of time t (ms). The value
// "now" is c * 2^(-(now - t) / halfLife), so old habits fade instead of
// dominating forever. Updating an entry first decays it to now, then adds.
//
// Bounds (all pruned by lowest decayed value):
//   - n-grams (unigrams + bigrams + trigrams)  maxGrams    (default 5000)
//   - dismissed / accepted suggestion entries  maxFeedback (default 300 each)
//   - remembered whole sentences (phrases)     maxPhrases  (default 200)

import { BOS, isPredictableWord } from './tokenize.js';

export const PERSONAL_FORMAT = 'voice-personal';
export const PERSONAL_VERSION = 1;

const DAY = 86400000;

export const DEFAULT_PERSONAL_LIMITS = {
  maxGrams: 5000,
  maxFeedback: 300,
  maxPhrases: 200,
  halfLifeMs: 45 * DAY,          // n-gram counts halve every 45 days unused
  dismissHalfLifeMs: 14 * DAY,   // dismissals fade faster
  pruneTo: 0.9,                  // when over a cap, prune down to 90% of it
};

export function decayed(entry, now, halfLifeMs) {
  if (!entry) return 0;
  const age = now - entry.t;
  if (age <= 0) return entry.c;
  return entry.c * Math.pow(2, -age / halfLifeMs);
}

function addTo(map, key, now, halfLifeMs, by = 1) {
  const prev = map.get(key);
  map.set(key, { c: decayed(prev, now, halfLifeMs) + by, t: now });
}

/** Create an empty personal state. */
export function createPersonalState(limits = {}) {
  return {
    limits: { ...DEFAULT_PERSONAL_LIMITS, ...limits },
    uni: new Map(),   // word -> {c,t}
    bi: new Map(),    // prev -> Map(word -> {c,t})
    tri: new Map(),   // "a b" -> Map(word -> {c,t})
    accepted: new Map(),  // "prev word" -> {c,t}
    dismissed: new Map(), // "prev word" -> {c,t}
    phrases: new Map(),   // "whole sentence" -> {c,t}
    display: new Map(),   // word -> display form (e.g. "Grandma")
    sentences: 0,
    createdAt: 0,
    updatedAt: 0,
    revision: 0,          // bumps on every change (cache key for the predictor)
  };
}

export function gramCount(state) {
  let n = state.uni.size;
  for (const m of state.bi.values()) n += m.size;
  for (const m of state.tri.values()) n += m.size;
  return n;
}

function touch(state, now) {
  if (!state.createdAt) state.createdAt = now;
  state.updatedAt = now;
  state.revision++;
}

/**
 * Learn from one spoken sentence (already tokenised).
 * @param {object} state
 * @param {string[]} words   normalised tokens
 * @param {number} now
 * @param {Object<string,string>} [displayForms]  word -> capitalised form
 */
export function learnSentence(state, words, now, displayForms) {
  const { halfLifeMs } = state.limits;
  const seq = [BOS, ...words];
  for (let i = 1; i < seq.length; i++) {
    const w = seq[i];
    addTo(state.uni, w, now, halfLifeMs);
    if (!state.bi.has(seq[i - 1])) state.bi.set(seq[i - 1], new Map());
    addTo(state.bi.get(seq[i - 1]), w, now, halfLifeMs);
    if (i >= 2) {
      const h = `${seq[i - 2]} ${seq[i - 1]}`;
      if (!state.tri.has(h)) state.tri.set(h, new Map());
      addTo(state.tri.get(h), w, now, halfLifeMs);
    }
  }
  if (displayForms) {
    for (const [w, form] of Object.entries(displayForms)) state.display.set(w, form);
  }
  if (words.length >= 2 && words.length <= 10) {
    addTo(state.phrases, words.join(' '), now, halfLifeMs);
  }
  state.sentences++;
  touch(state, now);
  enforceLimits(state, now);
}

export function feedbackKey(prev, word) {
  return `${prev || BOS} ${word}`;
}

export function recordAccepted(state, prev, word, now) {
  addTo(state.accepted, feedbackKey(prev, word), now, state.limits.halfLifeMs);
  // Accepting a word clears an old dismissal of it in the same context.
  state.dismissed.delete(feedbackKey(prev, word));
  touch(state, now);
  enforceLimits(state, now);
}

export function recordDismissed(state, prev, word, now) {
  addTo(state.dismissed, feedbackKey(prev, word), now, state.limits.dismissHalfLifeMs);
  touch(state, now);
  enforceLimits(state, now);
}

/** Decayed strength of a dismissal (1 = just dismissed once). */
export function dismissalStrength(state, prev, word, now) {
  return decayed(state.dismissed.get(feedbackKey(prev, word)), now, state.limits.dismissHalfLifeMs);
}

export function acceptedStrength(state, prev, word, now) {
  return decayed(state.accepted.get(feedbackKey(prev, word)), now, state.limits.halfLifeMs);
}

// Remove the weakest entries of a flat Map until it fits.
function pruneFlat(map, max, target, now, halfLifeMs) {
  if (map.size <= max) return;
  const ranked = [...map.entries()]
    .map(([k, e]) => [k, decayed(e, now, halfLifeMs)])
    .sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : 1));
  const remove = map.size - Math.floor(max * target);
  for (let i = 0; i < remove; i++) map.delete(ranked[i][0]);
}

/** Apply all caps. Called after every mutation; cheap when under the caps. */
export function enforceLimits(state, now) {
  const { maxGrams, maxFeedback, maxPhrases, halfLifeMs, dismissHalfLifeMs, pruneTo } = state.limits;
  pruneFlat(state.accepted, maxFeedback, pruneTo, now, halfLifeMs);
  pruneFlat(state.dismissed, maxFeedback, pruneTo, now, dismissHalfLifeMs);
  pruneFlat(state.phrases, maxPhrases, pruneTo, now, halfLifeMs);

  const total = gramCount(state);
  if (total <= maxGrams) return;
  // Rank every n-gram across all orders by decayed count; drop the weakest.
  const all = [];
  for (const [w, e] of state.uni) all.push([1, null, w, decayed(e, now, halfLifeMs)]);
  for (const [h, m] of state.bi) for (const [w, e] of m) all.push([2, h, w, decayed(e, now, halfLifeMs)]);
  for (const [h, m] of state.tri) for (const [w, e] of m) all.push([3, h, w, decayed(e, now, halfLifeMs)]);
  // Weakest first; at equal strength drop longer n-grams first (they are the
  // most specific and the cheapest to lose), then alphabetical for determinism.
  all.sort((a, b) => (a[3] - b[3]) || (b[0] - a[0]) || (`${a[1]} ${a[2]}` < `${b[1]} ${b[2]}` ? -1 : 1));
  const remove = total - Math.floor(maxGrams * pruneTo);
  for (let i = 0; i < remove; i++) {
    const [order, h, w] = all[i];
    if (order === 1) {
      state.uni.delete(w);
      state.display.delete(w);
    } else {
      const map = order === 2 ? state.bi : state.tri;
      const m = map.get(h);
      if (m) {
        m.delete(w);
        if (m.size === 0) map.delete(h);
      }
    }
  }
}

/** Count of distinct word pairs learned (bigrams, not counting sentence starts). */
export function wordPairCount(state) {
  let n = 0;
  for (const [h, m] of state.bi) if (h !== BOS) n += m.size;
  return n;
}

// ── Serialisation ──

const round = (x) => Math.round(x * 1000) / 1000;
const pack = (e) => [round(e.c), e.t];

function packFlat(map) {
  const out = {};
  for (const [k, e] of map) out[k] = pack(e);
  return out;
}

function packNested(map) {
  const out = {};
  for (const [h, m] of map) for (const [w, e] of m) out[`${h} ${w}`] = pack(e);
  return out;
}

/** Plain JSON-safe snapshot of the state. */
export function exportPersonalState(state) {
  return {
    format: PERSONAL_FORMAT,
    version: PERSONAL_VERSION,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    sentences: state.sentences,
    uni: packFlat(state.uni),
    bi: packNested(state.bi),
    tri: packNested(state.tri),
    accepted: packFlat(state.accepted),
    dismissed: packFlat(state.dismissed),
    phrases: packFlat(state.phrases),
    display: Object.fromEntries(state.display),
  };
}

function validEntry(v) {
  return Array.isArray(v) && v.length === 2 &&
    Number.isFinite(v[0]) && v[0] > 0 && Number.isFinite(v[1]);
}

function validWords(parts, allowBos) {
  return parts.every((p, i) => (allowBos && p === BOS && i < parts.length - 1) || isPredictableWord(p));
}

/**
 * Rebuild a state from exported JSON. Invalid entries are skipped, never
 * thrown on, so a partly damaged export still restores what it can.
 * @returns {object|null} state, or null if the input is not a personal export
 */
export function importPersonalState(json, limits = {}, now = Date.now()) {
  let data = json;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return null; }
  }
  if (!data || typeof data !== 'object' || data.format !== PERSONAL_FORMAT) return null;
  if (data.version !== PERSONAL_VERSION) return null;

  const state = createPersonalState(limits);
  const flat = (src, target, n, allowBos) => {
    if (!src || typeof src !== 'object') return;
    for (const [k, v] of Object.entries(src)) {
      const parts = k.split(' ');
      if (parts.length !== n || !validWords(parts, allowBos) || !validEntry(v)) continue;
      target.set(k, { c: v[0], t: v[1] });
    }
  };
  const nested = (src, target, n) => {
    if (!src || typeof src !== 'object') return;
    for (const [k, v] of Object.entries(src)) {
      const parts = k.split(' ');
      if (parts.length !== n || !validWords(parts, true) || !validEntry(v)) continue;
      const h = parts.slice(0, n - 1).join(' ');
      if (!target.has(h)) target.set(h, new Map());
      target.get(h).set(parts[n - 1], { c: v[0], t: v[1] });
    }
  };
  flat(data.uni, state.uni, 1, false);
  nested(data.bi, state.bi, 2);
  nested(data.tri, state.tri, 3);
  flat(data.accepted, state.accepted, 2, true);
  flat(data.dismissed, state.dismissed, 2, true);
  if (data.phrases && typeof data.phrases === 'object') {
    for (const [k, v] of Object.entries(data.phrases)) {
      const parts = k.split(' ');
      if (parts.length >= 2 && parts.length <= 10 && validWords(parts, false) && validEntry(v)) {
        state.phrases.set(k, { c: v[0], t: v[1] });
      }
    }
  }
  if (data.display && typeof data.display === 'object') {
    for (const [w, form] of Object.entries(data.display)) {
      if (state.uni.has(w) && typeof form === 'string' && form.toLowerCase() === w) state.display.set(w, form);
    }
  }
  state.sentences = Number.isFinite(data.sentences) && data.sentences >= 0 ? Math.floor(data.sentences) : 0;
  state.createdAt = Number.isFinite(data.createdAt) ? data.createdAt : 0;
  state.updatedAt = Number.isFinite(data.updatedAt) ? data.updatedAt : 0;
  enforceLimits(state, now);
  return state;
}
