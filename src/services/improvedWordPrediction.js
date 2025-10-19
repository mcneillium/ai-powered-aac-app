// improvedWordPrediction.js
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

let model = null;
let tokenizer = null;
let wordIndex = null;   // { "i": 1, "want": 2, ... }
let indexWord = null;   // { "1": "i", "2": "want", ... }
let padToken = 0;       // adjust if your PAD is different
let oovToken = 1;       // adjust if your OOV is different

const ctxCache = new Map();
const MAX_CACHE = 200;

// Simple LRU behaviour
function remember(key, value) {
  if (ctxCache.has(key)) ctxCache.delete(key);
  ctxCache.set(key, value);
  if (ctxCache.size > MAX_CACHE) {
    const first = ctxCache.keys().next().value;
    ctxCache.delete(first);
  }
}

export async function initWordPredictor() {
  if (model && tokenizer) return true;

  // 1) Load model (names must match model.json)
  const modelJson = require('../assets/tf_model/word_prediction_tfjs/model.json');
  const weights = [
    require('../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin'),
  ];
  model = await tf.loadLayersModel(bundleResourceIO(modelJson, weights));

  // 2) Load tokenizer JSON with top-level word_index & index_word
  const tkn = require('../assets/childes_model/crowdsourced_aac_tokenizer.json');
  wordIndex = tkn.word_index || tkn.wordIndex || {};
  indexWord = tkn.index_word || tkn.indexWord || {};
  tokenizer = { wordIndex, indexWord };

  // 3) Warm-up (batch of zeros with expected shape [1,4])
  tf.tidy(() => {
    const warm = tf.tensor2d([[padToken, padToken, padToken, padToken]], [1,4]);
    model.predict(warm);
  });

  return true;
}

// Utility: convert array of tokens to padded length 4
function toContext(tokens, contextSize=4) {
  const arr = [...tokens];
  if (arr.length > contextSize) {
    return arr.slice(arr.length - contextSize);
  }
  while (arr.length < contextSize) arr.unshift(padToken);
  return arr;
}

// Temperature + top-k + top-p sampling
function sampleFromLogits(logits, {temperature=0.8, topK=8, topP=0.9}) {
  // logits: Float32Array
  const scores = Float32Array.from(logits, v => v / Math.max(1e-6, temperature));

  // Convert to probs (softmax) in a numerically stable way
  const maxLogit = Math.max(...scores);
  const exps = scores.map(v => Math.exp(v - maxLogit));
  const sumExp = exps.reduce((a,b) => a+b, 0);
  let probs = exps.map(v => v / sumExp);

  // Apply top-k
  const idxs = probs.map((p,i)=>[i,p]).sort((a,b)=>b[1]-a[1]);
  const topKCut = idxs.slice(0, topK);

  // Apply top-p (nucleus)
  let cum = 0;
  const nucleus = [];
  for (const [i,p] of topKCut) {
    nucleus.push([i,p]);
    cum += p;
    if (cum >= topP) break;
  }

  // Renormalize within nucleus
  const nucleusSum = nucleus.reduce((a, [,p])=>a+p, 0) || 1;
  const renorm = nucleus.map(([i,p]) => [i, p / nucleusSum]);

  // Draw
  let r = Math.random();
  for (const [i,p] of renorm) {
    if ((r -= p) <= 0) return i;
  }
  return renorm[renorm.length - 1][0];
}

export function wordsToTokens(words=[]) {
  return words.map(w => {
    const key = String(w).trim().toLowerCase();
    return wordIndex[key] ?? oovToken;
  });
}

export function tokenToWord(id) {
  const w = indexWord[String(id)];
  return (w && w !== '<pad>' && w !== '<unk>') ? w : null;
}

export async function predictNextTokens(tokens, {
  k=4,                    // return top k candidates
  temperature=0.8,
  topK=12,
  topP=0.9,
  banned = [],           // words to avoid in AAC context if needed
} = {}) {
  if (!model || !tokenizer) {
    const ok = await initWordPredictor();
    if (!ok) return [];
  }

  const context = toContext(tokens, 4);
  const cacheKey = context.join('-');
  if (ctxCache.has(cacheKey)) return ctxCache.get(cacheKey);

  let logits;
  await tf.nextFrame(); // yield to keep UI smooth
  logits = await tf.tidy(() => {
    const x = tf.tensor2d([context], [1,4]);
    const out = model.predict(x);
    return out.dataSync(); // Float32Array
  });

  // Convert logits → ranked candidates with robust sampling
  const chosen = [];
  const used = new Set();
  const bannedSet = new Set(banned.map(s => s.toLowerCase()));

  for (let i=0; i<Math.max(1,k*2); i++) { // oversample then filter
    const id = sampleFromLogits(logits, {temperature, topK, topP});
    if (used.has(id)) continue;
    used.add(id);
    const w = tokenToWord(id);
    if (!w) continue;
    if (bannedSet.has(w.toLowerCase())) continue;
    if (w === '<eos>' || w === '<pad>' || w === '<unk>') continue;
    chosen.push({ id, word: w });
    if (chosen.length >= k) break;
  }

  remember(cacheKey, chosen);
  return chosen;
}

// Convenience for your UI: return just words
export async function suggestWordsFor(prefixWords=[], opts={}) {
  const tokens = wordsToTokens(prefixWords);
  const cands = await predictNextTokens(tokens, opts);
  return cands.map(c => c.word);
}
