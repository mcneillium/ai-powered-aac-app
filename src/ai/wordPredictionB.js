// src/ai/wordPredictionB.js
// Loads TFJS Model B from assets/tf_model/word_prediction_tfjs and serves next-word predictions.

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MODEL_JSON = require('../../assets/tf_model/word_prediction_tfjs/model.json');
const MODEL_BIN  = [require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin')];
const TOKENIZER_JSON = require('../../assets/tf_model/word_prediction_tfjs/tokenizer.json');

let model = null;
let tokenizer = null;
let wordIndex = null;  // { word: id }
let indexWord = null;  // { "id": "word" }
let ready = false;

const log = (...args) => console.log('[WordPredB]', ...args);

function normalizeTokenizer(raw) {
  let wi = raw?.word_index || raw?.wordIndex || raw?.config?.word_index || raw?.config?.wordIndex;
  let iw = raw?.index_word || raw?.indexWord || raw?.config?.index_word || raw?.config?.indexWord;

  if (iw && Array.isArray(iw)) {
    const obj = {};
    iw.forEach((w, i) => { if (w != null) obj[String(i)] = w; });
    iw = obj;
  }
  if (iw && typeof iw === 'object') {
    const fixed = {};
    Object.keys(iw).forEach(k => { fixed[String(k)] = iw[k]; });
    iw = fixed;
  }
  if (!wi || !iw) throw new Error('Tokenizer missing word_index or index_word.');
  return { wordIndex: wi, indexWord: iw };
}

function wordsToTokens(words, seqLen = 4) {
  const tokens = Array(seqLen).fill(0);
  const last = words.slice(-seqLen);
  const start = seqLen - last.length;
  for (let i = 0; i < last.length; i++) {
    const w = (last[i] || '').toLowerCase().trim();
    tokens[start + i] = wordIndex[w] || 0; // 0 = PAD/OOV
  }
  return tokens;
}

function topKIndices(arr, k = 4) {
  const idxs = Array.from({ length: arr.length }, (_, i) => i);
  idxs.sort((a, b) => arr[b] - arr[a]);
  return idxs.slice(0, k);
}

export async function initWordPredictionB() {
  if (ready) return;

  try { await AsyncStorage.removeItem('wordPredictionModel'); } catch {}

  await tf.ready();
  try {
    if (tf.backend() !== 'rn-webgl') {
      await tf.setBackend('rn-webgl');
      await tf.ready();
    }
  } catch (e) {
    log('Backend set error (fallback):', e?.message || e);
  }

  log('Loading Model B…');
  model = await tf.loadLayersModel(bundleResourceIO(MODEL_JSON, MODEL_BIN));
  log('✅ Model B loaded:', model.inputs[0].shape, '→', model.outputs[0].shape);

  const norm = normalizeTokenizer(TOKENIZER_JSON);
  wordIndex = norm.wordIndex;
  indexWord = norm.indexWord;
  tokenizer = TOKENIZER_JSON;
  log('✅ Tokenizer loaded. vocab ≈', Object.keys(wordIndex).length);

  ready = true;
}

export async function getAISuggestionsB(wordsSoFar, topK = 4) {
  if (!ready || !model || !indexWord) {
    log('Model not ready. Call initWordPredictionB() first.');
    return [];
  }
  const seqLen = model.inputs?.[0]?.shape?.[1] || 4;
  const tokens = wordsToTokens(wordsSoFar, seqLen);

  await tf.nextFrame();
  tf.engine().startScope();
  let probs;
  try {
    const input = tf.tensor2d([tokens], [1, seqLen]);
    const logits = model.predict(input);
    const soft = tf.softmax(logits, -1);
    probs = await soft.data();
  } catch (e) {
    log('❌ Prediction error:', e?.message || e);
    tf.engine().endScope();
    return [];
  }
  tf.engine().endScope();

  const idxs = topKIndices(probs, topK);
  return idxs
    .map(id => ({ id, word: indexWord[String(id)] || '<unk>', prob: probs[id] }))
    .filter(r => r.id !== 0 && r.word !== '<pad>');
}

export function disposeWordPredictionB() {
  try { model?.dispose(); } catch {}
  model = null; ready = false;
  log('Disposed Model B');
}
