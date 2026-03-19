// src/services/aiProfileStore.js
/**
 * AI Profile Store - Local, privacy-first user modeling for AAC prediction.
 *
 * This store tracks usage patterns locally on-device to improve predictions
 * over time. Data stays on-device by default and is never synced without
 * explicit opt-in.
 *
 * Stored in AsyncStorage under '@aac_ai_profile'
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = '@aac_ai_profile';
const SAVE_INTERVAL = 10; // Save every N updates

let profile = null;
let updatesSinceLastSave = 0;

/**
 * Default profile structure
 */
function createDefaultProfile() {
  return {
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),

    // Word-level usage tracking
    wordFrequencies: {},      // { word: count }
    wordRecency: {},          // { word: timestamp }

    // Bigram co-occurrence (word pairs)
    bigrams: {},              // { "word1 word2": count }

    // Phrase tracking (2-4 word sequences used more than once)
    phraseFrequencies: {},    // { "phrase": count }

    // Failed search tracking (what the user looked for but didn't find)
    failedSearches: {},       // { "searchTerm": count }

    // Session stats
    totalSessions: 0,
    totalWordSelections: 0,
    totalSentencesSpoken: 0,

    // Time-of-day patterns (hour buckets 0-23)
    hourlyActivity: {},       // { hour: count }

    // Suggestion acceptance tracking
    suggestionsShown: 0,
    suggestionsAccepted: 0,
  };
}

/**
 * Load or create the AI profile from AsyncStorage.
 */
export async function loadAIProfile() {
  try {
    const stored = await AsyncStorage.getItem(PROFILE_KEY);
    if (stored) {
      profile = JSON.parse(stored);
      // Migrate if needed
      if (!profile.version) {
        profile = { ...createDefaultProfile(), ...profile, version: 1 };
      }
    } else {
      profile = createDefaultProfile();
    }
    return profile;
  } catch (error) {
    console.warn('Error loading AI profile:', error);
    profile = createDefaultProfile();
    return profile;
  }
}

/**
 * Save the current profile to AsyncStorage.
 */
async function saveProfile() {
  if (!profile) return;
  try {
    profile.updatedAt = Date.now();
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn('Error saving AI profile:', error);
  }
}

/**
 * Conditionally save (every N updates to avoid excessive writes).
 */
async function maybeSave() {
  updatesSinceLastSave++;
  if (updatesSinceLastSave >= SAVE_INTERVAL) {
    updatesSinceLastSave = 0;
    await saveProfile();
  }
}

/**
 * Force save (call on app background/close).
 */
export async function flushAIProfile() {
  await saveProfile();
}

/**
 * Record a word selection by the user.
 * @param {string} word - The word selected
 * @param {string[]} contextWords - Previous words in the sentence
 * @param {boolean} wasSuggestion - Whether the word came from AI suggestion
 */
export async function recordWordSelection(word, contextWords = [], wasSuggestion = false) {
  if (!profile) await loadAIProfile();
  if (!word) return;

  const w = word.toLowerCase().trim();
  const now = Date.now();
  const hour = new Date().getHours();

  // Update word frequency
  profile.wordFrequencies[w] = (profile.wordFrequencies[w] || 0) + 1;

  // Update recency
  profile.wordRecency[w] = now;

  // Update bigram if we have context
  if (contextWords.length > 0) {
    const prevWord = contextWords[contextWords.length - 1].toLowerCase().trim();
    const bigramKey = `${prevWord} ${w}`;
    profile.bigrams[bigramKey] = (profile.bigrams[bigramKey] || 0) + 1;
  }

  // Track phrase if 2+ words in context
  if (contextWords.length >= 1) {
    const phrase = [...contextWords.slice(-3), word].join(' ').toLowerCase();
    if (phrase.split(' ').length >= 2) {
      profile.phraseFrequencies[phrase] = (profile.phraseFrequencies[phrase] || 0) + 1;
    }
  }

  // Hourly activity
  profile.hourlyActivity[hour] = (profile.hourlyActivity[hour] || 0) + 1;

  // Suggestion tracking
  if (wasSuggestion) {
    profile.suggestionsAccepted++;
  }

  profile.totalWordSelections++;
  await maybeSave();
}

/**
 * Record a sentence being spoken.
 * @param {string[]} words - The words in the sentence
 */
export async function recordSentenceSpoken(words) {
  if (!profile) await loadAIProfile();
  if (!words || words.length === 0) return;

  profile.totalSentencesSpoken++;

  // Track full phrase if it's short enough to be a common utterance
  if (words.length >= 2 && words.length <= 6) {
    const phrase = words.join(' ').toLowerCase();
    profile.phraseFrequencies[phrase] = (profile.phraseFrequencies[phrase] || 0) + 1;
  }

  await maybeSave();
}

/**
 * Record a failed search (user searched for something not found).
 * @param {string} searchTerm - What the user searched for
 */
export async function recordFailedSearch(searchTerm) {
  if (!profile) await loadAIProfile();
  if (!searchTerm) return;

  const term = searchTerm.toLowerCase().trim();
  profile.failedSearches[term] = (profile.failedSearches[term] || 0) + 1;
  await maybeSave();
}

/**
 * Record that suggestions were shown to the user.
 * @param {number} count - Number of suggestions shown
 */
export async function recordSuggestionsShown(count) {
  if (!profile) await loadAIProfile();
  profile.suggestionsShown += count;
  // Don't save on every show - too frequent
}

/**
 * Record a new session start.
 */
export async function recordSessionStart() {
  if (!profile) await loadAIProfile();
  profile.totalSessions++;
  await maybeSave();
}

// ── Query methods for the prediction engine ──

/**
 * Get the user's top N most frequent words.
 * @param {number} n - Number of words to return
 * @returns {string[]} Most frequent words
 */
export function getTopWords(n = 20) {
  if (!profile) return [];
  return Object.entries(profile.wordFrequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

/**
 * Get predicted next words based on the previous word using bigram data.
 * @param {string} prevWord - The previous word
 * @param {number} n - Number of predictions
 * @returns {string[]} Predicted next words
 */
export function getBigramPredictions(prevWord, n = 5) {
  if (!profile || !prevWord) return [];
  const prefix = prevWord.toLowerCase().trim() + ' ';
  return Object.entries(profile.bigrams)
    .filter(([key]) => key.startsWith(prefix))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key.split(' ')[1]);
}

/**
 * Get commonly repeated phrases (candidates for vocabulary buttons).
 * @param {number} minCount - Minimum times a phrase must appear
 * @param {number} n - Max phrases to return
 * @returns {{ phrase: string, count: number }[]}
 */
export function getRepeatedPhrases(minCount = 3, n = 10) {
  if (!profile) return [];
  return Object.entries(profile.phraseFrequencies)
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([phrase, count]) => ({ phrase, count }));
}

/**
 * Get frequently failed searches (candidates for vocabulary additions).
 * @param {number} minCount - Minimum search failures
 * @returns {{ term: string, count: number }[]}
 */
export function getFrequentFailedSearches(minCount = 2) {
  if (!profile) return [];
  return Object.entries(profile.failedSearches)
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([term, count]) => ({ term, count }));
}

/**
 * Get recency-boosted word scores.
 * Combines frequency with recency for ranking predictions.
 * @param {string[]} candidates - Words to score
 * @returns {{ word: string, score: number }[]}
 */
export function scoreByFrequencyAndRecency(candidates) {
  if (!profile || !candidates.length) return candidates.map(w => ({ word: w, score: 0 }));

  const now = Date.now();
  const ONE_HOUR = 3600000;
  const ONE_DAY = 86400000;

  return candidates.map(word => {
    const w = word.toLowerCase();
    const freq = profile.wordFrequencies[w] || 0;
    const lastUsed = profile.wordRecency[w] || 0;
    const timeSince = now - lastUsed;

    // Recency boost: 1.0 if used in last hour, 0.5 if today, 0.2 if this week, 0 otherwise
    let recencyBoost = 0;
    if (lastUsed > 0) {
      if (timeSince < ONE_HOUR) recencyBoost = 1.0;
      else if (timeSince < ONE_DAY) recencyBoost = 0.5;
      else if (timeSince < ONE_DAY * 7) recencyBoost = 0.2;
    }

    // Combined score: frequency (log scale) + recency boost
    const score = Math.log(freq + 1) + recencyBoost * 2;
    return { word, score };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Get a privacy-safe summary for dashboard sync (opt-in only).
 * Returns only aggregate data, never raw communication content.
 * @returns {Object} Privacy-safe summary
 */
export function getPrivacySafeSummary() {
  if (!profile) return null;
  return {
    totalSessions: profile.totalSessions,
    totalWordSelections: profile.totalWordSelections,
    totalSentencesSpoken: profile.totalSentencesSpoken,
    suggestionsShown: profile.suggestionsShown,
    suggestionsAccepted: profile.suggestionsAccepted,
    suggestionAcceptanceRate: profile.suggestionsShown > 0
      ? (profile.suggestionsAccepted / profile.suggestionsShown).toFixed(2)
      : 0,
    vocabularySize: Object.keys(profile.wordFrequencies).length,
    failedSearchCount: Object.keys(profile.failedSearches).length,
    repeatedPhraseCount: Object.values(profile.phraseFrequencies).filter(c => c >= 3).length,
    updatedAt: profile.updatedAt,
  };
}
