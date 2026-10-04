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
  clearPersonalData, DEFAULT_PROFILE_ID,
} from './prediction/index.js';
import { personalFromLegacyProfile } from './prediction/legacyImport.js';

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

/** Learned words for "What Voice has learned": [{ word, display, uses }]. */
export function getLearnedWords(limit = 60) {
  try { return predictor.getLearnedWords ? predictor.getLearnedWords(limit) : []; } catch { return []; }
}

// User edits wait for stored data to finish loading; otherwise the load
// would replace the edited layer and bring back what was just removed.
const loaded = () => (initPromise || Promise.resolve());

export async function forgetLearnedWord(word) {
  await loaded();
  try { await predictor.forgetLearnedWord(word); } catch { /* optional */ }
  notify();
}

/** "Don't suggest" entries: [{ prev, word }]. */
export function getDismissedSuggestions() {
  try { return predictor.getDismissed ? predictor.getDismissed() : []; } catch { return []; }
}

export async function undismissSuggestion(prev, word) {
  await loaded();
  try { await predictor.undismissSuggestion(prev, word); } catch { /* optional */ }
  notify();
}

export async function resetLearning() {
  await loaded();
  if (predictor.resetPersonal) await predictor.resetPersonal();
  // Also when stored data could not be loaded (memory-only predictor).
  await clearPersonalData(DEFAULT_PROFILE_ID);
  notify();
}

/**
 * One-time carry-over of an earlier version's learning (see legacyImport.js).
 * Only fills an empty personal layer, so it can never overwrite anything
 * learned by this version. Returns true when something was imported.
 */
export async function importLegacyLearning(profile) {
  await initPrediction();
  try {
    const s = predictor.getPersonalStats();
    if ((s.sentences || 0) > 0 || (s.words || 0) > 0) return false;
    const json = personalFromLegacyProfile(profile);
    if (!json || !predictor.importPersonal) return false;
    const ok = await predictor.importPersonal(json);
    notify();
    return !!ok;
  } catch {
    return false;
  }
}

export function flushPrediction() {
  return predictor.flush ? predictor.flush() : Promise.resolve();
}
