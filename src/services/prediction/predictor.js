// src/services/prediction/predictor.js
// Next-word prediction: a base n-gram model (shipped, synthetic seed corpus)
// merged with the user's own opt-in personal counts.
//
// Scoring is interpolated absolute discounting over trigram → bigram →
// unigram. Personal counts are "count-merged" into each level with weight
// `personalWeight`, so a phrase the user says often quickly outranks generic
// continuations without throwing the base model away.
//
//   P1(w)   = (U(w) + eps) / (Z + eps·V)
//             U(w) = base(w) + modeW·mode(w) + topicW·topic(w) + α·personal(w) + boardFloor
//   P2(w|v) = max(C(v,w) − D, 0) / C(v) + D·N(v) / C(v) · P1(w)
//   P3(w|u,v) likewise, backing off to P2
//
// where C(·) = base count + α · decayed personal count.
//
// Everything is synchronous and allocation-light: a typical call scores
// ~100 candidates and takes well under a millisecond on a desktop CPU.

import { BOS, tokenize, isPredictableWord, displayWord, stripNonWord } from './tokenize.js';
import { indexBaseModel } from './baseIndex.js';
import {
  createPersonalState, learnSentence, recordAccepted, recordDismissed,
  dismissalStrength, acceptedStrength, decayed, exportPersonalState,
  importPersonalState, wordPairCount, gramCount,
} from './personalModel.js';
import { rankerScore } from './ranker.js';

export const CONTEXTS = ['home', 'school', 'university', 'work', 'shopping', 'appointments', 'social'];
export const MODES = ['child', 'adult'];

export const DEFAULT_WEIGHTS = {
  discount: 0.75,      // absolute discount D
  personalWeight: 8,   // α: one personal observation ≈ 8 corpus observations (tuned, see docs)
  modeWeight: 1,       // extra unigram weight for words from the chosen mode's sentences
  topicWeight: 2,      // extra unigram weight for words from the chosen topic's sentences
  topicBoost: 0.5,     // final multiplier (1 + topicBoost) for topic words
  boardFloor: 0.5,     // pseudo-count so board-only words are valid candidates
  eps: 0.01,           // floor for totally unseen words
  acceptBoost: 0.15,   // per accepted use in this context (capped at 3)
  dismissHide: 0.5,    // dismissal strength at/above which a word is hidden
  dismissPenalty: 4,   // below the hide threshold: score / (1 + penalty·strength)
  topUnigrams: 40,     // unigram candidates considered per call
};

const HOUR = 3600000;
const DAY = 86400000;
const MAX_SENTENCE_WORDS = 30;

const REASONS = {
  personal_next: 'You often say this next',
  personal_word: 'A word you use',
  common_next: 'Common next word',
  topic: 'Fits this topic',
  common_word: 'Common word',
  board_word: 'Board word',
  phrase: 'A sentence you have said before',
};

/**
 * Extract capitalised display forms from the raw words the user spoke, so a
 * learned "Grandma" is suggested as "Grandma" rather than "grandma".
 */
function displayFormsFrom(raw) {
  const text = Array.isArray(raw) ? raw.join(' ') : String(raw || '');
  const forms = {};
  text.split(/\s+/).forEach((piece, i) => {
    const toks = tokenize(piece);
    if (toks.length !== 1 || i === 0) return;
    const form = stripNonWord(piece);
    if (form && form !== toks[0] && form.toLowerCase() === toks[0]) forms[toks[0]] = form;
  });
  return forms;
}

/**
 * Create a predictor.
 *
 * @param {object}   opts
 * @param {object}   opts.base               parsed baseModel.json (required)
 * @param {object}   [opts.personal]         exported personal JSON to start from
 * @param {boolean}  [opts.learningEnabled]  default false — learning is opt-in
 * @param {function} [opts.onPersonalChange] (exportFn) => void, called after any
 *                                           change that should be persisted
 * @param {function} [opts.now]              clock (ms); injectable for tests/eval
 * @param {object}   [opts.weights]          overrides for DEFAULT_WEIGHTS
 * @param {object}   [opts.limits]           overrides for personal store limits
 * @param {object}   [opts.ranker]           optional linear reranker weights
 */
export function createPredictor(opts = {}) {
  const base = indexBaseModel(opts.base);
  const now = opts.now || (() => Date.now());
  const W = { ...DEFAULT_WEIGHTS, ...(opts.weights || {}) };
  const limits = opts.limits || {};
  const ranker = opts.ranker || null;
  const onChange = typeof opts.onPersonalChange === 'function' ? opts.onPersonalChange : null;
  let learningEnabled = opts.learningEnabled === true;

  let personal = (opts.personal && importPersonalState(opts.personal, limits, now())) || createPersonalState(limits);

  // ── caches ──
  const uniCache = new Map(); // "mode|ctx" -> { top: string[], z: number }
  let persCache = { key: '', total: 0, top: [] };

  function notify() {
    if (onChange) onChange(() => exportPersonalState(personal));
  }

  // Base-only unigram mass of w under a mode/topic weighting.
  function baseUnigram(w, mode, ctx) {
    let u = base.uni.get(w) || 0;
    if (mode && base.mode[mode]) u += W.modeWeight * (base.mode[mode].map.get(w) || 0);
    if (ctx && base.ctx[ctx]) u += W.topicWeight * (base.ctx[ctx].map.get(w) || 0);
    if (base.board.has(w)) u += W.boardFloor;
    return u;
  }

  function unigramInfo(mode, ctx) {
    const key = `${mode || ''}|${ctx || ''}`;
    let info = uniCache.get(key);
    if (!info) {
      let z = 0;
      const scored = [];
      for (const w of base.vocab) {
        const u = baseUnigram(w, mode, ctx);
        z += u;
        scored.push([w, u]);
      }
      scored.sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1));
      info = { z, top: scored.slice(0, W.topUnigrams).map(x => x[0]) };
      uniCache.set(key, info);
    }
    return info;
  }

  // Personal unigram total + top words, cached per revision and hour.
  function personalUnigramInfo(t) {
    const key = `${personal.revision}|${Math.floor(t / HOUR)}`;
    if (persCache.key !== key) {
      const hl = personal.limits.halfLifeMs;
      let total = 0;
      const scored = [];
      for (const [w, e] of personal.uni) {
        const c = decayed(e, t, hl);
        total += c;
        scored.push([w, c]);
      }
      scored.sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1));
      persCache = { key, total, top: scored.slice(0, 20).map(x => x[0]) };
    }
    return persCache;
  }

  // Merge base + personal continuation counts for one history.
  function level(baseMap, persMap, hist, t, alpha) {
    const b = hist == null ? null : baseMap.get(hist);
    const p = hist == null || alpha === 0 ? null : persMap.get(hist);
    if (!b && !p) return null;
    const hl = personal.limits.halfLifeMs;
    let total = b ? b.total : 0;
    let n = b ? b.n : 0;
    let pc = null;
    if (p) {
      pc = new Map();
      for (const [w, e] of p) {
        const c = decayed(e, t, hl);
        if (c <= 0) continue;
        pc.set(w, c);
        total += alpha * c;
        if (!b || !b.conts.has(w)) n++;
      }
    }
    if (total <= 0) return null;
    return { b: b ? b.conts : null, p: pc, total, n, alpha };
  }

  function levelCounts(L, w) {
    const cb = L.b ? (L.b.get(w) || 0) : 0;
    const cp = L.p ? (L.p.get(w) || 0) : 0;
    return [cb, cp];
  }

  function interp(L, w, lower) {
    if (!L) return lower;
    const [cb, cp] = levelCounts(L, w);
    const c = cb + L.alpha * cp;
    const D = W.discount;
    return Math.max(c - D, 0) / L.total + (D * L.n / L.total) * lower;
  }

  /**
   * Score every candidate for a context. Returns detailed rows (used by
   * predict(), the offline evaluation and ranker training).
   */
  function scoreCandidates(contextWords, o = {}) {
    const t = now();
    const mode = MODES.includes(o.mode) ? o.mode : null;
    const ctx = CONTEXTS.includes(o.context) ? o.context : null;
    const toks = tokenize(contextWords);
    const prev = toks.length ? toks[toks.length - 1] : BOS;
    const hist2 = toks.length >= 2 ? `${toks[toks.length - 2]} ${prev}` : (toks.length === 1 ? `${BOS} ${prev}` : null);
    const alpha = W.personalWeight;
    const wantFeatures = !!(ranker || o.features);

    // Levels for the merged model (and base-only / personal-only for features)
    const L2 = level(base.bi, personal.bi, prev, t, alpha);
    const L3 = level(base.tri, personal.tri, hist2, t, alpha);
    const uInfo = unigramInfo(mode, ctx);
    const pInfo = personalUnigramInfo(t);
    const V = base.vocab.length + personal.uni.size;
    const Z = uInfo.z + alpha * pInfo.total;

    let B2, B3, P2, P3;
    if (wantFeatures) {
      B2 = level(base.bi, personal.bi, prev, t, 0);
      B3 = level(base.tri, personal.tri, hist2, t, 0);
      const emptyBase = new Map();
      P2 = level(emptyBase, personal.bi, prev, t, 1);
      P3 = level(emptyBase, personal.tri, hist2, t, 1);
    }

    // Candidate set
    const cands = new Set();
    const prefix = typeof o.prefix === 'string' ? o.prefix.toLowerCase().replace(/[‘’]/g, "'").trim() : '';
    if (prefix) {
      for (const w of base.vocab) if (w.startsWith(prefix)) cands.add(w);
      for (const w of personal.uni.keys()) if (w.startsWith(prefix)) cands.add(w);
    } else {
      for (const L of [L3, L2]) {
        if (!L) continue;
        if (L.b) for (const w of L.b.keys()) cands.add(w);
        if (L.p) for (const w of L.p.keys()) cands.add(w);
      }
      for (const w of uInfo.top) cands.add(w);
      for (const w of pInfo.top) cands.add(w);
    }

    const hlPersonal = personal.limits.halfLifeMs;
    const rows = [];
    for (const w of cands) {
      if (w === BOS || !isPredictableWord(w)) continue;
      const dismissed = dismissalStrength(personal, prev, w, t);
      if (dismissed >= W.dismissHide && !o.includeDismissed) continue;

      const pu = personal.uni.get(w);
      const uPers = pu ? decayed(pu, t, hlPersonal) : 0;
      const uBase = baseUnigram(w, mode, ctx);
      const p1 = (uBase + alpha * uPers + W.eps) / (Z + W.eps * V);
      const p2 = interp(L2, w, p1);
      let p = interp(L3, w, p2);

      const topicMatch = ctx && base.ctx[ctx] && base.ctx[ctx].distinct.has(w) ? 1 : 0;
      if (topicMatch) p *= 1 + W.topicBoost;
      const acc = Math.min(acceptedStrength(personal, prev, w, t), 3);
      if (acc > 0) p *= 1 + W.acceptBoost * acc;
      if (dismissed > 0.02) p /= 1 + W.dismissPenalty * dismissed;

      // Which evidence dominates? Look at the most specific level that knows w.
      let source = 'base';
      let reasonCode = base.board.has(w) && !base.uni.get(w) ? 'board_word' : 'common_word';
      let personalOrder = 0;
      const c3 = L3 ? levelCounts(L3, w) : [0, 0];
      const c2 = L2 ? levelCounts(L2, w) : [0, 0];
      if (c3[1] > 0) personalOrder = 1;
      else if (c2[1] > 0) personalOrder = 2 / 3;
      else if (uPers > 0) personalOrder = 1 / 3;
      const top = c3[0] + c3[1] > 0 ? c3 : (c2[0] + c2[1] > 0 ? c2 : null);
      if (top) {
        if (alpha * top[1] >= top[0]) { source = 'personal'; reasonCode = 'personal_next'; }
        else reasonCode = topicMatch ? 'topic' : 'common_next';
      } else if (alpha * uPers >= uBase && uPers > 0) {
        source = 'personal';
        reasonCode = 'personal_word';
      } else if (topicMatch) {
        reasonCode = 'topic';
      }

      const row = { word: w, p, source, reasonCode };
      if (wantFeatures) {
        const pb1 = (uBase + W.eps) / (uInfo.z + W.eps * V);
        const pb = interp(B3, w, interp(B2, w, pb1));
        const pp1 = pInfo.total > 0 ? (uPers + 1e-3) / (pInfo.total + 1e-3 * V) : 1 / V;
        const pp = interp(P3, w, interp(P2, w, pp1));
        // Recency of the most specific personal evidence for w here
        let last = 0;
        const e3 = hist2 && personal.tri.get(hist2) ? personal.tri.get(hist2).get(w) : null;
        const e2 = personal.bi.get(prev) ? personal.bi.get(prev).get(w) : null;
        const e1 = personal.uni.get(w);
        last = (e3 || e2 || e1 || { t: 0 }).t;
        const recency = last > 0 ? Math.pow(2, -Math.max(0, t - last) / DAY) : 0;
        row.features = [Math.log(p), Math.log(pb), Math.log(pp), recency, acc, topicMatch, personalOrder];
      }
      rows.push(row);
    }

    if (ranker) {
      for (const r of rows) r.score = rankerScore(ranker, r.features);
    } else {
      for (const r of rows) r.score = r.p;
    }
    // Deterministic order: score desc, then alphabetical
    rows.sort((a, b) => (b.score - a.score) || (a.word < b.word ? -1 : 1));
    return rows;
  }

  /**
   * Predict the next word.
   * @param {string|string[]} contextWords  words so far (raw labels are fine)
   * @param {{k?: number, context?: string, mode?: string, prefix?: string}} [o]
   * @returns {{word: string, label: string, score: number,
   *            source: 'base'|'personal', reason: string, reasonCode: string}[]}
   */
  function predict(contextWords, o = {}) {
    const k = Number.isFinite(o.k) && o.k > 0 ? Math.floor(o.k) : 6;
    const rows = scoreCandidates(contextWords, o);
    const out = [];
    for (const r of rows) {
      if (out.length >= k) break;
      out.push({
        word: r.word,
        label: displayWord(r.word, personal.display.has(r.word) ? { [r.word]: personal.display.get(r.word) } : base.display),
        score: r.score,
        source: r.source,
        reason: REASONS[r.reasonCode],
        reasonCode: r.reasonCode,
      });
    }
    return out;
  }

  /**
   * Whole-sentence completions from sentences the user has spoken at least
   * `minCount` times (decayed). Separate from predict() so the UI can show
   * them in their own row.
   * @returns {{phrase: string, completion: string, score: number, source: 'phrase', reason: string, reasonCode: 'phrase'}[]}
   */
  function predictPhrases(contextWords, o = {}) {
    const k = Number.isFinite(o.k) && o.k > 0 ? Math.floor(o.k) : 3;
    const minCount = Number.isFinite(o.minCount) ? o.minCount : 2;
    const toks = tokenize(contextWords);
    const t = now();
    const prefix = toks.join(' ');
    const out = [];
    for (const [sentence, e] of personal.phrases) {
      const c = decayed(e, t, personal.limits.halfLifeMs);
      if (c < minCount) continue;
      if (prefix && !(sentence.startsWith(prefix + ' '))) continue;
      const words = sentence.split(' ');
      if (words.length <= toks.length) continue;
      const fmt = (ws) => ws.map(w => displayWord(w, personal.display.has(w) ? { [w]: personal.display.get(w) } : base.display)).join(' ');
      out.push({
        phrase: fmt(words),
        completion: fmt(words.slice(toks.length)),
        score: c,
        source: 'phrase',
        reason: REASONS.phrase,
        reasonCode: 'phrase',
      });
    }
    out.sort((a, b) => (b.score - a.score) || (a.phrase < b.phrase ? -1 : 1));
    return out.slice(0, k);
  }

  /**
   * Positive evidence: call ONLY when a sentence is actually spoken (Speak).
   * Taps that were later deleted never reach here, so they never train.
   * @returns {boolean} true if something was learned
   */
  function learnFromSpokenSentence(words) {
    if (!learningEnabled) return false;
    const toks = tokenize(words).slice(0, MAX_SENTENCE_WORDS);
    if (toks.length === 0) return false;
    learnSentence(personal, toks, now(), displayFormsFrom(words));
    notify();
    return true;
  }

  /** The user tapped a suggestion chip. Weak signal; ignored when learning is off. */
  function recordSuggestionAccepted(word, contextWords) {
    if (!learningEnabled) return false;
    const w = tokenize(word)[0];
    if (!w) return false;
    const toks = tokenize(contextWords);
    recordAccepted(personal, toks.length ? toks[toks.length - 1] : BOS, w, now());
    notify();
    return true;
  }

  /**
   * "Don't suggest this here." Hides the word after this context word until
   * the dismissal decays (half-life 14 days), then down-weights it.
   * Works for the session even with learning off; persisted only when on.
   */
  function dismissSuggestion(word, contextWords) {
    const w = tokenize(word)[0];
    if (!w) return false;
    const toks = tokenize(contextWords);
    recordDismissed(personal, toks.length ? toks[toks.length - 1] : BOS, w, now());
    if (learningEnabled) notify();
    return true;
  }

  function resetPersonal() {
    personal = createPersonalState(limits);
    persCache = { key: '', total: 0, top: [] };
    notify();
  }

  function exportPersonal() {
    return exportPersonalState(personal);
  }

  /** Replace personal data with an export. Returns false if it was not valid. */
  function importPersonal(json) {
    const state = importPersonalState(json, limits, now());
    if (!state) return false;
    personal = state;
    personal.revision++;
    notify();
    return true;
  }

  /** Plain-language summary for the personalisation settings screen. */
  function getPersonalStats() {
    const sentences = personal.sentences;
    const wordPairs = wordPairCount(personal);
    const words = personal.uni.size;
    const s = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    return {
      learningEnabled,
      sentences,
      words,
      wordPairs,
      phrases: personal.phrases.size,
      dismissed: personal.dismissed.size,
      storedItems: gramCount(personal),
      updatedAt: personal.updatedAt || null,
      summary: sentences === 0
        ? 'Nothing learned yet.'
        : `Learned from ${s(sentences, 'sentence', 'sentences')}, ${s(wordPairs, 'word pair', 'word pairs')}.`,
    };
  }

  return {
    predict,
    predictPhrases,
    learnFromSpokenSentence,
    recordSuggestionAccepted,
    dismissSuggestion,
    exportPersonal,
    importPersonal,
    resetPersonal,
    getPersonalStats,
    setLearningEnabled(v) { learningEnabled = v === true; },
    isLearningEnabled() { return learningEnabled; },
    // Internal: detailed candidate rows for evaluation / ranker training.
    scoreCandidates,
  };
}
