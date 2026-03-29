// src/services/customVocabStore.js
// Local-first store for caregiver-managed custom vocabulary.
// Custom words appear alongside core vocabulary on the AAC Board.
//
// Storage strategy:
// - AsyncStorage is the primary store (always works offline)
// - Firebase syncs when a user is logged in (non-blocking)
// - On load: reads local first, then merges remote if available
// - On write: saves locally immediately, then pushes to Firebase

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set as fbSet, get as fbGet } from 'firebase/database';

const CUSTOM_VOCAB_KEY = '@aac_custom_vocab';
const VOCAB_REQUESTS_KEY = '@aac_vocab_requests';

const CATEGORY_COLORS = {
  pronoun:   { color: '#FFF9C4', textColor: '#000' },
  verb:      { color: '#C8E6C9', textColor: '#000' },
  adjective: { color: '#BBDEFB', textColor: '#000' },
  noun:      { color: '#FFE0B2', textColor: '#000' },
  social:    { color: '#F8BBD0', textColor: '#000' },
  important: { color: '#FFCDD2', textColor: '#000' },
  misc:      { color: '#EEEEEE', textColor: '#000' },
};

let customItems = [];
let loaded = false;

// ── Load ──

export async function loadCustomVocab() {
  if (loaded) return customItems;

  // 1. Local first (instant, offline-safe)
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_VOCAB_KEY);
    customItems = raw ? JSON.parse(raw) : [];
  } catch {
    customItems = [];
  }
  loaded = true;

  // 2. Merge remote (non-blocking)
  await mergeRemote();

  return customItems;
}

/**
 * Force a fresh read from Firebase and merge into local state.
 * Call from pull-to-refresh in VocabManagerScreen.
 */
export async function refreshFromFirebase() {
  await mergeRemote();
  return customItems;
}

async function mergeRemote() {
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    const db = getDatabase();
    const snap = await fbGet(ref(db, `customVocab/${uid}`));
    if (!snap.exists()) return;
    const remote = snap.val();
    if (!Array.isArray(remote)) return;

    const localById = new Map(customItems.map(i => [i.id, i]));
    let changed = false;

    for (const remoteItem of remote) {
      const local = localById.get(remoteItem.id);
      if (!local) {
        // New remote item — add it
        customItems.push(remoteItem);
        changed = true;
      } else if ((remoteItem.updatedAt || 0) > (local.updatedAt || 0)) {
        // Remote is newer — update local fields
        local.word = remoteItem.word;
        local.category = remoteItem.category;
        local.updatedAt = remoteItem.updatedAt;
        changed = true;
      }
    }

    if (changed) await saveLocal();
  } catch {
    // Firebase unavailable — local data is fine
  }
}

export function getCustomVocab() {
  return customItems;
}

export function getCustomButtons() {
  return customItems.map(item => {
    const cat = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.misc;
    return {
      id: `custom_${item.id}`,
      label: item.word,
      category: item.category,
      color: cat.color,
      textColor: cat.textColor,
    };
  });
}

// ── Add ──

export async function addCustomVocabItem(word, category = 'noun', source = 'manual') {
  if (!word || typeof word !== 'string') return null;
  const trimmed = word.trim().toLowerCase();
  if (!trimmed) return null;
  if (customItems.some(item => item.word === trimmed)) return null;

  const entry = {
    id: Date.now().toString(),
    word: trimmed,
    category,
    source,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  customItems.push(entry);
  await saveLocal();
  syncToFirebase();
  return entry;
}

// ── Edit ──

export async function updateCustomVocabItem(id, updates) {
  const item = customItems.find(i => i.id === id);
  if (!item) return null;

  if (updates.word !== undefined) {
    const trimmed = updates.word.trim().toLowerCase();
    if (!trimmed) return null;
    // Check for duplicate (another item with same word)
    if (customItems.some(i => i.id !== id && i.word === trimmed)) return null;
    item.word = trimmed;
  }
  if (updates.category !== undefined) {
    item.category = updates.category;
  }
  item.updatedAt = Date.now();

  await saveLocal();
  syncToFirebase();
  return item;
}

// ── Remove ──

export async function removeCustomVocabItem(id) {
  customItems = customItems.filter(item => item.id !== id);
  await saveLocal();
  syncToFirebase();
}

// ── Vocabulary requests ──

export async function getVocabRequests() {
  // Local first
  let requests = {};
  try {
    const raw = await AsyncStorage.getItem(VOCAB_REQUESTS_KEY);
    requests = raw ? JSON.parse(raw) : {};
  } catch { /* */ }

  // Merge remote requests if logged in
  try {
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      const db = getDatabase();
      const snap = await fbGet(ref(db, `vocabRequests/${uid}`));
      if (snap.exists()) {
        const remote = snap.val() || {};
        // Merge: keep the more recent timestamp for each term
        for (const [term, ts] of Object.entries(remote)) {
          if (!requests[term] || ts > requests[term]) {
            requests[term] = ts;
          }
        }
        await AsyncStorage.setItem(VOCAB_REQUESTS_KEY, JSON.stringify(requests));
      }
    }
  } catch { /* Firebase unavailable */ }

  return requests;
}

export async function dismissVocabRequest(term) {
  try {
    const raw = await AsyncStorage.getItem(VOCAB_REQUESTS_KEY);
    const requests = raw ? JSON.parse(raw) : {};
    delete requests[term];
    await AsyncStorage.setItem(VOCAB_REQUESTS_KEY, JSON.stringify(requests));
  } catch { /* */ }

  // Also remove from Firebase
  try {
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      const db = getDatabase();
      const snap = await fbGet(ref(db, `vocabRequests/${uid}`));
      if (snap.exists()) {
        const remote = snap.val() || {};
        delete remote[term];
        await fbSet(ref(db, `vocabRequests/${uid}`), remote);
      }
    }
  } catch { /* */ }
}

// ── Persistence ──

async function saveLocal() {
  try {
    await AsyncStorage.setItem(CUSTOM_VOCAB_KEY, JSON.stringify(customItems));
  } catch (e) {
    console.warn('Failed to save custom vocab locally:', e);
  }
}

function syncToFirebase() {
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    const db = getDatabase();
    fbSet(ref(db, `customVocab/${uid}`), customItems).catch(() => {});
  } catch { /* non-blocking */ }
}
