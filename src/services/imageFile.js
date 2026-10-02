// Reads a photo (camera or gallery) as base64 for the AI image endpoints.
//
// Expo SDK 54 (expo-file-system 19) moved readAsStringAsync and EncodingType
// to 'expo-file-system/legacy'. Imported from 'expo-file-system' they are
// stubs that throw, so every photo failed with "Could not process this image"
// on native builds. Keep this import on the legacy entry point.
import * as FileSystem from 'expo-file-system/legacy';

// Rejects if the promise doesn't settle within ms.
export function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// Returns the file's contents as base64, or null on any failure.
export async function readImageBase64(uri, timeoutMs = 8000) {
  try {
    return await withTimeout(
      FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }),
      timeoutMs,
      'base64 read'
    );
  } catch (e) {
    console.warn('[Camera] base64 read failed:', e.message);
    return null;
  }
}
