// src/services/suggestionEngine.js
// Bridge between the app and the on-device prediction engine
// (src/services/prediction — n-gram base model + optional personal layer).
//
// - Suggestions work immediately from the shipped base model, before any
//   storage is read and with learning off.
// - Personal learning happens only while the user's "Learn from my
//   messages" setting is on, and only from SPOKEN messages (not taps).
// - Everything stays on this device. No sentence text is logged.

import {
  createPredictor, createPersistentPredictor, getBaseModel, getRankerWeights,
} from './prediction/index.js';

// Usable at once: base model only, nothing stored.
let predictor = createPredictor({ base: getBaseModel(), ranker: getRankerWeights(), learningEnabled: false });
let learning = false;
let initPromise = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function subscribePrediction(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Load stored personal data (if any). Safe to call more than once. */
export function initPrediction() {
  if (!initPromise) {
    initPromise = createPersistentPredictor({ learningEnabled: learning })
      // Apply the current setting: it may have changed while loading.
      .then((p) => { p.setLearningEnabled(learning); predictor = p; notify(); })
      .catch(() => { /* base predictor keeps working */ });
  }
  return initPromise;
}

export function setLearningEnabled(on) {
  learning = on === true;
  predictor.setLearningEnabled(learning);
}

/**
 * Suggestions for the words so far: [{ word, reason, source }].
 * A phrase the user often says may come first (multi-word suggestion).
 * With `prefix` (typing), completes the word being typed instead.
 */
export function suggestNext(words, { context, mode, k = 6, prefix } = {}) {
  try {
    const out = [];
    if (words.length > 0 && !prefix) {
      const phrases = predictor.predictPhrases ? predictor.predictPhrases(words, { k: 1 }) : [];
      phrases.forEach((ph) => {
        if (ph.completion && ph.completion.split(' ').length > 1) {
          out.push({ word: ph.completion, reason: ph.reason, source: 'phrase' });
        }
      });
    }
    predictor.predict(words, { k, context: context || undefined, mode, prefix: prefix || undefined }).forEach((r) => {
      if (!out.some((o) => o.word.toLowerCase() === r.label.toLowerCase())) {
        out.push({ word: r.label, reason: r.reason, source: r.source });
      }
    });
    return out.slice(0, k);
  } catch {
    return []; // predictions are optional; the board never depends on them
  }
}

export function learnFromSpoken(words) {
  if (!learning) return;
  try { predictor.learnFromSpokenSentence(words); } catch { /* optional */ }
}

export function suggestionAccepted(word, wordsBefore) {
  try { predictor.recordSuggestionAccepted(word, wordsBefore); } catch { /* optional */ }
}

/** "Don't suggest this here": hides the word after the current last word. */
export function dismissSuggestion(word, wordsBefore) {
  try { predictor.dismissSuggestion(word, wordsBefore); } catch { /* optional */ }
  notify();
}

export function getLearningStats() {
  try {
    const s = predictor.getPersonalStats();
    return { sentences: s.sentences || 0, pairs: s.wordPairs || 0, summary: s.summary };
  } catch {
    return { sentences: 0, pairs: 0, summary: 'Nothing learned yet.' };
  }
}

export async function resetLearning() {
  if (predictor.resetPersonal) await predictor.resetPersonal();
  notify();
}

export function flushPrediction() {
  return predictor.flush ? predictor.flush() : Promise.resolve();
}
