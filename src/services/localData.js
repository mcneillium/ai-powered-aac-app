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
import { loadAIProfile, resetAIProfile } from './aiProfileStore';
import { CORRUPT_SUFFIX } from '../utils/safeStorage';
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

/** Learned data kept by earlier versions (no longer written). */
export const LEGACY_LEARNED_KEYS = ['wordPredictionModel', 'wordFrequencyModel'];

/** Settings and housekeeping keys (removed only with the account). */
export const SETTINGS_KEYS = ['@aac_settings', 'currentSessionId', 'lastActivity', 'logLevel'];

/**
 * Delete personal data on this device: messages, favourites, custom words
 * and their photos, pronunciations and everything learned. Settings stay
 * unless includeSettings is true. Stores are reloaded so open screens see
 * the empty state.
 */
/**
 * "Delete what Voice has learned": the prediction engine's personal layer
 * and the older usage profile (word counts, pairs, phrases) that Insights
 * reads. Words, favourites and history are not touched.
 */
export async function deleteLearnedData() {
  await Promise.all([resetLearning(), resetAIProfile()].map((p) => Promise.resolve(p).catch(() => {})));
  // Learned data from earlier versions of the app.
  await AsyncStorage.multiRemove(LEGACY_LEARNED_KEYS).catch(() => {});
}

export async function deleteLocalPersonalData({ includeSettings = false } = {}) {
  // Every tile photo, not only those of words still in the list: a word
  // removed elsewhere can leave its photo behind.
  await removeAllTilePhotos().catch(() => {});
  await resetLearning().catch(() => {});
  // Clear the usage profile in memory first, so a background flush cannot
  // write the old profile back after the keys are removed.
  await resetAIProfile().catch(() => {});
  const keys = includeSettings ? [...PERSONAL_KEYS, ...SETTINGS_KEYS] : PERSONAL_KEYS;
  // Also the backups safeStorage keeps of unreadable data: they hold the
  // same personal content.
  await AsyncStorage.multiRemove([...keys, ...keys.map((k) => `${k}${CORRUPT_SUFFIX}`)]).catch(() => {});
  await Promise.all([
    loadFavourites({ reload: true }), loadSentenceHistory({ reload: true }),
    loadCustomVocab({ reload: true }), loadPronunciations({ reload: true }),
    loadTilePhotos(), loadAIProfile(),
  ].map((p) => Promise.resolve(p).catch(() => {})));
}
