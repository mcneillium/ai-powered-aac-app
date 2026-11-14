// src/services/prediction/index.js
// Public entry point for Voice word prediction.
//
//   const predictor = await createPersistentPredictor({ profileId, learningEnabled });
//   predictor.predict(sentenceWords, { k: 6, context, mode });   // sync
//   predictor.learnFromSpokenSentence(words);                    // on Speak only
//   predictor.recordSuggestionAccepted(word, wordsBefore);
//   predictor.dismissSuggestion(word, wordsBefore);
//   await predictor.flush();                                     // on app background
//
// See docs/ai/prediction-evaluation.md for how it was measured.

import baseModelJson from './baseModel.json';
import rankerWeights from './rankerWeights.json';
import { createPredictor, CONTEXTS, MODES, DEFAULT_WEIGHTS } from './predictor.js';
import {
  loadPersonalData, savePersonalData, clearPersonalData, createDebouncedSaver,
  personalKey, DEFAULT_PROFILE_ID,
} from './personalStore.js';
import { importPersonalState, exportPersonalState, forgetWord, undismiss } from './personalModel.js';
import { tokenize } from './tokenize.js';

export { createPredictor, CONTEXTS, MODES, DEFAULT_WEIGHTS, personalKey, DEFAULT_PROFILE_ID, clearPersonalData };
export { tokenize, displayWord } from './tokenize.js';

/** The shipped base model (authored synthetic seed corpus, 0BSD). */
export function getBaseModel() {
  return baseModelJson;
}

/** The shipped reranker weights (trained offline on synthetic personas). */
export function getRankerWeights() {
  return rankerWeights;
}

/**
 * Create a predictor wired to AsyncStorage for one profile.
 *
 * - Stored personal data for the profile is loaded (and used for ranking)
 *   whenever it exists. New learning happens only while learningEnabled.
 * - Changes are saved with a debounce while learning is on. With learning off
 *   nothing is written (dismissals then last for the session only).
 * - resetPersonal() clears memory and deletes the stored key at once.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.profileId='default']
 * @param {boolean} [opts.learningEnabled=false]
 * @param {number}  [opts.debounceMs=2000]
 * @param {object}  [opts.base]   override base model (tests)
 * @param {object|null} [opts.ranker] reranker weights; default = shipped
 *                                weights, null = plain interpolation
 * @param {function}[opts.now]    clock override (tests)
 */
export async function createPersistentPredictor(opts = {}) {
  const profileId = opts.profileId || DEFAULT_PROFILE_ID;
  const saver = createDebouncedSaver(profileId, opts.debounceMs ?? 2000);
  // Throws if storage cannot be read: better no persistent layer this run
  // than an empty one that would be saved over the user's data.
  const stored = await loadPersonalData(profileId);
  const clock = opts.now || (() => Date.now());

  let predictor = null;
  predictor = createPredictor({
    base: opts.base || baseModelJson,
    personal: stored,
    learningEnabled: opts.learningEnabled === true,
    now: opts.now,
    weights: opts.weights,
    limits: opts.limits,
    ranker: opts.ranker === undefined ? rankerWeights : opts.ranker,
    onPersonalChange: (getData) => {
      if (predictor && predictor.isLearningEnabled()) saver.schedule(getData);
    },
  });

  // Save a user edit now. With learning on, memory is what should be stored.
  // While paused, memory may hold session-only changes (e.g. dismissals that
  // must not be written), so the edit is applied to the stored copy instead.
  async function saveEdit(apply) {
    if (predictor.isLearningEnabled()) {
      saver.cancel();
      await savePersonalData(profileId, predictor.exportPersonal());
      return;
    }
    await saver.flush(); // anything still due from while learning was on
    let data;
    try { data = await loadPersonalData(profileId); } catch { return; }
    const st = data && importPersonalState(data, opts.limits || {}, clock());
    if (!st) return;
    apply(st);
    await savePersonalData(profileId, exportPersonalState(st));
  }

  return {
    ...predictor,
    profileId,
    setLearningEnabled(v) {
      predictor.setLearningEnabled(v);
      // Keep whatever was learned while it was on; just stop learning more.
      if (!predictor.isLearningEnabled()) saver.flush();
    },
    // Edits the user makes to what was learned are saved straight away, even
    // with learning paused, so a forgotten word stays forgotten.
    async forgetLearnedWord(word) {
      const ok = predictor.forgetLearnedWord(word);
      if (ok) {
        const w = tokenize(word)[0] || word;
        await saveEdit((st) => forgetWord(st, w, clock()));
      }
      return ok;
    },
    async undismissSuggestion(prev, word) {
      const ok = predictor.undismissSuggestion(prev, word);
      await saveEdit((st) => undismiss(st, prev, word, clock()));
      return ok;
    },
    async resetPersonal() {
      saver.cancel();
      predictor.resetPersonal();
      saver.cancel(); // drop the save the reset itself may have scheduled
      await clearPersonalData(profileId);
    },
    async importPersonal(json) {
      const ok = predictor.importPersonal(json);
      if (ok) {
        saver.cancel();
        await savePersonalData(profileId, predictor.exportPersonal());
      }
      return ok;
    },
    /** Write any pending change now (call when the app goes to background). */
    flush() {
      return saver.flush();
    },
  };
}
