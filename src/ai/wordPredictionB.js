// File: src/ai/wordPredictionB.js
// Purpose: Load TFJS Model B from assets/tf_model/word_prediction_tfjs and provide next-word predictions.

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** ---------- Configuration (Model B paths) ---------- */
const MODEL_JSON = require('../../assets/tf_model/word_prediction_tfjs/model.json');
const MODEL_BIN  = [require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin')];

// If you keep a tokenizer alongside the model, point here.
// If your project uses another tokenizer path, you can switch the require.
const TOKENIZER_JSON = require('../../assets/tf_model/word_prediction_tfjs/tokenizer.json');

/** ---------- Module State ---------- */
let model = null;
let tokenizer = null;
let wordIndex = null;    // { "word": integer_id }
let indexWord = null;    // { "integer_id": "word" }
let isReady = false;

/** ---------- Utilities ---------- */
const log = (...args) => console.log('[WordPredB]', ...args);

/**
 * Load tokenizer JSON and normalize structure.
 * Supports either:
 *  - { word_index: {...}, index_word: {...} }  (preferred)
 *  - or nested under config, or via keys like "wordIndex"/"indexWord"
 */
function normalizeTokenizer(raw) {
  let wi = raw?.word_index || raw?.wordIndex || raw?.config?.word_index || raw?.config?.wordIndex;
  let iw = raw?.index_word || raw?.indexWord || raw?.config?.index_word || raw?.config?.indexWord;

  // If indexWord comes as an array or numeric keys, ensure string keys
  if (iw && Array.isArray(iw)) {
    // convert array -> object { "1": "the", "2": "to", ... }
    const obj = {};
    iw.forEach((w, i) => { if (w != null) obj[String(i)] = w; });
    iw = obj;
  }

  // Some exports use number keys as numbers. Convert to strings for safety.
  if (iw && typeof iw === 'object') {
    const fixed = {};
    Object.keys(iw).forEach(k => { fixed[String(k)] = iw[k]; });
    iw = fixed;
  }

  if (!wi || !iw) {
    throw new Error('Tokenizer missing word_index or index_word.');
  }
  return { wordIndex: wi, indexWord: iw };
}

/**
 * Convert the last N words into a fixed-length integer token array.
 * Pads with 0 on the left if fewer than seqLen tokens.
 */
function wordsToTokens(words, seqLen = 4) {
  const tokens = Array(seqLen).fill(0);
  const last = words.slice(-seqLen);
  const start = seqLen - last.length;
  for (let i = 0; i < last.length; i++) {
    const w = (last[i] || '').toLowerCase().trim();
    tokens[start + i] = wordIndex[w] || 0; // 0 for OOV/pad
  }
  return tokens;
}

/**
 * Return topK indices from a Float32Array of probabilities.
 */
function topKIndices(arr, k = 4) {
  // Simple partial sort
  const idxs = Array.from({ length: arr.length }, (_, i) => i);
  idxs.sort((a, b) => arr[b] - arr[a]);
  return idxs.slice(0, k);
}

/** ---------- Public API ---------- */

/**
 * Initialize TF backend, load Model B + tokenizer.
 * Call this once (e.g., in App.js) before requesting predictions.
 */
export async function initWordPredictionB() {
  if (isReady) return;

  // 0) Fresh start: avoid stale cached model blobs from older experiments
  try { await AsyncStorage.removeItem('wordPredictionModel'); } catch {}

  // 1) Ensure TFJS is ready and use RN WebGL if available
  await tf.ready();
  try {
    if (tf.backend() !== 'rn-webgl') {
      await tf.setBackend('rn-webgl'); // falls back to 'cpu' if unsupported
      await tf.ready();
    }
  } catch (e) {
    log('Backend set error (falling back to default):', e?.message || e);
  }

  // 2) Load Model B (paths must match weightsManifest order)
  log('Loading Model B from bundled assets...');
  model = await tf.loadLayersModel(bundleResourceIO(MODEL_JSON, MODEL_BIN));
  log('✅ Model B loaded:', model.inputs[0].shape, '→', model.outputs[0].shape);

  // 3) Load tokenizer JSON
  try {
    const raw = TOKENIZER_JSON; // Metro bundles JSON at build time
    const norm = normalizeTokenizer(raw);
    wordIndex = norm.wordIndex;
    indexWord = norm.indexWord;
    tokenizer = raw;
    log('✅ Tokenizer loaded. vocab size ≈', Object.keys(wordIndex).length);
  } catch (e) {
    log('⚠️ Tokenizer load/normalize failed:', e?.message || e);
    // You can still use the model with numeric tokens, but predictions to words need indexWord.
    throw e;
  }

  isReady = true;
}

/**
 * Get AI suggestions for the next word.
 * @param {string[]} wordsSoFar - array of prior words (e.g., ['i','want'])
 * @param {number} topK - number of suggestions to return
 * @returns {Promise<Array<{word: string, prob: number, id: number}>>}
 */
export async function getAISuggestionsB(wordsSoFar, topK = 4) {
  if (!isReady || !model || !indexWord) {
    log('Model not ready. Call initWordPredictionB() first.');
    return [];
  }

  // 1) Build fixed-length input of shape [1, 4] (project expects 4-token input)
  const seqLen = model.inputs?.[0]?.shape?.[1] || 4; // fallback to 4
  const tokens = wordsToTokens(wordsSoFar, seqLen);

  // 2) Run inference
  let probs;
  await tf.nextFrame(); // yield to UI
  tf.engine().startScope();
  try {
    const input = tf.tensor2d([tokens], [1, seqLen]); // shape [1, seqLen]
    const logits = model.predict(input);              // shape [1, vocab]
    const soft = tf.softmax(logits, -1);             // normalize
    probs = await soft.data();                        // Float32Array
  } catch (e) {
    log('❌ Prediction error:', e?.message || e);
    tf.engine().endScope();
    return [];
  }
  tf.engine().endScope();

  if (!probs || !probs.length) return [];

  // 3) Top-K decode
  const idxs = topKIndices(probs, topK);
  const results = idxs.map((id) => ({
    id,
    word: indexWord[String(id)] || '<unk>',
    prob: probs[id],
  }));

  // 4) Filter out padding/OOV if your vocab uses id=0 for PAD
  const cleaned = results.filter(r => r.id !== 0 && r.word !== '<pad>');
  return cleaned;
}

/**
 * Optional: Free GPU/CPU resources if you hot-reload a lot.
 */
export async function disposeWordPredictionB() {
  try {
    model?.dispose();
    model = null;
    isReady = false;
    log('Disposed Model B');
  } catch {}
}

/** ---------- Example usage ----------
 * // In App.js (or a top-level provider)
 * useEffect(() => {
 *   initWordPredictionB().catch(err => console.warn(err));
 * }, []);
 *
 * // In your screen/component:
 * const suggestions = await getAISuggestionsB(['i','want'], 4);
 * ------------------------------------- */
