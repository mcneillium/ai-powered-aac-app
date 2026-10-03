/* eslint-env node */
// scripts/eval/existingApproach.js
// Node re-implementation of the CURRENT suggestion pipeline in
// src/screens/AACBoardScreen.js, for comparison only.
//
// Layers reproduced:
//   1. aiProfileStore bigrams  — getBigramPredictions(lastWord, 4)
//   3. static TFJS LSTM        — predictTopKWordsWithImprovedModel(..., topK 4)
//   then scoreWithExplanation() re-sorts by log(freq+1) + 2·recencyBoost,
//   and an empty sentence shows getTopWords(6).
// Layer 2 (useOnDevicePrediction, fine-tuned on taps at runtime with
// tfjs-react-native) and the cloud Vertex layer are NOT reproduced; see
// docs/ai/prediction-evaluation.md.
//
// The aiProfileStore functions below mirror src/services/aiProfileStore.js
// line for line, minus AsyncStorage, with an injectable clock. The real
// module cannot be imported here because it is bound to AsyncStorage.

const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib');

const ONE_HOUR = 3600000;
const ONE_DAY = 86400000;

function createProfile() {
  return { wordFrequencies: {}, wordRecency: {}, bigrams: {} };
}

// recordWordSelection(word, contextWords) — every TAP trains, even taps the
// user later deletes (the reason the new engine learns from Speak instead).
function recordWordSelection(profile, word, contextWords, now) {
  const w = word.toLowerCase().trim();
  profile.wordFrequencies[w] = (profile.wordFrequencies[w] || 0) + 1;
  profile.wordRecency[w] = now;
  if (contextWords.length > 0) {
    const prevWord = contextWords[contextWords.length - 1].toLowerCase().trim();
    const key = `${prevWord} ${w}`;
    profile.bigrams[key] = (profile.bigrams[key] || 0) + 1;
  }
}

function getTopWords(profile, n) {
  return Object.entries(profile.wordFrequencies).sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

function getBigramPredictions(profile, prevWord, n) {
  const prefix = prevWord.toLowerCase().trim() + ' ';
  return Object.entries(profile.bigrams)
    .filter(([key]) => key.startsWith(prefix))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key.split(' ')[1]);
}

function scoreWithExplanation(profile, candidates, now) {
  return candidates.map(word => {
    const w = word.toLowerCase();
    const freq = profile.wordFrequencies[w] || 0;
    const lastUsed = profile.wordRecency[w] || 0;
    const since = now - lastUsed;
    let boost = 0;
    if (lastUsed > 0 && since < ONE_HOUR) boost = 1.0;
    else if (lastUsed > 0 && since < ONE_DAY) boost = 0.5;
    return { word, score: Math.log(freq + 1) + boost * 2 };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Load the bundled static LSTM with @tensorflow/tfjs (pure-JS CPU backend).
 * Returns a sync predict function mirroring predictTopKWordsWithImprovedModel,
 * or null if TF cannot be loaded. Used ONLY to measure the existing app; the
 * new engine does not use this model or its tokenizer (provenance unresolved).
 */
async function loadLstm() {
  let tf;
  // tfjs prints a "use tfjs-node" banner on first use; keep it out of the report.
  const origWarn = console.warn;
  const origLog = console.log;
  console.warn = () => {};
  console.log = () => {};
  try {
    tf = require(path.join(ROOT, 'node_modules', '@tensorflow', 'tfjs'));
    await tf.setBackend('cpu');
    await tf.ready();
    const dir = path.join(ROOT, 'assets', 'tf_model', 'word_prediction_tfjs');
    const mj = JSON.parse(fs.readFileSync(path.join(dir, 'model.json'), 'utf8'));
    const buf = fs.readFileSync(path.join(dir, 'group1-shard1of1.bin'));
    const weightData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const model = await tf.loadLayersModel(tf.io.fromMemory({
      modelTopology: mj.modelTopology, weightSpecs: mj.weightsManifest[0].weights, weightData,
    }));
    const tok = JSON.parse(fs.readFileSync(path.join(dir, 'tokenizer.json'), 'utf8'));
    const idxToWord = Object.fromEntries(Object.entries(tok).map(([w, i]) => [i, w]));
    const outputSize = mj.modelTopology.model_config.config.layers.slice(-1)[0].config.units;
    const outputWords = [];
    for (let i = 0; i < outputSize; i++) if (idxToWord[i]) outputWords.push(idxToWord[i]);

    let calls = 0;
    let errors = 0;
    const predict = (sentence, topK = 4) => {
      calls++;
      const tokens = sentence.toLowerCase().split(' ');
      const input = tokens.slice(-4);
      while (input.length < 4) input.unshift('0');
      const ids = input.map(t => tok[t] || 0);
      try {
        const x = tf.tensor2d([ids], [1, 4], 'int32');
        const y = model.predict(x);
        const probs = Array.from(y.dataSync());
        x.dispose();
        y.dispose();
        return probs.map((p, i) => ({ i, p })).sort((a, b) => b.p - a.p).slice(0, topK)
          .map(o => idxToWord[o.i]).filter(w => w && w !== '[UNKNOWN]');
      } catch {
        // getAISuggestions() catches this and returns [] in the app.
        errors++;
        return [];
      }
    };
    predict('i', 1); // warm-up (also triggers the banner while silenced)
    calls = 0;
    errors = 0;
    return { predict, outputWords, stats: () => ({ calls, errors }) };
  } catch {
    return null;
  } finally {
    console.warn = origWarn;
    console.log = origLog;
  }
}

/** The suggestion list the current board would show (max 6). */
function existingSuggest(profile, lstm, contextTokens, now) {
  if (contextTokens.length === 0) return getTopWords(profile, 6);
  const last = contextTokens[contextTokens.length - 1];
  const bigram = getBigramPredictions(profile, last, 4);
  const neural = lstm ? lstm.predict(contextTokens.join(' '), 4) : [];
  const all = neural.length > 0 ? [...new Set([...bigram, ...neural])].slice(0, 6) : bigram;
  return scoreWithExplanation(profile, all, now).map(s => s.word);
}

module.exports = { createProfile, recordWordSelection, existingSuggest, loadLstm };
