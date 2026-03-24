// src/services/favouritesStore.js
// Manages user favourites (pinned phrases) with local persistence.
// Favourites are stored in AsyncStorage and optionally synced to Firebase.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@aac_favourites';
let favourites = [];
let loaded = false;

export async function loadFavourites() {
  if (loaded) return favourites;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    favourites = raw ? JSON.parse(raw) : [];
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
  if (favourites.some(f => f.phrase === trimmed)) return;

  const entry = {
    id: `fav_${Date.now()}`,
    phrase: trimmed,
    createdAt: Date.now(),
  };
  favourites.unshift(entry);

  // Cap at 50 favourites
  if (favourites.length > 50) favourites = favourites.slice(0, 50);

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
