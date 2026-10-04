// src/services/prediction/legacyImport.js
// Carries learning from earlier versions into the personal prediction layer,
// so someone who was already learning does not lose their suggestions.
//
// Earlier versions kept on-device counts in '@aac_ai_profile'. The phrases
// in it (2–6 word sequences) are the closest match to this layer's rule of
// learning from messages, so only phrases used at least twice are carried
// over, each counted at most MAX_REPEATS times. Single taps and failed
// searches are not imported. Pure functions; nothing leaves the device.
//
// How those phrase counts were made matters: every tap (with learning on)
// added a window of the last 2–4 words, and Speak added the whole message.
// A message of 2–4 words therefore gained 2 per time it was spoken (its last
// tap's window + Speak), and a window that was tapped and then deleted
// gained 1. So for 2–4 word phrases the number of uses is count / 2; only
// 5–6 word phrases (too long for a tap window) count 1 per message. This
// still cannot tell a phrase tapped (and deleted) 4+ times from one spoken
// twice: the old store kept no way to separate them.

import { createPersonalState, learnSentence, exportPersonalState } from './personalModel.js';
import { tokenize } from './tokenize.js';

export const LEGACY_PROFILE_KEY = '@aac_ai_profile';
const MIN_USES = 2;
const TAP_WINDOW_MAX = 4; // earlier builds' per-tap window: up to 4 words

/** Estimated times a legacy phrase was spoken (see above). */
export function legacyPhraseUses(phrase, count) {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return 0;
  const n = String(phrase).trim().split(/\s+/).length;
  return Math.floor(n <= TAP_WINDOW_MAX ? count / 2 : count);
}
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
    .map(([phrase, c]) => [phrase, legacyPhraseUses(phrase, c)])
    .filter(([, uses]) => uses >= MIN_USES)
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, MAX_PHRASES);
  const state = createPersonalState();
  for (const [phrase, uses] of phrases) {
    const toks = tokenize(phrase);
    if (toks.length < 2) continue;
    for (let i = 0; i < Math.min(uses, MAX_REPEATS); i++) {
      learnSentence(state, toks, Math.min(recency, now));
    }
  }
  return state.sentences > 0 ? exportPersonalState(state) : null;
}
