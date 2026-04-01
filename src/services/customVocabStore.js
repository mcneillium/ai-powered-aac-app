// src/services/customVocabStore.js
// Local-first store for caregiver-managed custom vocabulary.
// Custom words appear alongside core vocabulary on the AAC Board.
//
// Storage:
// - AsyncStorage: primary (always works offline)
// - Firebase /customVocab/{uid}: { items: [...], deletedIds: { id: timestamp } }
// - On load: local first, then merge remote
// - On write: save locally, then push to Firebase (non-blocking)
//
// Deletion safety:
// - Deleted item IDs are tracked in a deletedIds set
// - mergeRemote skips any remote item whose ID is in deletedIds
// - deletedIds syncs to Firebase so other devices respect deletions

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set as fbSet, get as fbGet } from 'firebase/database';

const CUSTOM_VOCAB_KEY = '@aac_custom_vocab';
const DELETED_IDS_KEY = '@aac_custom_vocab_deleted';
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
let deletedIds = {}; // { id: timestamp } — tombstone map
let loaded = false;

// ── Load ──

export async function loadCustomVocab() {
  if (loaded) return customItems;

  // 1. Local first
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_VOCAB_KEY);
    customItems = raw ? JSON.parse(raw) : [];
  } catch {
    customItems = [];
  }
  try {
    const raw = await AsyncStorage.getItem(DELETED_IDS_KEY);
    deletedIds = raw ? JSON.parse(raw) : {};
  } catch {
    deletedIds = {};
  }
  loaded = true;

  // 2. Merge remote
  await mergeRemote();

  return customItems;
}

export async function refreshFromFirebase() {
  await mergeRemote();
  return customItems;
}

async function mergeRemote() {
  // Conflict policy: DELETE ALWAYS WINS.
  // If any device has deleted an item, it stays deleted everywhere,
  // regardless of edit timestamps on other devices. This prevents
  // caregivers from seeing words reappear after intentional removal.
  //
  // Merge order enforces this:
  //   1. Merge deletedIds from both sides (union, keep newest timestamp)
  //   2. Remove local items that appear in the merged deletedIds
  //   3. Merge remote items, skipping any in deletedIds
  //   4. Prune tombstones older than 30 days (keeps the set bounded)
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    const db = getDatabase();
    const snap = await fbGet(ref(db, `customVocab/${uid}`));
    if (!snap.exists()) return;
    const remote = snap.val();

    // Step 1: Merge deletedIds (union, keep newest timestamp per ID)
    const remoteDeleted = remote.deletedIds || {};
    let deletedChanged = false;
    for (const [id, ts] of Object.entries(remoteDeleted)) {
      if (!deletedIds[id] || ts > deletedIds[id]) {
        deletedIds[id] = ts;
        deletedChanged = true;
      }
    }

    // Step 2: Remove local items that were deleted on another device
    const beforeCount = customItems.length;
    customItems = customItems.filter(i => !deletedIds[i.id]);
    if (customItems.length !== beforeCount) deletedChanged = true;

    // Step 3: Merge remote items (skip tombstoned)
    const remoteItems = Array.isArray(remote.items) ? remote.items : (Array.isArray(remote) ? remote : []);
    const localById = new Map(customItems.map(i => [i.id, i]));
    let itemsChanged = false;

    for (const remoteItem of remoteItems) {
      if (deletedIds[remoteItem.id]) continue; // delete wins

      const local = localById.get(remoteItem.id);
      if (!local) {
        customItems.push(remoteItem);
        itemsChanged = true;
      } else if ((remoteItem.updatedAt || 0) > (local.updatedAt || 0)) {
        local.word = remoteItem.word;
        local.category = remoteItem.category;
        local.updatedAt = remoteItem.updatedAt;
        itemsChanged = true;
      }
    }

    // Step 4: Prune tombstones older than 30 days
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - THIRTY_DAYS;
    for (const [id, ts] of Object.entries(deletedIds)) {
      if (ts < cutoff) {
        delete deletedIds[id];
        deletedChanged = true;
      }
    }

    if (itemsChanged || deletedChanged) {
      await saveLocal();
    }
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

// ── Remove (with tombstone) ──

export async function removeCustomVocabItem(id) {
  customItems = customItems.filter(item => item.id !== id);
  deletedIds[id] = Date.now();
  await saveLocal();
  syncToFirebase();
}

// ── Vocabulary requests ──

export async function getVocabRequests() {
  let requests = {};
  try {
    const raw = await AsyncStorage.getItem(VOCAB_REQUESTS_KEY);
    requests = raw ? JSON.parse(raw) : {};
  } catch { /* */ }

  try {
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      const db = getDatabase();
      const snap = await fbGet(ref(db, `vocabRequests/${uid}`));
      if (snap.exists()) {
        const remote = snap.val() || {};
        for (const [term, ts] of Object.entries(remote)) {
          if (!requests[term] || ts > requests[term]) {
            requests[term] = ts;
          }
        }
        await AsyncStorage.setItem(VOCAB_REQUESTS_KEY, JSON.stringify(requests));
      }
    }
  } catch { /* */ }

  return requests;
}

export async function dismissVocabRequest(term) {
  try {
    const raw = await AsyncStorage.getItem(VOCAB_REQUESTS_KEY);
    const requests = raw ? JSON.parse(raw) : {};
    delete requests[term];
    await AsyncStorage.setItem(VOCAB_REQUESTS_KEY, JSON.stringify(requests));
  } catch { /* */ }

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
    await AsyncStorage.setItem(DELETED_IDS_KEY, JSON.stringify(deletedIds));
  } catch (e) {
    console.warn('Failed to save custom vocab locally:', e);
  }
}

function syncToFirebase() {
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    const db = getDatabase();
    fbSet(ref(db, `customVocab/${uid}`), {
      items: customItems,
      deletedIds: deletedIds,
    }).catch(() => {});
  } catch { /* non-blocking */ }
}
