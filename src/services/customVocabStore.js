// src/services/customVocabStore.js
// Local store for caregiver-managed custom vocabulary.
// Custom words appear alongside core vocabulary on the AAC Board.
// All data stored in AsyncStorage — offline-first.

import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_VOCAB_KEY = '@aac_custom_vocab';
const VOCAB_REQUESTS_KEY = '@aac_vocab_requests';

// Fitzgerald Key category → color mapping (matches coreVocabulary.js)
const CATEGORY_COLORS = {
  pronoun:   { color: '#FFF9C4', textColor: '#000' },
  verb:      { color: '#C8E6C9', textColor: '#000' },
  adjective: { color: '#BBDEFB', textColor: '#000' },
  noun:      { color: '#FFE0B2', textColor: '#000' },
  social:    { color: '#F8BBD0', textColor: '#000' },
  important: { color: '#FFCDD2', textColor: '#000' },
  misc:      { color: '#EEEEEE', textColor: '#000' },
};

let customItems = [];
let loaded = false;

export async function loadCustomVocab() {
  if (loaded) return customItems;
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_VOCAB_KEY);
    customItems = raw ? JSON.parse(raw) : [];
    loaded = true;
  } catch {
    customItems = [];
    loaded = true;
  }
  return customItems;
}

export function getCustomVocab() {
  return customItems;
}

/**
 * Get custom vocab items formatted as AAC Board buttons.
 * These can be appended to a page's buttons array.
 */
export function getCustomButtons() {
  return customItems.map(item => {
    const cat = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.misc;
    return {
      id: `custom_${item.id}`,
      label: item.word,
      category: item.category,
      color: cat.color,
      textColor: cat.textColor,
    };
  });
}

/**
 * Add a new custom vocabulary item.
 * @param {string} word - The word or short phrase
 * @param {string} category - Fitzgerald Key category
 * @param {'requested'|'promoted'|'manual'} source - How this item was created
 */
export async function addCustomVocabItem(word, category = 'noun', source = 'manual') {
  if (!word || typeof word !== 'string') return null;
  const trimmed = word.trim().toLowerCase();
  if (!trimmed) return null;
  if (customItems.some(item => item.word === trimmed)) return null;

  const entry = {
    id: Date.now().toString(),
    word: trimmed,
    category,
    source,
    createdAt: Date.now(),
  };
  customItems.push(entry);
  await save();
  return entry;
}

export async function removeCustomVocabItem(id) {
  customItems = customItems.filter(item => item.id !== id);
  await save();
}

/**
 * Get all pending vocabulary requests (from InsightsScreen).
 * Returns { term: timestamp } map.
 */
export async function getVocabRequests() {
  try {
    const raw = await AsyncStorage.getItem(VOCAB_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Remove a term from the requests list (after it's been approved or dismissed).
 */
export async function dismissVocabRequest(term) {
  try {
    const raw = await AsyncStorage.getItem(VOCAB_REQUESTS_KEY);
    const requests = raw ? JSON.parse(raw) : {};
    delete requests[term];
    await AsyncStorage.setItem(VOCAB_REQUESTS_KEY, JSON.stringify(requests));
  } catch { /* ignore */ }
}

async function save() {
  try {
    await AsyncStorage.setItem(CUSTOM_VOCAB_KEY, JSON.stringify(customItems));
  } catch (e) {
    console.warn('Failed to save custom vocab:', e);
  }
}
