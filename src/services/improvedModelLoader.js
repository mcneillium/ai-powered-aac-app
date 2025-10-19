// src/services/improvedModelLoader.js
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- ASSET HANDLES (MODEL B) -------------------------------------------------
// IMPORTANT: These must match your model.json exactly.
import modelJsonObj from '../../assets/tf_model/word_prediction_tfjs/model.json';
const modelJsonRes = require('../../assets/tf_model/word_prediction_tfjs/model.json');
const modelWeightResList = [
  require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin'),
];

// Use ONLY the canonical tokenizer for Model B
const tokenizerData = require('../../assets/tf_model/word_prediction_tfjs/tokenizer.json');

// --- INTERNAL STATE ----------------------------------------------------------
let model = null;
let tokenizer = null;
let indexToWord = null;
let wordIndex = null;

// Default; we’ll still auto-detect from model input if available
const CONTEXT_LEN = 4;

let __ready = false;
let __loaderPromise = null;

// --- HELPERS -----------------------------------------------------------------
async function initTf() {
  await tf.ready();
  try { await tf.setBackend('rn-webgl'); } catch { await tf.setBackend('cpu'); }
}

function leftPadZeros(arr, target) {
  const a = (arr || []).slice(-target);
  const pad = Math.max(0, target - a.length);
  return [...Array(pad).fill(0), ...a];
}

function buildMaps(tok) {
  const wi = tok?.word_index || tok?.wordIndex || tok?.config?.word_index || tok?.config?.wordIndex || null;
  let  iw = tok?.index_word || tok?.indexWord || tok?.config?.index_word || tok?.config?.indexWord || null;

  // If indexWord came as an array, convert to object
  if (Array.isArray(iw)) {
    const obj = {};
    iw.forEach((w, i) => { if (w != null) obj[String(i)] = w; });
    iw = obj;
  }

  if (wi && iw) return { wordIndex: wi, indexToWord: iw };

  // Flat map fallback
  const wordIndexGuess = {};
  const indexToWordGuess = {};
  for (const [k, v] of Object.entries(tok || {})) {
    if (typeof v === 'number') {
      wordIndexGuess[k] = v;
      indexToWordGuess[String(v)] = k;
    }
  }
  return { wordIndex: wordIndexGuess, indexToWord: indexToWordGuess };
}

function softmaxWithTemp(logits, temperature = 1.0) {
  const t = Math.max(1e-6, temperature);
  let maxLogit = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    const v = logits[i] / t;
    if (v > maxLogit) maxLogit = v;
    logits[i] = v;
  }
  let denom = 0;
  for (let i = 0; i < logits.length; i++) {
    logits[i] = Math.exp(logits[i] - maxLogit);
    denom += logits[i];
  }
  for (let i = 0; i < logits.length; i++) logits[i] /= denom || 1;
  return logits;
}

function getLastStepLogits(t) {
  if (t.rank === 2) return t.squeeze(); // [vocab]
  if (t.rank === 3) {
    const T = t.shape[1];
    const last = t.slice([0, T - 1, 0], [1, 1, t.shape[2]]);
    const s = last.squeeze();
    last.dispose();
    return s;
  }
  throw new Error(`Unexpected output rank ${t.rank}; expected 2 or 3.`);
}

function idxToToken(idx) {
  return indexToWord?.[String(idx)] ?? '[UNKNOWN]';
}

// --- PUBLIC: LOADING + READINESS --------------------------------------------
export async function loadImprovedModel() {
  await initTf();

  // Avoid stale remote cache collisions
  try { await AsyncStorage.removeItem('wordPredictionModel'); } catch {}

  // Sanity-check model.json
  const format = modelJsonObj?.format;
  const manifest = modelJsonObj?.weightsManifest;
  if (format !== 'layers-model') {
    throw new Error(
      `model.json format is "${format}" (expected "layers-model"). ` +
      `Reconvert as a tfjs_layers_model or swap to tf.loadGraphModel().`
    );
  }
  const expectedPaths = manifest?.[0]?.paths || [];
  if (!expectedPaths.length) {
    throw new Error('model.json has no weightsManifest paths.');
  }
  if ((modelWeightResList?.length || 0) !== expectedPaths.length) {
    throw new Error(
      `Shard count mismatch. model.json expects ${expectedPaths.length}: ${JSON.stringify(expectedPaths)} ` +
      `but code provides ${modelWeightResList.length}.`
    );
  }

  console.log('[TFJS] manifest paths:', modelJsonObj?.weightsManifest?.[0]?.paths);
  console.log('[TFJS] code shards:', modelWeightResList.map(() => 'group1-shard1of1.bin'));

  // Load model (Model B)
  try {
    model = await tf.loadLayersModel(bundleResourceIO(modelJsonRes, modelWeightResList));
    console.log('✅ Improved model (Model B) loaded!');
    console.log('[TFJS] IO shapes:', model.inputs?.[0]?.shape, '→', model.outputs?.[0]?.shape);
  } catch (err) {
    throw new Error(
      `Failed to load layers model. This usually means the .bin file(s) do NOT belong to this model.json.\n` +
      `Expected shards: ${JSON.stringify(expectedPaths)}.\n` +
      `Fix: ensure Metro bundles .bin, delete stale assets/tf_model/*.bin, and clear cache. Original: ${err}`
    );
  }

  // Tokenizer maps
  tokenizer = tokenizerData;
  const maps = buildMaps(tokenizer);
  wordIndex = maps.wordIndex;
  indexToWord = maps.indexToWord;

  if (!Object.keys(wordIndex).length || !Object.keys(indexToWord).length) {
    throw new Error('Tokenizer missing usable word_index/index_word mappings.');
  }

  // Warmup with detected context length (if available)
  try {
    const seqLen = model.inputs?.[0]?.shape?.[1] || CONTEXT_LEN;
    const dummy = tf.tensor2d([leftPadZeros([], seqLen)], [1, seqLen], 'int32');
    const out = model.predict(dummy);
    (Array.isArray(out) ? out : [out]).forEach(t => t?.dispose?.());
    dummy.dispose();
  } catch (e) {
    console.warn('Model warmup failed (check expected input shape):', e);
  }

  // Globals for legacy code paths
  global.betterWordPredictionModel = model;
  global.tokenizer = tokenizer;
  global.indexToWord = indexToWord;
  global.predictNextWordWithImprovedModel = predictNextWordWithImprovedModel;

  __ready = true;
  return { model, tokenizer };
}

// Call this when you want to ensure model is loaded (idempotent).
export async function ensureImprovedModelLoaded() {
  if (__ready && model && tokenizer) return;
  if (__loaderPromise) { await __loaderPromise; return; }
  __loaderPromise = (async () => {
    await loadImprovedModel();
  })().finally(() => { __loaderPromise = null; });
  await __loaderPromise;
}

export function isImprovedModelReady() {
  return !!(__ready && model && tokenizer);
}

export async function waitUntilModelReady(timeoutMs = 5000, pollMs = 100) {
  const deadline = Date.now() + timeoutMs;
  // Kick off a load in case nothing started it yet
  await ensureImprovedModelLoaded();

  while (!isImprovedModelReady()) {
    if (Date.now() > deadline) {
      throw new Error('Model or tokenizer still not loaded after waiting.');
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
}

// --- PUBLIC: PREDICT ---------------------------------------------------------
export async function predictNextWordWithImprovedModel(
  mdl,
  tok,
  sentence,
  temperature = 1.0,
  sequenceLength = CONTEXT_LEN
) {
  mdl = mdl || model;
  tok = tok || tokenizer;

  if (!mdl || !tok) {
    await ensureImprovedModelLoaded();
    mdl = model; tok = tokenizer;
  }

  const tokens = String(sentence || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const seqLen = mdl.inputs?.[0]?.shape?.[1] || sequenceLength;
  const last = tokens.slice(-seqLen);
  const idxs = leftPadZeros(last.map(w => (wordIndex?.[w] ?? tok.word_index?.[w] ?? tok[w] ?? 0)), seqLen);

  const input = tf.tensor2d([idxs], [1, seqLen], 'int32');

  let logits1d;
  try {
    const out = mdl.predict(input);
    const outTensor = Array.isArray(out) ? out[0] : out;
    logits1d = getLastStepLogits(outTensor);
  } finally {
    input.dispose();
  }

  const probs = softmaxWithTemp(Float32Array.from(logits1d.dataSync()), temperature);
  logits1d.dispose();

  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  return idxToToken(best);
}

export async function predictTopKWordsWithImprovedModel(
  mdl,
  tok,
  sentence,
  temperature = 1.5,
  sequenceLength = CONTEXT_LEN,
  topK = 4
) {
  mdl = mdl || model;
  tok = tok || tokenizer;

  if (!mdl || !tok) {
    await ensureImprovedModelLoaded();
    mdl = model; tok = tokenizer;
  }

  const tokens = String(sentence || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const seqLen = mdl.inputs?.[0]?.shape?.[1] || sequenceLength;
  const last = tokens.slice(-seqLen);
  const idxs = leftPadZeros(last.map(w => (wordIndex?.[w] ?? tok.word_index?.[w] ?? tok[w] ?? 0)), seqLen);

  const input = tf.tensor2d([idxs], [1, seqLen], 'int32');

  let logits1d;
  try {
    const out = mdl.predict(input);
    const outTensor = Array.isArray(out) ? out[0] : out;
    logits1d = getLastStepLogits(outTensor);
  } finally {
    input.dispose();
  }

  const probs = softmaxWithTemp(Float32Array.from(logits1d.dataSync()), temperature);
  logits1d.dispose();

  const idxsSorted = Array.from(probs.keys())
    .sort((a, b) => probs[b] - probs[a])
    .slice(0, Math.max(1, topK));
  return idxsSorted.map(i => idxToToken(i));
}
