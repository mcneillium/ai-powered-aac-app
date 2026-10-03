// src/services/prediction/baseIndex.js
// Turns the compact baseModel.json ("voice-ngram" v1, see buildModel.js) into
// Maps for fast lookups. Done once per model object and cached.

import { BOS } from './tokenize.js';

const cache = new WeakMap();

function rowsToMap(rows, histLen, vocab) {
  const map = new Map(); // history -> { conts: Map(word -> count), total, n }
  for (const row of rows || []) {
    const hist = row.slice(0, histLen).map(i => vocab[i]).join(' ');
    const conts = new Map();
    let total = 0;
    for (let j = histLen; j + 1 < row.length; j += 2) {
      const w = vocab[row[j]];
      if (w === undefined || w === BOS) continue;
      conts.set(w, row[j + 1]);
      total += row[j + 1];
    }
    if (conts.size) map.set(hist, { conts, total, n: conts.size });
  }
  return map;
}

function flatToMap(flat, vocab) {
  const map = new Map();
  let total = 0;
  for (let j = 0; j + 1 < (flat || []).length; j += 2) {
    const w = vocab[flat[j]];
    if (w === undefined || w === BOS) continue;
    map.set(w, flat[j + 1]);
    total += flat[j + 1];
  }
  return { map, total };
}

/**
 * @param {object} json  parsed baseModel.json
 * @returns {object} indexed base model
 */
export function indexBaseModel(json) {
  if (json && json.__indexed) return json;
  if (cache.has(json)) return cache.get(json);
  if (!json || json.format !== 'voice-ngram' || !Array.isArray(json.vocab)) {
    throw new Error('Not a voice-ngram base model');
  }
  const { vocab } = json;
  const uni = new Map();
  let uniTotal = 0;
  vocab.forEach((w, i) => {
    if (i === 0 || w === BOS) return;
    const c = json.uni[i] || 0;
    uni.set(w, c);
    uniTotal += c;
  });
  // Per-topic unigram counts. `distinct` holds the words that are at least
  // twice as common in that topic's sentences as overall — those are the
  // ones that get the topic boost (so "to" or "I" never count as "work" words).
  const ctx = {};
  for (const [id, flat] of Object.entries(json.ctx || {})) {
    const info = flatToMap(flat, vocab);
    const share = uniTotal > 0 ? info.total / uniTotal : 0;
    info.distinct = new Set();
    for (const [w, c] of info.map) {
      const u = uni.get(w) || 0;
      if (u > 0 && c / u >= 2 * share) info.distinct.add(w);
    }
    ctx[id] = info;
  }
  const mode = {};
  for (const [id, flat] of Object.entries(json.mode || {})) mode[id] = flatToMap(flat, vocab);

  const indexed = {
    __indexed: true,
    vocab: vocab.filter((w, i) => i > 0 && w !== BOS),
    uni,
    uniTotal,
    bi: rowsToMap(json.bi, 1, vocab),
    tri: rowsToMap(json.tri, 2, vocab),
    ctx,
    mode,
    board: new Set((json.board || []).map(i => vocab[i]).filter(Boolean)),
    display: json.display || {},
  };
  cache.set(json, indexed);
  return indexed;
}
