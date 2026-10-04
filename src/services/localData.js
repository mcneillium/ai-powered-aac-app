// src/services/localData.js
// One list of everything personal Voice keeps on this device, so "delete my
// data" and account deletion remove all of it — including stores added in
// Voice 2 (learned prediction data, tile photos).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { personalKey, DEFAULT_PROFILE_ID } from './prediction/index.js';
import { resetLearning } from './suggestionEngine';
import { loadFavourites } from './favouritesStore';
import { loadSentenceHistory } from './sentenceHistoryStore';
import { loadCustomVocab } from './customVocabStore';
import { loadPronunciations } from './pronunciationStore';
import { loadTilePhotos, removeAllTilePhotos } from './tilePhotoStore';
import { loadAIProfile } from './aiProfileStore';
import { DRAFT_KEY } from './sentenceDraft';

/** Messages, words and what was learned from them. */
export const PERSONAL_KEYS = [
  '@aac_sentence_history',
  '@aac_favourites',
  '@aac_custom_vocab',
  '@aac_custom_vocab_deleted',
  '@aac_vocab_requests',
  '@aac_pronunciations',
  '@aac_ai_profile',
  '@aac_feedback_queue',
  'userInteractionLog',
  'wordPredictionModel',
  'wordFrequencyModel',
  'savedEmotion',
  DRAFT_KEY,
  personalKey(DEFAULT_PROFILE_ID),
];

/** Settings and housekeeping keys (removed only with the account). */
export const SETTINGS_KEYS = ['@aac_settings', 'currentSessionId', 'lastActivity', 'logLevel'];

/**
 * Delete personal data on this device: messages, favourites, custom words
 * and their photos, pronunciations and everything learned. Settings stay
 * unless includeSettings is true. Stores are reloaded so open screens see
 * the empty state.
 */
export async function deleteLocalPersonalData({ includeSettings = false } = {}) {
  // Every tile photo, not only those of words still in the list: a word
  // removed elsewhere can leave its photo behind.
  await removeAllTilePhotos().catch(() => {});
  await resetLearning().catch(() => {});
  const keys = includeSettings ? [...PERSONAL_KEYS, ...SETTINGS_KEYS] : PERSONAL_KEYS;
  await AsyncStorage.multiRemove(keys).catch(() => {});
  await Promise.all([
    loadFavourites({ reload: true }), loadSentenceHistory({ reload: true }),
    loadCustomVocab({ reload: true }), loadPronunciations({ reload: true }),
    loadTilePhotos(), loadAIProfile(),
  ].map((p) => Promise.resolve(p).catch(() => {})));
}
