// src/services/sentenceHistoryStore.js
// Persistent sentence history stored in AsyncStorage.
// Survives app restarts. Used by AACBoardScreen and history views.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParse } from '../utils/safeStorage';
import { isAccountDeletionPaused, accountDataGeneration, trackAccountDataOperation } from './accountDeletionBarrier';

const STORAGE_KEY = '@aac_sentence_history';
const MAX_ENTRIES = 100;

let history = [];
let loaded = false;

export function loadSentenceHistory(options = {}) {
  // Only the deletion reload may read while paused; screen loads keep the
  // existing memory and cannot start a late corrupt-data backup.
  if (isAccountDeletionPaused() && !options.reload) return Promise.resolve(history);
  return trackAccountDataOperation(runLoadSentenceHistory(options));
}

async function runLoadSentenceHistory({ reload = false } = {}) {
  const generation = accountDataGeneration();
  if (loaded && !reload) return history;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (generation !== accountDataGeneration()) return history;
    const parsed = await safeParse(STORAGE_KEY, raw, []);
    if (generation !== accountDataGeneration()) return history;
    history = parsed;
    if (!Array.isArray(history)) history = [];
    loaded = true;
  } catch {
    if (generation !== accountDataGeneration()) return history;
    history = [];
    loaded = true;
  }
  return history;
}

export function getSentenceHistory() {
  return history;
}

export async function addSentenceToHistory(text) {
  if (isAccountDeletionPaused()) return;
  if (!text || typeof text !== 'string') return;
  const trimmed = text.trim();
  if (!trimmed) return;

  // Remove duplicate if exists (move to top)
  history = history.filter(h => h.text !== trimmed);

  history.unshift({
    text: trimmed,
    timestamp: Date.now(),
    speakCount: 1,
  });

  if (history.length > MAX_ENTRIES) history = history.slice(0, MAX_ENTRIES);

  await saveHistory();
}

export async function incrementSpeakCount(text) {
  if (isAccountDeletionPaused()) return;
  const entry = history.find(h => h.text === text);
  if (entry) {
    entry.speakCount = (entry.speakCount || 1) + 1;
    entry.timestamp = Date.now();
    await saveHistory();
  }
}

export async function clearSentenceHistory() {
  if (isAccountDeletionPaused()) return;
  history = [];
  await saveHistory();
}

export function getFrequentSentences(limit = 10) {
  return [...history]
    .sort((a, b) => (b.speakCount || 1) - (a.speakCount || 1))
    .slice(0, limit);
}

async function saveHistory() {
  if (isAccountDeletionPaused()) return;
  try {
    await trackAccountDataOperation(AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history)));
  } catch (e) {
    console.warn('Failed to save sentence history:', e);
  }
}
