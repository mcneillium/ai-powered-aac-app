// src/services/favouritesStore.js
// Manages user favourites (pinned phrases) with local persistence.
// Favourites are stored in AsyncStorage and optionally synced to Firebase.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParse } from '../utils/safeStorage';

const STORAGE_KEY = '@aac_favourites';
// Never silently drop a saved favourite: once full, new ones are refused and
// the caller tells the user, rather than deleting the oldest.
export const MAX_FAVOURITES = 200;
let favourites = [];
let loaded = false;

export async function loadFavourites({ reload = false } = {}) {
  if (loaded && !reload) return favourites;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    favourites = await safeParse(STORAGE_KEY, raw, []);
    if (!Array.isArray(favourites)) favourites = [];
    loaded = true;
  } catch {
    favourites = [];
    loaded = true;
  }
  return favourites;
}

export function getFavourites() {
  return favourites;
}

export async function addFavourite(phrase) {
  if (!phrase || typeof phrase !== 'string') return;
  const trimmed = phrase.trim();
  if (!trimmed) return;

  // Don't add duplicates
  const existing = favourites.find(f => f.phrase === trimmed);
  if (existing) return existing;
  if (favourites.length >= MAX_FAVOURITES) return null;

  const entry = {
    id: `fav_${Date.now()}_${favourites.length}`,
    phrase: trimmed,
    createdAt: Date.now(),
  };
  favourites = [entry, ...favourites];

  await saveFavourites();
  return entry;
}

export async function removeFavourite(id) {
  favourites = favourites.filter(f => f.id !== id);
  await saveFavourites();
}

export async function reorderFavourites(newOrder) {
  favourites = newOrder;
  await saveFavourites();
}

export function isFavourite(phrase) {
  return favourites.some(f => f.phrase === phrase);
}

async function saveFavourites() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favourites));
  } catch (e) {
    console.warn('Failed to save favourites:', e);
  }
}
