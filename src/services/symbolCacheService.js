// Pre-caches ARASAAC pictograms for core vocabulary on first launch.
// Bundled OpenMoji/Mulberry symbols are always available offline.
// This fills the gap for words not covered by local libraries.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';
import { precacheCoreVocabulary } from './symbolService';
import { corePages } from '../data/coreVocabulary';

const PRECACHE_DONE_KEY = '@aac_symbol_precache_done';

export async function runPrecacheIfNeeded(onProgress) {
  try {
    const done = await AsyncStorage.getItem(PRECACHE_DONE_KEY);
    if (done === 'true') return;

    if (onProgress) {
      global.__symbolCacheProgress = onProgress;
    }

    const allWords = new Set();
    for (const page of Object.values(corePages)) {
      for (const btn of page.buttons) {
        if (!btn.navigateTo && btn.label) {
          const words = btn.label.toLowerCase().split(' ');
          words.forEach(w => allWords.add(w));
        }
      }
    }

    await precacheCoreVocabulary([...allWords]);
    await AsyncStorage.setItem(PRECACHE_DONE_KEY, 'true');
    global.__symbolCacheProgress = null;
  } catch (e) {
    global.__symbolCacheProgress = null;
  }
}
