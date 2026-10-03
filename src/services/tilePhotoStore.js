// src/services/tilePhotoStore.js
// Photos chosen for custom word tiles. Kept on this device only: copied into
// the app's own storage and never uploaded or synced (custom words sync
// without their photos). No face detection or identification is used.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const KEY = '@voice_tile_photos_v1';
const DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}tiles/` : null;
let photos = {}; // { customItemId: uri }

export async function loadTilePhotos() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    photos = raw ? JSON.parse(raw) || {} : {};
  } catch {
    photos = {};
  }
  return photos;
}

// Stored as a file name and resolved against the current documents folder:
// on iOS the app's container path can change after an update or restore.
function resolve(stored) {
  if (!stored) return null;
  if (Platform.OS === 'web' || !DIR || /^[a-z]+:/i.test(stored)) return stored;
  return `${DIR}${stored}`;
}

export function getTilePhoto(itemId) {
  return resolve(photos[itemId]);
}

/** Copy a picked/captured image into app storage and attach it to a tile. */
export async function saveTilePhoto(itemId, sourceUri) {
  let stored = sourceUri;
  if (Platform.OS !== 'web' && DIR) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    stored = `${itemId}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: sourceUri, to: `${DIR}${stored}` });
  }
  const old = resolve(photos[itemId]);
  photos = { ...photos, [itemId]: stored };
  await AsyncStorage.setItem(KEY, JSON.stringify(photos));
  if (old && Platform.OS !== 'web') FileSystem.deleteAsync(old, { idempotent: true }).catch(() => {});
  return resolve(stored);
}

export async function removeTilePhoto(itemId) {
  const old = resolve(photos[itemId]);
  if (!old) return;
  const next = { ...photos };
  delete next[itemId];
  photos = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(photos)).catch(() => {});
  if (Platform.OS !== 'web') FileSystem.deleteAsync(old, { idempotent: true }).catch(() => {});
}
