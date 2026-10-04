// src/services/favouritesStore.js
// Manages user favourites (pinned phrases) with local persistence.
// Favourites are stored in AsyncStorage and optionally synced to Firebase.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParse } from '../utils/safeStorage';
import { isAccountDeletionPaused, accountDataGeneration, trackAccountDataOperation } from './accountDeletionBarrier';

const STORAGE_KEY = '@aac_favourites';
// Never silently drop a saved favourite: once full, new ones are refused and
// the caller tells the user, rather than deleting the oldest.
export const MAX_FAVOURITES = 200;
let favourites = [];
let loaded = false;

export function loadFavourites(options = {}) {
  // Only the deletion reload may read while paused; screen loads keep the
  // existing memory and cannot start a late corrupt-data backup.
  if (isAccountDeletionPaused() && !options.reload) return Promise.resolve(favourites);
  return trackAccountDataOperation(runLoadFavourites(options));
}

async function runLoadFavourites({ reload = false } = {}) {
  const generation = accountDataGeneration();
  if (loaded && !reload) return favourites;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (generation !== accountDataGeneration()) return favourites;
    const parsed = await safeParse(STORAGE_KEY, raw, []);
    if (generation !== accountDataGeneration()) return favourites;
    favourites = parsed;
    if (!Array.isArray(favourites)) favourites = [];
    loaded = true;
  } catch {
    if (generation !== accountDataGeneration()) return favourites;
    favourites = [];
    loaded = true;
  }
  return favourites;
}

export function getFavourites() {
  return favourites;
}

export async function addFavourite(phrase) {
  if (isAccountDeletionPaused()) return null;
  const generation = accountDataGeneration();
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
  return generation === accountDataGeneration() ? entry : null;
}

export async function removeFavourite(id) {
  if (isAccountDeletionPaused()) return;
  favourites = favourites.filter(f => f.id !== id);
  await saveFavourites();
}

export async function reorderFavourites(newOrder) {
  if (isAccountDeletionPaused()) return;
  favourites = newOrder;
  await saveFavourites();
}

export function isFavourite(phrase) {
  return favourites.some(f => f.phrase === phrase);
}

async function saveFavourites() {
  if (isAccountDeletionPaused()) return;
  try {
    await trackAccountDataOperation(AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favourites)));
  } catch (e) {
    console.warn('Failed to save favourites:', e);
  }
}
