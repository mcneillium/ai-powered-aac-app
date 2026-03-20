// src/services/localPredictor.js
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

let _model = null;
let _wordIndex = null;
let _indexWord = null;
let _padToken = 0;
let _oovToken = 1;
let _seqLen = 16;

// Simple LRU-ish cache
const _ctxCache = new Map();
const _MAX_CACHE = 200;

const _remember = (k, v) => {
  if (_ctxCache.has(k)) _ctxCache.delete(k);
  _ctxCache.set(k, v);
  if (_ctxCache.size > _MAX_CACHE) {
    const first = _ctxCache.keys().next().value;
    _ctxCache.delete(first);
  }
};

function invertMap(obj) {
  const out = {};
  for (const [w, i] of Object.entries(obj || {})) out[String(i)] = w;
  return out;
}

function safeSplit(s = '') {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[“”"‘’]/g, "'")
    .replace(/[^a-z0-9' \-]/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function wordsToTokens(words = []) {
  return words.map(w => {
    const id = _wordIndex?.[w];
    return Number.isInteger(id) ? id : _oovToken;
  });
}

function tokenToWord(id) {
  const w = _indexWord?.[String(id)];
  if (!w || w === '<pad>' || w === '<unk>' || w === '<oov>' || w === '<eos>') return null;
  return w;
}

function toContext(tokens, L) {
  const arr = [...tokens];
  if (arr.length > L) return arr.slice(arr.length - L);
  while (arr.length < L) arr.unshift(_padToken);
  return arr;
}

function softmaxStable(arr) {
  const max = Math.max(...arr);
  const exps = arr.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map(v => v / sum);
}

function sampleTopK(logits, { temperature = 0.8, topK = 8 }) {
  const scaled = logits.map(v => v / Math.max(1e-6, temperature));
  const probs = softmaxStable(scaled);
  const sorted = probs
    .map((p, i) => [i, p])
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);
  return sorted.map(([i]) => i);
}

// -------------------------------------------------------------
// TFJS model + tokenizer loader
// -------------------------------------------------------------
export async function ensureImprovedModelLoaded() {
  if (_model && _wordIndex && _indexWord) return true;

  console.log('[TFJS] Initializing backend…');
  await tf.ready();
  try { await tf.setBackend('rn-webgl'); } catch { await tf.setBackend('cpu'); }
  console.log('[TFJS] Backend:', tf.getBackend());

  // ---------------------------
  // TFJS model.json & weights
  // ---------------------------
  const modelJson = require('../../assets/childes_model/model.json');

  // --- YOUR 21 SHARDS (verified) ---
  const weights = [
    require('../../assets/childes_model/group1-shard1of21.bin'),
    require('../../assets/childes_model/group1-shard2of21.bin'),
    require('../../assets/childes_model/group1-shard3of21.bin'),
    require('../../assets/childes_model/group1-shard4of21.bin'),
    require('../../assets/childes_model/group1-shard5of21.bin'),
    require('../../assets/childes_model/group1-shard6of21.bin'),
    require('../../assets/childes_model/group1-shard7of21.bin'),
    require('../../assets/childes_model/group1-shard8of21.bin'),
    require('../../assets/childes_model/group1-shard9of21.bin'),
    require('../../assets/childes_model/group1-shard10of21.bin'),
    require('../../assets/childes_model/group1-shard11of21.bin'),
    require('../../assets/childes_model/group1-shard12of21.bin'),
    require('../../assets/childes_model/group1-shard13of21.bin'),
    require('../../assets/childes_model/group1-shard14of21.bin'),
    require('../../assets/childes_model/group1-shard15of21.bin'),
    require('../../assets/childes_model/group1-shard16of21.bin'),
    require('../../assets/childes_model/group1-shard17of21.bin'),
    require('../../assets/childes_model/group1-shard18of21.bin'),
    require('../../assets/childes_model/group1-shard19of21.bin'),
    require('../../assets/childes_model/group1-shard20of21.bin'),
    require('../../assets/childes_model/group1-shard21of21.bin'),
  ];

  // ---------------------------
  // Load TFJS model
  // ---------------------------
  try {
    _model = await tf.loadLayersModel(bundleResourceIO(modelJson, weights));
    console.log('[TFJS] Model loaded.');
  } catch (err) {
    console.error('[TFJS] Model load failed:', err);
    throw err;
  }

  // Detect sequence length
  try {
    const shape = _model?.inputs?.[0]?.shape;
    if (Array.isArray(shape) && Number.isInteger(shape[1])) {
      _seqLen = shape[1];
      console.log('[TFJS] Detected SEQ_LEN =', _seqLen);
    }
  } catch {}

  // ---------------------------
  // Tokenizer JSON
  // ---------------------------
  try {
    const tokAsset = Asset.fromModule(require('../../assets/childes_model/tokenizer.json'));
    await tokAsset.downloadAsync();
    const tokJsonStr = await FileSystem.readAsStringAsync(tokAsset.localUri);
    let tkn = {};
    try { tkn = JSON.parse(tokJsonStr); } catch {}
    const cfg = tkn?.config || tkn || {};
    _wordIndex = cfg.word_index || cfg.wordIndex || {};
    _indexWord = cfg.index_word || cfg.indexWord || invertMap(_wordIndex);

    if (typeof cfg.pad_token_id === 'number') _padToken = cfg.pad_token_id;
    if (typeof cfg.oov_token_id === 'number') _oovToken = cfg.oov_token_id;

    console.log('[Tokenizer] word_index size:', Object.keys(_wordIndex).length);
    console.log('[Tokenizer] index_word size:', Object.keys(_indexWord).length);
  } catch (e) {
    console.warn('[Tokenizer] Failed to load tokenizer.json:', e?.message || e);
    _wordIndex = {};
    _indexWord = {};
  }

  // Warm up model
  tf.tidy(() => {
    const warm = tf.tensor2d([Array(_seqLen).fill(_padToken)], [1, _seqLen], 'int32');
    _model.predict(warm);
  });

  console.log('[TFJS] Warm-up complete.');
  return true;
}

// -------------------------------------------------------------
// Prediction API
// -------------------------------------------------------------
export async function predictTopKWordsWithImprovedModel(
  sentence,
  topK = 5,
  { temperature = 0.8, seqLen } = {}
) {
  await ensureImprovedModelLoaded();
  const m = _model;
  const L = seqLen || _seqLen;

  const words = safeSplit(sentence);
  const tokens = wordsToTokens(words);
  const ctx = toContext(tokens, L);

  const key = ctx.join('-');
  if (_ctxCache.has(key)) return _ctxCache.get(key);

  const logits = await tf.tidy(() => {
    const x = tf.tensor2d([ctx], [1, L], 'int32');
    const out = m.predict(x);
    return Array.from(out.dataSync());
  });

  const ids = sampleTopK(logits, { temperature, topK });
  const candidates = ids
    .map(id => tokenToWord(id))
    .filter(Boolean)
    .slice(0, topK);

  _remember(key, candidates);
  return candidates;
}

// -------------------------------------------------------------
// Personalized prediction: blends model output with user profile
// -------------------------------------------------------------
export async function predictPersonalized(sentence, topK = 7) {
  let aiProfileStore;
  try {
    aiProfileStore = require('./aiProfileStore');
  } catch {
    // AI profile not available — fall back to model-only predictions
    return predictTopKWordsWithImprovedModel(sentence, topK);
  }

  const words = safeSplit(sentence);
  const prevWord = words.length > 0 ? words[words.length - 1] : null;

  // Get model predictions
  let modelCandidates = [];
  try {
    modelCandidates = await predictTopKWordsWithImprovedModel(sentence, topK * 2);
  } catch {
    // Model failed — use profile-only predictions
  }

  // Get bigram predictions from user profile
  const bigramPreds = prevWord
    ? aiProfileStore.getBigramPredictions(prevWord, 5)
    : [];

  // Merge: model candidates + bigram predictions (deduplicated)
  const seen = new Set();
  const merged = [];

  // Bigram predictions first (user's own patterns are highest signal)
  for (const w of bigramPreds) {
    const lw = w.toLowerCase();
    if (!seen.has(lw)) {
      seen.add(lw);
      merged.push(lw);
    }
  }

  // Then model predictions
  for (const w of modelCandidates) {
    const lw = (typeof w === 'string' ? w : '').toLowerCase();
    if (lw && !seen.has(lw)) {
      seen.add(lw);
      merged.push(lw);
    }
  }

  // Score by frequency + recency and sort
  if (merged.length > 0 && typeof aiProfileStore.scoreByFrequencyAndRecency === 'function') {
    const scored = aiProfileStore.scoreByFrequencyAndRecency(merged);
    return scored.slice(0, topK).map(s => s.word);
  }

  return merged.slice(0, topK);
}
