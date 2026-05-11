// Predictive sentence templates with fill-in-the-blank slots.
// Templates are grouped by intent category (wants, feelings, questions, etc.)
// Smart fill uses AI profile data to suggest the most likely words for each blank.

import { getTopWords, getBigramPredictions } from './aiProfileStore';
import { wordToHexcode } from '../data/symbolAssetMap';

const TEMPLATES = {
  wants: [
    { id: 'want_basic', frame: 'I want ___', slots: [{ position: 2, filter: 'noun' }] },
    { id: 'want_please', frame: 'I want ___ please', slots: [{ position: 2, filter: 'noun' }] },
    { id: 'can_i_have', frame: 'Can I have ___?', slots: [{ position: 3, filter: 'noun' }] },
    { id: 'want_to', frame: 'I want to ___', slots: [{ position: 3, filter: 'verb' }] },
    { id: 'more_please', frame: 'More ___ please', slots: [{ position: 1, filter: 'noun' }] },
  ],
  feelings: [
    { id: 'feel_basic', frame: 'I feel ___', slots: [{ position: 2, filter: 'feeling' }] },
    { id: 'feel_because', frame: 'I feel ___ because ___', slots: [{ position: 2, filter: 'feeling' }, { position: 4, filter: 'cause' }] },
    { id: 'i_am', frame: 'I am ___', slots: [{ position: 2, filter: 'feeling' }] },
  ],
  questions: [
    { id: 'where_is', frame: 'Where is ___?', slots: [{ position: 2, filter: 'noun' }] },
    { id: 'what_is', frame: 'What is ___?', slots: [{ position: 2, filter: 'noun' }] },
    { id: 'can_we', frame: 'Can we ___?', slots: [{ position: 2, filter: 'verb' }] },
    { id: 'when_is', frame: 'When is ___?', slots: [{ position: 2, filter: 'noun' }] },
  ],
  social: [
    { id: 'hello', frame: 'Hello ___', slots: [{ position: 1, filter: 'person' }] },
    { id: 'thank_you', frame: 'Thank you ___', slots: [{ position: 2, filter: 'person' }] },
    { id: 'my_name', frame: 'My name is ___', slots: [{ position: 3, filter: 'name' }] },
    { id: 'bye', frame: 'Bye ___', slots: [{ position: 1, filter: 'person' }] },
    { id: 'sorry', frame: 'Sorry ___', slots: [{ position: 1, filter: 'person' }] },
  ],
  needs: [
    { id: 'need_basic', frame: 'I need ___', slots: [{ position: 2, filter: 'noun' }] },
    { id: 'help_me', frame: 'Help me ___', slots: [{ position: 2, filter: 'verb' }] },
    { id: 'need_to_go', frame: 'I need to go to ___', slots: [{ position: 5, filter: 'place' }] },
    { id: 'give_me', frame: 'Give me ___', slots: [{ position: 2, filter: 'noun' }] },
    { id: 'let_me', frame: 'Let me ___', slots: [{ position: 2, filter: 'verb' }] },
  ],
};

const FILTER_WORDS = {
  noun: ['water', 'milk', 'juice', 'bread', 'fruit', 'snack', 'book', 'ball', 'phone', 'tv', 'shoes', 'bag', 'cup', 'chair', 'door'],
  verb: ['go', 'play', 'eat', 'drink', 'read', 'draw', 'run', 'walk', 'sleep', 'listen', 'watch', 'write', 'help', 'stop'],
  feeling: ['happy', 'sad', 'angry', 'scared', 'tired', 'excited', 'sick', 'confused', 'worried', 'calm'],
  person: ['mom', 'dad', 'brother', 'sister', 'friend', 'teacher', 'doctor', 'baby'],
  place: ['home', 'school', 'bathroom', 'park', 'bed', 'shop'],
  cause: ['it is loud', 'I am tired', 'I am hungry', 'they said no', 'I miss someone', 'I am waiting'],
  name: [],
};

const CATEGORY_META = {
  wants: { label: 'I want...', hexcode: '1F44B', color: '#42A5F5' },
  feelings: { label: 'I feel...', hexcode: '1F60A', color: '#66BB6A' },
  questions: { label: 'Questions', hexcode: '1F50D', color: '#FF7043' },
  social: { label: 'Social', hexcode: '1F44B', color: '#AB47BC' },
  needs: { label: 'I need...', hexcode: '1F64F', color: '#EF5350' },
};

export function getTemplateCategories() {
  return Object.entries(CATEGORY_META).map(([id, meta]) => ({
    id,
    ...meta,
    templateCount: TEMPLATES[id]?.length || 0,
  }));
}

export function getTemplatesForCategory(categoryId) {
  return (TEMPLATES[categoryId] || []).map(t => ({
    ...t,
    category: categoryId,
    words: t.frame.split(' '),
  }));
}

export function getSlotSuggestions(template, slotIndex, filledSlots = {}) {
  const slot = template.slots[slotIndex];
  if (!slot) return [];

  const filterType = slot.filter;
  const baseWords = FILTER_WORDS[filterType] || [];

  const topPersonal = getTopWords(20);
  const personalFiltered = topPersonal.filter(w => {
    if (filterType === 'noun') return !['i', 'you', 'he', 'she', 'we', 'they', 'it', 'the', 'a', 'is', 'am', 'are'].includes(w.toLowerCase());
    if (filterType === 'verb') return true;
    if (filterType === 'feeling') return FILTER_WORDS.feeling.includes(w.toLowerCase());
    if (filterType === 'person') return FILTER_WORDS.person.includes(w.toLowerCase());
    if (filterType === 'place') return FILTER_WORDS.place.includes(w.toLowerCase());
    return true;
  });

  const wordsBeforeSlot = template.words.slice(0, slot.position).filter(w => w !== '___');
  const lastWordBefore = wordsBeforeSlot[wordsBeforeSlot.length - 1];
  const bigramSuggestions = lastWordBefore ? getBigramPredictions(lastWordBefore, 6) : [];

  const seen = new Set();
  const results = [];

  for (const w of bigramSuggestions) {
    const lower = w.toLowerCase();
    if (!seen.has(lower)) { seen.add(lower); results.push({ word: w, reason: 'used after this' }); }
  }
  for (const w of personalFiltered) {
    const lower = w.toLowerCase();
    if (!seen.has(lower) && results.length < 12) { seen.add(lower); results.push({ word: w, reason: 'used often' }); }
  }
  for (const w of baseWords) {
    if (!seen.has(w) && results.length < 16) { seen.add(w); results.push({ word: w, reason: filterType }); }
  }

  return results;
}

export function fillTemplate(template, filledSlots) {
  const words = [...template.words];
  let slotIdx = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i] === '___') {
      words[i] = filledSlots[slotIdx] || '___';
      slotIdx++;
    }
  }
  return words.join(' ');
}

export function isTemplateComplete(template, filledSlots) {
  return template.slots.every((_, i) => filledSlots[i] && filledSlots[i] !== '___');
}

export function getTemplateHexcode(word) {
  return wordToHexcode[word?.toLowerCase()] || null;
}
