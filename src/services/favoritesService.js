// Enhanced favorites service with Firebase sync and symbol metadata.
// Local-first: AsyncStorage is primary, Firebase syncs when available.
// Each favorite stores the sentence, words, symbol sources, and usage stats.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { db } from '../../firebaseConfig';
import { DB_PATHS, dbPath } from '../shared/schema';
import { wordToHexcode } from '../data/symbolAssetMap';

const STORAGE_KEY = '@aac_favorites_v2';
let favorites = [];
let loaded = false;
let firebaseUnsub = null;

function buildSymbolMeta(words) {
  return words.map(w => {
    const hex = wordToHexcode[w.toLowerCase()];
    return { word: w, source: hex ? 'openmoji' : 'none', hexcode: hex || null };
  });
}

function categorize(sentence) {
  const lower = sentence.toLowerCase();
  if (/^i want|^can i have|^give me|^more .* please/.test(lower)) return 'wants';
  if (/^i feel|^i am (happy|sad|angry|scared|tired|excited|sick)/.test(lower)) return 'feelings';
  if (/\?$|^where|^what|^when|^can we|^how/.test(lower)) return 'questions';
  if (/^hello|^hi |^bye|^thank|^sorry|^my name/.test(lower)) return 'social';
  if (/^i need|^help|^i have to/.test(lower)) return 'needs';
  return 'other';
}

export async function loadFavorites() {
  if (loaded) return favorites;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    favorites = raw ? JSON.parse(raw) : [];
    loaded = true;
  } catch {
    favorites = [];
    loaded = true;
  }
  return favorites;
}

export function getFavorites() {
  return favorites;
}

export function getTopFavorites(limit = 3) {
  return [...favorites]
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    .slice(0, limit);
}

export function getFavoritesByCategory(category) {
  return favorites.filter(f => f.category === category);
}

export async function addFavorite(sentence, uid = null) {
  if (!sentence || typeof sentence !== 'string') return null;
  const trimmed = sentence.trim();
  if (!trimmed) return null;
  if (favorites.some(f => f.sentence === trimmed)) return null;

  const words = trimmed.split(' ');
  const entry = {
    id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sentence: trimmed,
    words,
    symbols: buildSymbolMeta(words),
    category: categorize(trimmed),
    usageCount: 1,
    lastUsed: Date.now(),
    createdAt: Date.now(),
  };

  favorites.unshift(entry);
  if (favorites.length > 100) favorites = favorites.slice(0, 100);
  await saveFavorites();

  if (uid) syncFavoriteToFirebase(uid, entry).catch(() => {});
  return entry;
}

export async function removeFavorite(id, uid = null) {
  favorites = favorites.filter(f => f.id !== id);
  await saveFavorites();
  if (uid) removeFavoriteFromFirebase(uid, id).catch(() => {});
}

export async function incrementFavoriteUsage(id) {
  const fav = favorites.find(f => f.id === id);
  if (fav) {
    fav.usageCount = (fav.usageCount || 1) + 1;
    fav.lastUsed = Date.now();
    await saveFavorites();
  }
}

export function isFavorite(sentence) {
  return favorites.some(f => f.sentence === sentence);
}

export function subscribeToFirebaseFavorites(uid) {
  if (firebaseUnsub) firebaseUnsub();
  if (!uid) return;

  try {
    const favRef = ref(db, dbPath(DB_PATHS.FAVORITES, uid));
    firebaseUnsub = onValue(favRef, (snapshot) => {
      if (snapshot.exists()) {
        const remote = snapshot.val();
        const remoteFavs = Object.entries(remote).map(([key, val]) => ({ ...val, firebaseKey: key }));
        mergeRemoteFavorites(remoteFavs);
      }
    }, () => {});
  } catch {}
}

function mergeRemoteFavorites(remoteFavs) {
  const localSentences = new Set(favorites.map(f => f.sentence));
  let changed = false;
  for (const remote of remoteFavs) {
    if (!localSentences.has(remote.sentence)) {
      favorites.push(remote);
      changed = true;
    }
  }
  if (changed) {
    favorites.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    saveFavorites().catch(() => {});
  }
}

async function syncFavoriteToFirebase(uid, entry) {
  try {
    const favRef = push(ref(db, dbPath(DB_PATHS.FAVORITES, uid)));
    await set(favRef, {
      sentence: entry.sentence,
      words: entry.words,
      symbols: entry.symbols,
      category: entry.category,
      usageCount: entry.usageCount,
      lastUsed: entry.lastUsed,
      createdAt: entry.createdAt,
    });
  } catch {}
}

async function removeFavoriteFromFirebase(uid, id) {
  try {
    const fav = favorites.find(f => f.id === id);
    if (fav?.firebaseKey) {
      await remove(ref(db, dbPath(DB_PATHS.FAVORITES, uid, fav.firebaseKey)));
    }
  } catch {}
}

async function saveFavorites() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {}
}

export function unsubscribeFromFirebase() {
  if (firebaseUnsub) { firebaseUnsub(); firebaseUnsub = null; }
}
