// src/services/prediction/buildModel.js
// Builds the compact base n-gram model JSON from tagged sentences.
//
// Used at BUILD time by scripts/eval/build-base-model.js (and by the offline
// evaluation to build train-split models). The app itself never calls this;
// it only loads the resulting baseModel.json.
//
// Output format ("voice-ngram" v1), all word references are vocab indices:
//   vocab:   ['<s>', 'i', 'want', ...]       index 0 is always the BOS marker
//   uni:     [count, ...]                     aligned with vocab (BOS = 0)
//   bi:      [[prev, next, c, next, c, ...]]  one row per history word
//   tri:     [[a, b, next, c, ...]]           one row per two-word history
//   ctx:     { home: [idx, c, idx, c, ...] }  unigram counts per context tag
//   mode:    { child: [...], adult: [...] }   unigram counts per mode tag
//   board:   [idx, ...]                       board words (unigram candidates)
//   display: { word: 'Grandma' }              capitalised display forms

import { BOS, tokenize, isPredictableWord, stripNonWord } from './tokenize.js';

function bump(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

/**
 * @param {{ text: string, contexts?: string[], mode?: string }[]} sentences
 * @param {{ boardWords?: string[], meta?: object }} [opts]
 */
export function buildBaseModel(sentences, opts = {}) {
  const uni = new Map();
  const bi = new Map();   // "a b" -> count
  const tri = new Map();  // "a b c" -> count
  const ctx = {};         // ctxId -> Map(word -> count)
  const mode = {};        // modeId -> Map(word -> count)
  const caps = new Map(); // word -> Map(displayForm -> count)

  for (const s of sentences) {
    const words = tokenize(s.text);
    if (words.length === 0) continue;
    // Track capitalised forms that appear mid-sentence (proper nouns etc.)
    const rawParts = String(s.text).split(/\s+/);
    rawParts.forEach((raw, i) => {
      const w = tokenize(raw)[0];
      if (!w || i === 0) return;
      const form = stripNonWord(raw);
      if (form && form !== w) {
        if (!caps.has(w)) caps.set(w, new Map());
        bump(caps.get(w), form);
      }
    });

    const seq = [BOS, ...words];
    for (let i = 1; i < seq.length; i++) {
      bump(uni, seq[i]);
      bump(bi, `${seq[i - 1]} ${seq[i]}`);
      if (i >= 2) bump(tri, `${seq[i - 2]} ${seq[i - 1]} ${seq[i]}`);
    }
    for (const c of s.contexts || []) {
      if (!c || c === 'general') continue;
      if (!ctx[c]) ctx[c] = new Map();
      for (const w of words) bump(ctx[c], w);
    }
    if (s.mode && s.mode !== 'any') {
      if (!mode[s.mode]) mode[s.mode] = new Map();
      for (const w of words) bump(mode[s.mode], w);
    }
  }

  // Board words become unigram candidates even if the corpus never uses them.
  const boardWords = new Set();
  for (const label of opts.boardWords || []) {
    for (const w of tokenize(label)) boardWords.add(w);
  }

  // Vocabulary: BOS first, then by corpus frequency (ties alphabetical), then
  // board-only words alphabetically. Stable order keeps the JSON diff-friendly.
  const corpusWords = [...uni.keys()].sort((a, b) => (uni.get(b) - uni.get(a)) || (a < b ? -1 : 1));
  const boardOnly = [...boardWords].filter(w => !uni.has(w)).sort();
  const vocab = [BOS, ...corpusWords, ...boardOnly].filter(w => w === BOS || isPredictableWord(w));
  const id = new Map(vocab.map((w, i) => [w, i]));

  const groupRows = (map, histLen) => {
    const rows = new Map();
    for (const [key, c] of map) {
      const parts = key.split(' ');
      const hist = parts.slice(0, histLen).map(w => id.get(w)).join(',');
      if (!rows.has(hist)) rows.set(hist, []);
      rows.get(hist).push([id.get(parts[histLen]), c]);
    }
    return [...rows.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([hist, conts]) => [
        ...hist.split(',').map(Number),
        ...conts.sort((x, y) => (y[1] - x[1]) || (x[0] - y[0])).flat(),
      ]);
  };

  const flatCounts = (map) => [...map.entries()]
    .map(([w, c]) => [id.get(w), c])
    .sort((a, b) => a[0] - b[0])
    .flat();

  const display = {};
  for (const [w, forms] of caps) {
    const [best, n] = [...forms.entries()].sort((a, b) => b[1] - a[1])[0];
    // Only keep a capitalised form if it is the usual mid-sentence spelling.
    if (n * 2 >= (uni.get(w) || 0)) display[w] = best;
  }

  return {
    format: 'voice-ngram',
    version: 1,
    ...(opts.meta || {}),
    vocab,
    uni: vocab.map(w => uni.get(w) || 0),
    bi: groupRows(bi, 1),
    tri: groupRows(tri, 2),
    ctx: Object.fromEntries(Object.keys(ctx).sort().map(c => [c, flatCounts(ctx[c])])),
    mode: Object.fromEntries(Object.keys(mode).sort().map(m => [m, flatCounts(mode[m])])),
    board: [...boardWords].map(w => id.get(w)).filter(i => i !== undefined).sort((a, b) => a - b),
    display,
  };
}
