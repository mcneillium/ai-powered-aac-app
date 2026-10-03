// src/services/symbolStore.js
// Picture symbols for board tiles (ARASAAC pictograms).
//
// - Optional. Nothing is downloaded until the user turns picture symbols on
//   and taps Download in Settings › Symbols.
// - Downloaded once to this device's app storage, then used offline.
// - Only symbol ids ship in the app (src/data/symbolMap.json); no ARASAAC
//   artwork is bundled in the binary.
// - No user data is sent: requests are fixed image URLs.
//
// ARASAAC pictograms: author Sergio Palao, origin ARASAAC (https://arasaac.org),
// licence CC BY-NC-SA, owner Government of Aragón (Spain). See
// docs/legal/asset-inventory.md for the open commercial-use question.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import symbolMap from '../data/symbolMap.json';

const STATE_KEY = '@voice_symbols_v1';
const DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}symbols/` : null;
const RESOLUTION = 300;

let state = { downloaded: false, ids: {} }; // ids: { arasaacId: true }
const listeners = new Set();

const urlFor = (id) => `https://static.arasaac.org/pictograms/${id}/${id}_${RESOLUTION}.png`;
const fileFor = (id) => `${DIR}${id}.png`;

function emit() { listeners.forEach((fn) => fn(state)); }

export function subscribeSymbols(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSymbolState() { return state; }

export async function loadSymbolState() {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (raw) state = { downloaded: false, ids: {}, ...JSON.parse(raw) };
  } catch {
    state = { downloaded: false, ids: {} };
  }
  emit();
  return state;
}

/** The pictogram id for a board button, or null. Custom words may carry their own. */
export function symbolIdFor(button) {
  if (!button) return null;
  if (button.arasaacId) return button.arasaacId;
  return symbolMap[button.id] || null;
}

/**
 * Image source for a button, or null when no symbol is available offline.
 * Custom tiles with their own photo use that photo.
 */
export function symbolSourceFor(button) {
  if (!button) return null;
  if (button.imageUri) return { uri: button.imageUri };
  const id = symbolIdFor(button);
  if (!id || !state.ids[id]) return null;
  // Web has no app file storage; the browser cache holds the images.
  if (Platform.OS === 'web' || !DIR) return { uri: urlFor(id) };
  return { uri: fileFor(id) };
}

export function symbolCount() {
  return new Set(Object.values(symbolMap)).size;
}

/**
 * Download every board symbol. Resolves with { ok, failed }. Safe to call
 * again: already-downloaded files are skipped. Progress is reported with
 * onProgress(done, total).
 */
export async function downloadSymbols(onProgress) {
  const ids = [...new Set(Object.values(symbolMap))];
  let done = 0;
  let failed = 0;
  const got = { ...state.ids };
  if (Platform.OS !== 'web' && DIR) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  }
  // Small batches keep memory and connections bounded.
  for (let i = 0; i < ids.length; i += 6) {
    await Promise.all(ids.slice(i, i + 6).map(async (id) => {
      try {
        if (!got[id]) {
          if (Platform.OS !== 'web' && DIR) {
            const res = await FileSystem.downloadAsync(urlFor(id), fileFor(id));
            if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
          }
          got[id] = true;
        }
      } catch {
        failed += 1;
      }
      done += 1;
      if (onProgress) onProgress(done, ids.length);
    }));
  }
  state = { downloaded: true, ids: got };
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => {});
  emit();
  return { ok: ids.length - failed, failed };
}

/** Remove downloaded symbols from this device. */
export async function deleteSymbols() {
  if (Platform.OS !== 'web' && DIR) {
    await FileSystem.deleteAsync(DIR, { idempotent: true }).catch(() => {});
  }
  state = { downloaded: false, ids: {} };
  await AsyncStorage.removeItem(STATE_KEY).catch(() => {});
  emit();
}
