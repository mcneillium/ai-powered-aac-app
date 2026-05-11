// Unified symbol service — resolves symbols across 3 libraries.
// Priority: 1. Static OpenMoji map (instant, offline)
//           2. ARASAAC cache (offline after first fetch)
//           3. ARASAAC API (online only)
//
// Licenses:
//   ARASAAC: CC BY-NC-SA (Government of Aragon, Sergio Palao)
//   OpenMoji: CC BY-SA 4.0 (HfG Schwabisch Gmund)
//   Mulberry: CC BY-SA 2.0 UK (Steve Lee)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOpenMojiForWord, getOpenMojiSource, wordToHexcode, openmojiAssets } from '../data/symbolAssetMap';

const ARASAAC_API = 'https://api.arasaac.org/v1';
const ARASAAC_STATIC = 'https://static.arasaac.org/pictograms';
const CACHE_KEY = '@aac_symbol_cache';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function getSymbolForWord(word, options = {}) {
  const { locale = 'en' } = options;
  const key = word.toLowerCase().trim();

  // 1. Check static OpenMoji map (instant, offline)
  const hex = wordToHexcode[key];
  if (hex && openmojiAssets[hex]) {
    return {
      source: 'openmoji',
      type: 'static',
      asset: openmojiAssets[hex],
      hexcode: hex,
      word: key,
    };
  }

  // 2. Check ARASAAC cache
  const cached = await getCachedSymbol(key);
  if (cached) return cached;

  // 3. Try ARASAAC API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `${ARASAAC_API}/pictograms/${locale}/search/${encodeURIComponent(key)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const results = await res.json();
      if (results.length > 0) {
        const symbol = {
          source: 'arasaac',
          type: 'remote',
          uri: `${ARASAAC_STATIC}/${results[0]._id}/${results[0]._id}_500.png`,
          id: results[0]._id,
          word: key,
        };
        await cacheSymbol(key, symbol);
        return symbol;
      }
    }
  } catch (e) {
    // offline or timeout
  }

  return null;
}

export async function getSymbolsForWords(words, options = {}) {
  const results = {};
  const chunks = [];
  for (let i = 0; i < words.length; i += 8) {
    chunks.push(words.slice(i, i + 8));
  }
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (word) => {
        results[word] = await getSymbolForWord(word, options);
      })
    );
  }
  return results;
}

async function getCachedSymbol(word) {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY}_${word}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt < CACHE_MAX_AGE_MS) {
      return entry.symbol;
    }
  } catch (e) {}
  return null;
}

async function cacheSymbol(word, symbol) {
  try {
    await AsyncStorage.setItem(
      `${CACHE_KEY}_${word}`,
      JSON.stringify({ symbol, cachedAt: Date.now() })
    );
  } catch (e) {}
}

export async function precacheCoreVocabulary(coreWords, locale = 'en') {
  let loaded = 0;
  const batchSize = 10;
  for (let i = 0; i < coreWords.length; i += batchSize) {
    const batch = coreWords.slice(i, i + batchSize);
    await getSymbolsForWords(batch, { locale });
    loaded += batch.length;
    if (typeof global.__symbolCacheProgress === 'function') {
      global.__symbolCacheProgress(loaded, coreWords.length);
    }
  }
}
