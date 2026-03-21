// Tests for AI profile store
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadAIProfile,
  recordWordSelection,
  recordSentenceSpoken,
  recordFailedSearch,
  getTopWords,
  getBigramPredictions,
  getRepeatedPhrases,
  getFrequentFailedSearches,
  scoreByFrequencyAndRecency,
  getPrivacySafeSummary,
  resetAIProfile,
  hasLearnedData,
} from '../services/aiProfileStore';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

describe('aiProfileStore', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    await loadAIProfile();
  });

  test('loadAIProfile creates default profile when none exists', async () => {
    const profile = await loadAIProfile();
    expect(profile).toBeTruthy();
    expect(profile.version).toBe(1);
    expect(profile.totalSessions).toBe(0);
  });

  test('recordWordSelection updates word frequency', async () => {
    await recordWordSelection('hello', []);
    await recordWordSelection('hello', []);
    const top = getTopWords(5);
    expect(top).toContain('hello');
  });

  test('recordWordSelection tracks bigrams', async () => {
    await recordWordSelection('world', ['hello']);
    const predictions = getBigramPredictions('hello', 5);
    expect(predictions).toContain('world');
  });

  test('recordSentenceSpoken increments counter', async () => {
    await recordSentenceSpoken(['I', 'want', 'water']);
    const summary = getPrivacySafeSummary();
    expect(summary.totalSentencesSpoken).toBeGreaterThan(0);
  });

  test('recordFailedSearch tracks search terms', async () => {
    await recordFailedSearch('dinosaur');
    await recordFailedSearch('dinosaur');
    const failed = getFrequentFailedSearches(2);
    expect(failed.some(f => f.term === 'dinosaur')).toBe(true);
  });

  test('getTopWords returns words in frequency order', async () => {
    await recordWordSelection('water', []);
    await recordWordSelection('water', []);
    await recordWordSelection('water', []);
    await recordWordSelection('food', []);
    const top = getTopWords(5);
    expect(top[0]).toBe('water');
  });

  test('scoreByFrequencyAndRecency returns scored candidates', async () => {
    await recordWordSelection('hello', []);
    const scored = scoreByFrequencyAndRecency(['hello', 'unknown']);
    expect(scored[0].word).toBe('hello');
    expect(scored[0].score).toBeGreaterThan(0);
  });

  test('getPrivacySafeSummary returns aggregate data only', async () => {
    const summary = getPrivacySafeSummary();
    expect(summary).toBeTruthy();
    expect(summary.totalSessions).toBeDefined();
    expect(summary.vocabularySize).toBeDefined();
    // Should NOT expose raw word data
    expect(summary.wordFrequencies).toBeUndefined();
  });

  test('hasLearnedData returns false for fresh profile', async () => {
    expect(hasLearnedData()).toBe(false);
  });

  test('hasLearnedData returns true after word selection', async () => {
    await recordWordSelection('hello', []);
    expect(hasLearnedData()).toBe(true);
  });

  test('resetAIProfile clears learned data', async () => {
    await recordWordSelection('hello', []);
    await recordWordSelection('world', ['hello']);
    expect(hasLearnedData()).toBe(true);

    await resetAIProfile();
    expect(hasLearnedData()).toBe(false);
    expect(getTopWords(5)).toEqual([]);
    expect(getBigramPredictions('hello', 5)).toEqual([]);
  });

  test('resetAIProfile preserves session count', async () => {
    // recordSessionStart was called in loadAIProfile setUp
    const summaryBefore = getPrivacySafeSummary();
    const sessionsBefore = summaryBefore.totalSessions;

    await resetAIProfile();
    const summaryAfter = getPrivacySafeSummary();
    expect(summaryAfter.totalSessions).toBe(sessionsBefore);
  });
});
