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

export { createPredictor, CONTEXTS, MODES, DEFAULT_WEIGHTS, personalKey, DEFAULT_PROFILE_ID };
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
  const stored = await loadPersonalData(profileId);

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

  return {
    ...predictor,
    profileId,
    setLearningEnabled(v) {
      predictor.setLearningEnabled(v);
      // Keep whatever was learned while it was on; just stop learning more.
      if (!predictor.isLearningEnabled()) saver.flush();
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
