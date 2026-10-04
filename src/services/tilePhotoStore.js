// src/services/tilePhotoStore.js
// Photos chosen for custom word tiles. Kept on this device only: copied into
// the app's own storage and never uploaded or synced (custom words sync
// without their photos). No face detection or identification is used.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { isAccountDeletionPaused, trackAccountDataOperation } from './accountDeletionBarrier';

const KEY = '@voice_tile_photos_v1';
const DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}tiles/` : null;
let photos = {}; // { customItemId: uri }
let generation = 0;
let removals = 0;
let sequence = Promise.resolve();

export function tilePhotoGeneration() { return generation; }

function serialise(operation) {
  const result = sequence.then(operation);
  sequence = result.catch(() => {});
  return trackAccountDataOperation(result);
}

function checkSaveGeneration(expectedGeneration) {
  if (isAccountDeletionPaused() || removals || expectedGeneration !== generation) {
    throw new Error('Photo saving was cancelled because personal data is being deleted.');
  }
}

export function loadTilePhotos() {
  const started = generation;
  return serialise(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (started === generation) photos = raw ? JSON.parse(raw) || {} : {};
    } catch {
      if (started === generation) photos = {};
    }
    return photos;
  });
}

// Stored as a file name and resolved against the current documents folder:
// on iOS the app's container path can change after an update or restore.
// The first Voice 2 build stored absolute file:// URIs; a photo copied into a
// (possibly older) container's tiles folder is found again by its file name.
// '.' and '..' are never photo names: they would point at a folder.
const LEGACY_TILE_URI = /^file:\/\/.*\/tiles\/(?!\.\.?$)([^/]+)$/i;
function resolve(stored) {
  if (!stored) return null;
  if (Platform.OS === 'web' || !DIR) return stored;
  const legacy = LEGACY_TILE_URI.exec(stored);
  if (legacy) return `${DIR}${legacy[1]}`;
  if (/^[a-z]+:/i.test(stored)) return stored;
  return `${DIR}${stored}`;
}

export function getTilePhoto(itemId) {
  return resolve(photos[itemId]);
}

/** Copy a picked/captured image into app storage and attach it to a tile. */
export function saveTilePhoto(itemId, sourceUri, expectedGeneration = generation) {
  // The caller can capture this generation before opening a picker, so a
  // result arriving after deletion cannot attach an old photo to a new word.
  try { checkSaveGeneration(expectedGeneration); } catch (error) { return Promise.reject(error); }
  return serialise(async () => {
    checkSaveGeneration(expectedGeneration);
    let stored = sourceUri;
    if (Platform.OS !== 'web' && DIR) {
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
      checkSaveGeneration(expectedGeneration);
      stored = `${itemId}-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: sourceUri, to: `${DIR}${stored}` });
      checkSaveGeneration(expectedGeneration);
    }
    const old = resolve(photos[itemId]);
    photos = { ...photos, [itemId]: stored };
    await AsyncStorage.setItem(KEY, JSON.stringify(photos));
    // Await file cleanup too: removeAll must drain all photo operations.
    if (old && Platform.OS !== 'web') await FileSystem.deleteAsync(old, { idempotent: true }).catch(() => {});
    checkSaveGeneration(expectedGeneration);
    return resolve(stored);
  });
}

export function removeTilePhoto(itemId) {
  const started = generation;
  if (isAccountDeletionPaused() || removals) return Promise.resolve();
  return serialise(async () => {
    if (isAccountDeletionPaused() || removals || started !== generation) return;
    const old = resolve(photos[itemId]);
    if (!old) return;
    const next = { ...photos };
    delete next[itemId];
    photos = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(photos)).catch(() => {});
    if (Platform.OS !== 'web') await FileSystem.deleteAsync(old, { idempotent: true }).catch(() => {});
  });
}

/**
 * Remove every tile photo on this device, including photos of words that
 * were removed elsewhere (another screen or another device) and so are no
 * longer in the word list. Used by "Delete my data".
 */
export function removeAllTilePhotos({ strict = false } = {}) {
  generation += 1;
  removals += 1;
  photos = {};
  // Queue the purge after earlier copies/writes. No stale load or queued save
  // can restore its index after the folder and storage key have been removed.
  return serialise(async () => {
    try {
      const results = [await Promise.resolve().then(() => AsyncStorage.removeItem(KEY)).then(() => true, () => false)];
      if (Platform.OS !== 'web' && DIR) {
        results.push(await Promise.resolve().then(() => FileSystem.deleteAsync(DIR, { idempotent: true })).then(() => true, () => false));
      }
      if (strict && results.includes(false)) throw new Error('Could not remove all tile photos.');
    } finally {
      removals -= 1;
    }
  });
}
