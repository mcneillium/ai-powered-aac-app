// Tests for aiProfileStore — privacy-first AI personalization engine.
// Verifies word tracking, bigram learning, phrase detection, and scoring.

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key) => Promise.resolve(store[key] || null)),
      setItem: jest.fn((key, value) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
    _reset: () => { store = {}; },
  };
});

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

describe('aiProfileStore', () => {
  beforeEach(() => {
    jest.resetModules();
    require('@react-native-async-storage/async-storage')._reset();
  });

  test('loadAIProfile creates default profile when none exists', async () => {
    const { loadAIProfile } = require('../services/aiProfileStore');
    const profile = await loadAIProfile();

    expect(profile).toBeDefined();
    expect(profile.version).toBe(1);
    expect(profile.totalSessions).toBe(0);
    expect(profile.wordFrequencies).toEqual({});
  });

  test('recordWordSelection tracks word frequency', async () => {
    const { loadAIProfile, recordWordSelection, getTopWords } = require('../services/aiProfileStore');
    await loadAIProfile();

    await recordWordSelection('hello');
    await recordWordSelection('hello');
    await recordWordSelection('world');

    const topWords = getTopWords(5);
    expect(topWords[0]).toBe('hello');
    expect(topWords).toContain('world');
  });

  test('recordWordSelection builds bigrams from context', async () => {
    const { loadAIProfile, recordWordSelection, getBigramPredictions } = require('../services/aiProfileStore');
    await loadAIProfile();

    // Build pattern: "I want" appears 3 times
    await recordWordSelection('want', ['I']);
    await recordWordSelection('want', ['I']);
    await recordWordSelection('want', ['I']);
    await recordWordSelection('go', ['I']);

    const predictions = getBigramPredictions('I', 5);
    expect(predictions[0]).toBe('want');
    expect(predictions).toContain('go');
  });

  test('recordSentenceSpoken tracks phrases', async () => {
    const { loadAIProfile, recordSentenceSpoken, getRepeatedPhrases } = require('../services/aiProfileStore');
    await loadAIProfile();

    // Say "I want water" 4 times
    for (let i = 0; i < 4; i++) {
      await recordSentenceSpoken(['I', 'want', 'water']);
    }

    const phrases = getRepeatedPhrases(3, 10);
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases[0].phrase).toBe('i want water');
    expect(phrases[0].count).toBe(4);
  });

  test('recordFailedSearch tracks search failures', async () => {
    const { loadAIProfile, recordFailedSearch, getFrequentFailedSearches } = require('../services/aiProfileStore');
    await loadAIProfile();

    await recordFailedSearch('dinosaur');
    await recordFailedSearch('dinosaur');
    await recordFailedSearch('unicorn');

    const failures = getFrequentFailedSearches(2);
    expect(failures).toEqual([{ term: 'dinosaur', count: 2 }]);
  });

  test('scoreByFrequencyAndRecency ranks by frequency and recency', async () => {
    const { loadAIProfile, recordWordSelection, scoreByFrequencyAndRecency } = require('../services/aiProfileStore');
    await loadAIProfile();

    // "want" used 5 times, "go" used 1 time
    for (let i = 0; i < 5; i++) await recordWordSelection('want');
    await recordWordSelection('go');

    const scores = scoreByFrequencyAndRecency(['want', 'go', 'unknown']);
    expect(scores[0].word).toBe('want');
    expect(scores[0].score).toBeGreaterThan(scores[1].score);
    expect(scores[2].score).toBe(0); // unknown word
  });

  test('getPrivacySafeSummary returns aggregate data only', async () => {
    const { loadAIProfile, recordWordSelection, recordSessionStart, getPrivacySafeSummary } = require('../services/aiProfileStore');
    await loadAIProfile();

    await recordSessionStart();
    await recordWordSelection('hello');
    await recordWordSelection('world');

    const summary = getPrivacySafeSummary();
    expect(summary.totalSessions).toBe(1);
    expect(summary.totalWordSelections).toBe(2);
    expect(summary.vocabularySize).toBe(2);
    // Should NOT contain raw words
    expect(summary.wordFrequencies).toBeUndefined();
    expect(summary.bigrams).toBeUndefined();
  });

  test('recordWordSelection handles null/empty input gracefully', async () => {
    const { loadAIProfile, recordWordSelection } = require('../services/aiProfileStore');
    await loadAIProfile();

    // Should not throw
    await recordWordSelection(null);
    await recordWordSelection('');
    await recordWordSelection(undefined);
  });

  test('recordSessionStart increments session count', async () => {
    const { loadAIProfile, recordSessionStart, getPrivacySafeSummary } = require('../services/aiProfileStore');
    await loadAIProfile();

    await recordSessionStart();
    await recordSessionStart();
    await recordSessionStart();

    const summary = getPrivacySafeSummary();
    expect(summary.totalSessions).toBe(3);
  });
});
