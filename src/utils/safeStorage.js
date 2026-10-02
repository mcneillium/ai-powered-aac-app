// src/utils/safeStorage.js
// Defensive JSON loading for user data stored in AsyncStorage.
//
// If saved data can't be parsed, the stores fall back to an empty value and
// the next save would overwrite the unreadable copy for good. To keep the
// user's vocabulary, favourites and history recoverable, the raw value is
// copied to a "<key>__corrupt" backup key before falling back.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const CORRUPT_SUFFIX = '__corrupt';

export async function safeParse(key, raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Stored data for ${key} is unreadable; keeping a backup copy.`);
    try {
      await AsyncStorage.setItem(`${key}${CORRUPT_SUFFIX}`, raw);
    } catch {
      // Best effort — nothing else we can do without storage
    }
    return fallback;
  }
}
