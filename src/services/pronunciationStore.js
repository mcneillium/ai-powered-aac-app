// src/services/pronunciationStore.js
// User-editable pronunciation dictionary ("say X as Y").
//
// Device text-to-speech engines have no SSML support through expo-speech, so
// pronunciation is corrected by substituting text just before it is spoken.
// The words shown on screen and saved to history are never changed.
//
// Matching is whole-word and case-insensitive, so "Siobhan" -> "Shivawn"
// also fixes "siobhan" but leaves "Siobhans" alone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParse } from '../utils/safeStorage';
import { isAccountDeletionPaused, accountDataGeneration, trackAccountDataOperation } from './accountDeletionBarrier';

const STORAGE_KEY = '@aac_pronunciations';
const MAX_ENTRIES = 200;
// Letters (incl. accented Latin), digits and apostrophes count as part of a word.
const WORD_CHAR = "A-Za-z0-9\\u00C0-\\u024F'";

let entries = [];
let compiled = [];
let loaded = false;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile() {
  // Longest first so "New York" wins over "New".
  compiled = [...entries]
    .sort((a, b) => b.written.length - a.written.length)
    .map(e => ({
      re: new RegExp(`(^|[^${WORD_CHAR}])${escapeRegExp(e.written)}(?=$|[^${WORD_CHAR}])`, 'gi'),
      spoken: e.spoken,
    }));
}

export function loadPronunciations(options = {}) {
  // Only the deletion reload may read while paused; screen loads keep the
  // existing memory and cannot start a late corrupt-data backup.
  if (isAccountDeletionPaused() && !options.reload) return Promise.resolve(entries);
  return trackAccountDataOperation(runLoadPronunciations(options));
}

async function runLoadPronunciations({ reload = false } = {}) {
  const generation = accountDataGeneration();
  if (loaded && !reload) return entries;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (generation !== accountDataGeneration()) return entries;
    const parsed = await safeParse(STORAGE_KEY, raw, []);
    if (generation !== accountDataGeneration()) return entries;
    entries = Array.isArray(parsed) ? parsed.filter(e => e && e.written && e.spoken) : [];
  } catch {
    if (generation !== accountDataGeneration()) return entries;
    entries = [];
  }
  loaded = true;
  compile();
  return entries;
}

export function getPronunciations() {
  return entries;
}

/**
 * Add or update a pronunciation. Returns the saved entry, or null if invalid
 * or the dictionary is full.
 */
export async function setPronunciation(written, spoken) {
  if (isAccountDeletionPaused()) return null;
  const generation = accountDataGeneration();
  const w = typeof written === 'string' ? written.trim() : '';
  const s = typeof spoken === 'string' ? spoken.trim() : '';
  if (!w || !s) return null;

  const existing = entries.find(e => e.written.toLowerCase() === w.toLowerCase());
  if (existing) {
    existing.written = w;
    existing.spoken = s;
  } else {
    if (entries.length >= MAX_ENTRIES) return null;
    entries = [...entries, { id: `pr_${Date.now()}_${entries.length}`, written: w, spoken: s }];
  }
  compile();
  await save();
  return generation === accountDataGeneration() ? entries.find(e => e.written === w) : null;
}

export async function removePronunciation(id) {
  if (isAccountDeletionPaused()) return;
  entries = entries.filter(e => e.id !== id);
  compile();
  await save();
}

/**
 * Replace written forms with their spoken forms. Pure and synchronous so it
 * adds no latency to speech.
 */
export function applyPronunciations(text) {
  if (!text || compiled.length === 0) return text;
  let out = text;
  for (const { re, spoken } of compiled) {
    out = out.replace(re, (_m, before) => `${before}${spoken}`);
  }
  return out;
}

/** Test helper: reset in-memory state. */
export function _resetPronunciationsForTests(list = []) {
  entries = list;
  loaded = true;
  compile();
}

async function save() {
  if (isAccountDeletionPaused()) return;
  try {
    await trackAccountDataOperation(AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)));
  } catch (e) {
    console.warn('Failed to save pronunciations:', e);
  }
}
