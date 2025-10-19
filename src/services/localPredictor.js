// src/services/localPredictor.js
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

let _model = null;
let _wordIndex = null;
let _indexWord = null;
let _padToken = 0;
let _oovToken = 1;
let _seqLen = 4;

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

// -------------------------------------------------------------
// 🧠 Initialize TF backend, load model & tokenizer once
// -------------------------------------------------------------
export async function ensureImprovedModelLoaded() {
  if (_model && _wordIndex && _indexWord) return true;

  console.log('[TFJS] Initializing backend...');
  try {
    await tf.ready();
    try {
      await tf.setBackend('rn-webgl');
    } catch {
      await tf.setBackend('cpu');
    }
    console.log('[TFJS] Backend ready:', tf.getBackend());
  } catch (err) {
    console.warn('[TFJS] Backend init failed:', err);
  }

  // ✅ Load model
  const modelJson = require('../../assets/tf_model/word_prediction_tfjs/model.json');
  const weights = [
    require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin'),
  ];

  try {
    _model = await tf.loadLayersModel(bundleResourceIO(modelJson, weights));
    console.log('[TFJS] Model loaded successfully.');
  } catch (err) {
    console.error('[TFJS] Model load failed:', err);
    throw err;
  }

  // detect sequence length automatically
  try {
    const shape = _model?.inputs?.[0]?.shape;
    if (Array.isArray(shape) && Number.isInteger(shape[1])) {
      _seqLen = shape[1];
      console.log('[TFJS] Model input sequence length:', _seqLen);
    }
  } catch {}

  // ✅ Load tokenizer
  const tkn = require('../../assets/childes_model/crowdsourced_aac_tokenizer.json');

  _wordIndex =
    tkn.word_index ||
    tkn.wordIndex ||
    tkn.config?.word_index ||
    tkn.config?.wordIndex ||
    {};
  _indexWord =
    tkn.index_word ||
    tkn.indexWord ||
    tkn.config?.index_word ||
    tkn.config?.indexWord ||
    {};

  console.log('[Tokenizer] word_index size:', Object.keys(_wordIndex).length);
  console.log('[Tokenizer] index_word size:', Object.keys(_indexWord).length);

  if (typeof tkn.pad_token_id === 'number') _padToken = tkn.pad_token_id;
  if (typeof tkn.oov_token_id === 'number') _oovToken = tkn.oov_token_id;

  // Warm up
  tf.tidy(() => {
    const warm = tf.tensor2d([Array(_seqLen).fill(_padToken)], [1, _seqLen]);
    _model.predict(warm);
  });

  console.log('[TFJS] Warm-up complete.');
  return true;
}

// -------------------------------------------------------------
// 🎯 Predict top-K next words
// -------------------------------------------------------------
export async function predictTopKWordsWithImprovedModel(
  model,
  _unusedTokenizer,
  sentence,
  temperature = 0.8,
  seqLen = _seqLen,
  topK = 5
) {
  await ensureImprovedModelLoaded();
  const m = model || _model;
  const L = seqLen || _seqLen;

  const words = safeSplit(sentence);
  const tokens = wordsToTokens(words);
  const ctx = toContext(tokens, L);
  const cacheKey = ctx.join('-');
  if (_ctxCache.has(cacheKey)) return _ctxCache.get(cacheKey);

  console.log('[TFJS] Predicting for context:', ctx);

  let logits;
  await tf.nextFrame();
  logits = await tf.tidy(() => {
    const x = tf.tensor2d([ctx], [1, L]);
    const out = m.predict(x);

    console.log('[TFJS] Prediction output shape:', out.shape);
    if (out.shape?.length > 1) {
      const firstTen = Array.from(out.dataSync()).slice(0, 10);
      console.log('[TFJS] First 10 logits:', firstTen);
    }

    return out.dataSync();
  });

  const candidates = sampleTopK(logits, { temperature, topK })
    .map(id => {
      const w = tokenToWord(id);
      console.log('[TFJS] Candidate ID → Word:', id, '→', w);
      return w;
    })
    .filter(Boolean)
    .slice(0, topK);

  console.log('[TFJS] Final candidates:', candidates);

  _remember(cacheKey, candidates);
  return candidates;
}

// -------------------------------------------------------------
// Utility helpers
// -------------------------------------------------------------
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
  return words.map(w => _wordIndex[w] ?? _oovToken);
}

function tokenToWord(id) {
  const w = _indexWord[String(id)];
  if (!w || w === '<pad>' || w === '<unk>' || w === '<eos>') return null;
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
  const scaled = Array.from(logits, v => v / Math.max(1e-6, temperature));
  const probs = softmaxStable(scaled);
  const idxs = probs.map((p, i) => [i, p]).sort((a, b) => b[1] - a[1]).slice(0, topK);

  const chosen = [];
  const pool = idxs.map(([i, p]) => ({ i, p }));
  const sum = pool.reduce((a, b) => a + b.p, 0) || 1;

  while (chosen.length < Math.min(topK, pool.length)) {
    let r = Math.random();
    for (const { i, p } of pool) {
      r -= p / sum;
      if (r <= 0) {
        chosen.push(i);
        const k = pool.findIndex(o => o.i === i);
        if (k >= 0) pool.splice(k, 1);
        break;
      }
    }
    if (!pool.length) break;
  }
  return chosen;
}
