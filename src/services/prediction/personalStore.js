// src/services/prediction/personalStore.js
// AsyncStorage persistence for the personal prediction layer.
//
// - One key per profile: "@voice_prediction_personal_v1:<profileId>"
//   (profileId defaults to 'default'), so separate profiles never mix.
// - Writes are debounced (default 2 s) and can be flushed on app background.
// - Unreadable or wrong-shaped data is copied to "<key>__corrupt" and the
//   layer starts empty, mirroring src/utils/safeStorage.js.
// - Nothing here logs sentence content.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CORRUPT_SUFFIX } from '../../utils/safeStorage';
import { PERSONAL_FORMAT, PERSONAL_VERSION } from './personalModel.js';

export const PERSONAL_KEY_PREFIX = '@voice_prediction_personal_v1';
export const DEFAULT_PROFILE_ID = 'default';

export function personalKey(profileId = DEFAULT_PROFILE_ID) {
  const id = typeof profileId === 'string' && profileId.trim() ? profileId.trim() : DEFAULT_PROFILE_ID;
  return `${PERSONAL_KEY_PREFIX}:${id}`;
}

async function backupCorrupt(key, raw) {
  console.warn(`Stored prediction data for ${key} is unreadable; keeping a backup copy.`);
  try {
    await AsyncStorage.setItem(`${key}${CORRUPT_SUFFIX}`, raw);
  } catch {
    // Best effort — nothing else we can do without storage
  }
}

/**
 * Load the exported personal JSON for a profile.
 * @returns {Promise<object|null>} null when nothing (valid) is stored
 * @throws when storage cannot be read at all — the caller must not then
 *         save over whatever is stored (it may be fine, just unreadable now)
 */
export async function loadPersonalData(profileId) {
  const key = personalKey(profileId);
  const raw = await AsyncStorage.getItem(key);
  if (raw === null || raw === undefined || raw === '') return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    await backupCorrupt(key, raw);
    return null;
  }
  // Another version's file is kept as a backup rather than overwritten.
  if (!data || typeof data !== 'object' || data.format !== PERSONAL_FORMAT
    || data.version !== PERSONAL_VERSION) {
    await backupCorrupt(key, raw);
    return null;
  }
  return data;
}

export async function savePersonalData(profileId, data) {
  try {
    await AsyncStorage.setItem(personalKey(profileId), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Delete the profile's data and any backup kept from unreadable data. */
export async function clearPersonalData(profileId) {
  const key = personalKey(profileId);
  try {
    await AsyncStorage.multiRemove([key, `${key}${CORRUPT_SUFFIX}`]);
  } catch {
    // Ignore — the in-memory layer is already empty
  }
}

/**
 * Debounced writer. `schedule(getData)` (re)starts the timer; the latest
 * getData is called once when it fires, so bursts of changes cost one write.
 */
export function createDebouncedSaver(profileId, delayMs = 2000) {
  let timer = null;
  let pending = null;
  let inflight = Promise.resolve();

  function run() {
    timer = null;
    const getData = pending;
    pending = null;
    if (!getData) return inflight;
    inflight = inflight.then(() => savePersonalData(profileId, getData()));
    return inflight;
  }

  return {
    schedule(getData) {
      pending = getData;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    flush() {
      if (timer) clearTimeout(timer);
      return run();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
    hasPending() {
      return pending !== null;
    },
  };
}
