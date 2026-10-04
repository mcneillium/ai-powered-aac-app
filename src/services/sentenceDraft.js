// Keeps the sentence being built across the in-place reload that Android
// builds do when the system font size changes while Voice is open
// (plugins/withFontScaleConfigChange.js). Without a reload, React Native keeps
// text measured at the old font scale and cuts it off; the reload re-lays the
// UI out at the new scale, and this restores the sentence and page afterwards.
//
// A draft is only restored when the font scale differs from when it was saved
// and it is recent, so an ordinary later launch starts with an empty sentence
// exactly as before.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PixelRatio } from 'react-native';
import { isAccountDeletionPaused, accountDataGeneration, trackAccountDataOperation } from './accountDeletionBarrier';

export const DRAFT_KEY = 'voice.sentenceDraft.v1';
export const RESTORE_WINDOW_MS = 2 * 60 * 1000;

export async function saveSentenceDraft(words, pageId, {
  now = Date.now(),
  fontScale = PixelRatio.getFontScale(),
} = {}) {
  if (isAccountDeletionPaused()) return;
  try {
    await trackAccountDataOperation(AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({
      words: Array.isArray(words) ? words : [],
      pageId: typeof pageId === 'string' ? pageId : 'home',
      fontScale,
      savedAt: now,
    })));
  } catch {
    // A draft is a convenience; never let it affect communication.
  }
}

/**
 * Returns { words, pageId } if the app was reloaded because the font scale
 * changed, otherwise null. The stored draft is consumed either way.
 */
export function takeSentenceDraftAfterFontChange(options = {}) {
  return trackAccountDataOperation(consumeSentenceDraft(options));
}

async function consumeSentenceDraft({
  now = Date.now(),
  fontScale = PixelRatio.getFontScale(),
} = {}) {
  const accountGeneration = accountDataGeneration();
  let draft = null;
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (raw) draft = JSON.parse(raw);
  } catch {
    draft = null;
  }
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
  if (isAccountDeletionPaused() || accountGeneration !== accountDataGeneration()) return null;
  if (!draft || !Array.isArray(draft.words) || draft.words.length === 0) return null;
  if (!draft.words.every((w) => typeof w === 'string')) return null;
  if (typeof draft.savedAt !== 'number' || now - draft.savedAt > RESTORE_WINDOW_MS || now < draft.savedAt) return null;
  if (typeof draft.fontScale !== 'number' || Math.abs(draft.fontScale - fontScale) < 0.001) return null;
  return { words: draft.words, pageId: typeof draft.pageId === 'string' ? draft.pageId : 'home' };
}
