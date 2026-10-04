// src/services/prediction/legacyImport.js
// Carries learning from earlier versions into the personal prediction layer,
// so someone who was already learning does not lose their suggestions.
//
// Earlier versions kept on-device counts in '@aac_ai_profile'. The phrases
// in it (2–6 word sequences) are the closest match to this layer's rule of
// learning from messages, so only phrases used at least twice are carried
// over, each counted at most MAX_REPEATS times. Single taps and failed
// searches are not imported. Pure functions; nothing leaves the device.

import { createPersonalState, learnSentence, exportPersonalState } from './personalModel.js';
import { tokenize } from './tokenize.js';

export const LEGACY_PROFILE_KEY = '@aac_ai_profile';
const MIN_COUNT = 2;
const MAX_REPEATS = 10;
const MAX_PHRASES = 200;

/** True when an earlier version's profile holds anything learned. */
export function hasLegacyLearning(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return (profile.totalWordSelections || 0) > 0
    || Object.keys(profile.phraseFrequencies || {}).length > 0
    || Object.keys(profile.bigrams || {}).length > 0;
}

/**
 * Personal-layer export built from an earlier profile, or null when there is
 * nothing worth carrying over.
 */
export function personalFromLegacyProfile(profile, now = Date.now()) {
  if (!profile || typeof profile !== 'object') return null;
  const recency = profile.updatedAt || now;
  const phrases = Object.entries(profile.phraseFrequencies || {})
    .filter(([, c]) => typeof c === 'number' && c >= MIN_COUNT)
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, MAX_PHRASES);
  const state = createPersonalState();
  for (const [phrase, count] of phrases) {
    const toks = tokenize(phrase);
    if (toks.length < 2) continue;
    for (let i = 0; i < Math.min(count, MAX_REPEATS); i++) {
      learnSentence(state, toks, Math.min(recency, now));
    }
  }
  return state.sentences > 0 ? exportPersonalState(state) : null;
}
