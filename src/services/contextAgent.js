// src/services/contextAgent.js
// Contextual Communication Agent — time-aware, conversation-aware suggestions.
// All data comes from on-device stores (aiProfileStore, sentenceHistoryStore,
// contextPacks). Works fully offline.

import { getSentenceHistory } from './sentenceHistoryStore';
import {
  getTopWords,
  getBigramPredictions,
  getRepeatedPhrases,
  getFrequentStarters,
} from './aiProfileStore';
import { getAllContextPacks } from '../data/contextPacks';

const MORNING_START = 6;
const MORNING_END = 12;
const AFTERNOON_END = 17;
const EVENING_END = 21;

function getTimeSlot(hour) {
  if (hour >= MORNING_START && hour < MORNING_END) return 'morning';
  if (hour >= MORNING_END && hour < AFTERNOON_END) return 'afternoon';
  if (hour >= AFTERNOON_END && hour < EVENING_END) return 'evening';
  return 'night';
}

const TIME_GREETINGS = {
  morning: ['Good morning', 'Hello', 'I want breakfast'],
  afternoon: ['Good afternoon', 'Hello', 'I want lunch'],
  evening: ['Good evening', 'I want dinner', 'I want to relax'],
  night: ['Goodnight', 'I want to sleep', "I'm tired"],
};

const TIME_CONTEXT_PACKS = {
  morning: ['home', 'school', 'meals'],
  afternoon: ['school', 'outdoors', 'meals'],
  evening: ['home', 'meals', 'regulation'],
  night: ['home', 'regulation'],
};

const FOLLOW_UP_MAP = {
  greeting: ['How are you?', 'I want', 'Can I have'],
  request: ['Please', 'Thank you', 'More please', 'Not that one'],
  feeling: ['Because', 'I need', 'Can you help?'],
  question: ['Yes', 'No', 'I think so', "I don't know"],
  farewell: ['See you later', 'Thank you', 'Bye'],
};

function classifyUtterance(text) {
  const lower = text.toLowerCase();
  if (/^(hi|hello|good morning|good afternoon|good evening|hey)/i.test(lower)) return 'greeting';
  if (/^(bye|goodbye|goodnight|see you)/i.test(lower)) return 'farewell';
  if (/\?$/.test(lower) || /^(can|do|what|where|when|how|why|is|are|will)/i.test(lower)) return 'question';
  if (/(i feel|i am |i'm |happy|sad|angry|scared|tired|worried|frustrated|hurt)/i.test(lower)) return 'feeling';
  if (/(i want|i need|can i|please|give me|let me)/i.test(lower)) return 'request';
  return 'statement';
}

export function getContextSuggestions(sentenceWords = [], options = {}) {
  const { maxSuggestions = 6 } = options;
  const hour = new Date().getHours();
  const timeSlot = getTimeSlot(hour);
  const results = [];

  if (sentenceWords.length === 0) {
    const recentHistory = getSentenceHistory().slice(0, 5);

    if (recentHistory.length > 0) {
      const lastType = classifyUtterance(recentHistory[0].text);
      const followUps = FOLLOW_UP_MAP[lastType] || FOLLOW_UP_MAP.greeting;
      followUps.forEach(phrase => {
        results.push({ word: phrase, reason: 'follow-up', source: 'context' });
      });
    }

    const greetings = TIME_GREETINGS[timeSlot] || [];
    greetings.forEach(g => {
      if (!results.find(r => r.word === g)) {
        results.push({ word: g, reason: `${timeSlot} phrase`, source: 'context' });
      }
    });

    const starters = getFrequentStarters(3, 4);
    starters.forEach(({ starter }) => {
      if (!results.find(r => r.word === starter)) {
        results.push({ word: starter, reason: 'you start with this often', source: 'context' });
      }
    });

    return results.slice(0, maxSuggestions);
  }

  const currentText = sentenceWords.join(' ');
  const currentType = classifyUtterance(currentText);

  const followUps = FOLLOW_UP_MAP[currentType] || [];
  followUps.forEach(phrase => {
    results.push({ word: phrase, reason: 'natural follow-up', source: 'context' });
  });

  const repeatedPhrases = getRepeatedPhrases(2, 4);
  const currentLower = currentText.toLowerCase();
  repeatedPhrases.forEach(({ phrase }) => {
    if (phrase.startsWith(currentLower) && phrase !== currentLower) {
      const completion = phrase.slice(currentLower.length).trim();
      if (completion) {
        results.push({ word: completion, reason: 'complete your phrase', source: 'context' });
      }
    }
  });

  return results.slice(0, maxSuggestions);
}

export function getSuggestedContextPacks() {
  const hour = new Date().getHours();
  const timeSlot = getTimeSlot(hour);
  const suggestedIds = TIME_CONTEXT_PACKS[timeSlot] || ['home'];
  const allPacks = getAllContextPacks();
  return allPacks
    .filter(p => suggestedIds.includes(p.id))
    .map(p => ({ ...p, reason: `Good for ${timeSlot}` }));
}

export function getConversationContext() {
  const history = getSentenceHistory().slice(0, 5);
  if (history.length === 0) return null;

  const types = history.map(h => classifyUtterance(h.text));
  const lastType = types[0];
  const recentTopics = history.map(h => h.text).join(' ').toLowerCase();

  let mood = 'neutral';
  if (/sad|angry|frustrated|scared|worried|hurt|pain|tired/i.test(recentTopics)) mood = 'negative';
  else if (/happy|excited|proud|calm|fun|love|great/i.test(recentTopics)) mood = 'positive';

  return {
    lastUtteranceType: lastType,
    mood,
    recentCount: history.length,
    lastSpoken: history[0]?.text || '',
    timeSinceLastMs: history[0] ? Date.now() - history[0].timestamp : null,
  };
}
