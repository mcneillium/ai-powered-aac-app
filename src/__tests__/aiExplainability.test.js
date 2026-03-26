// Tests for AI explainability, source tracking, and vocabulary gap analysis
import {
  loadAIProfile, resetAIProfile, recordWordSelection,
  scoreWithExplanation, recordSuggestionAccepted, recordSourceShown,
  getSourceAcceptanceRates, getVocabularyGapInsights, recordFailedSearch,
  recordSentenceSpoken,
} from '../services/aiProfileStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

beforeEach(async () => {
  await resetAIProfile();
});

describe('scoreWithExplanation', () => {
  test('returns reason "suggested" for unknown words', () => {
    const result = scoreWithExplanation(['unknown_xyz']);
    expect(result[0].reason).toBe('suggested');
  });

  test('returns recency-based reason when word was just used', async () => {
    for (let i = 0; i < 12; i++) {
      await recordWordSelection('water', []);
    }
    const result = scoreWithExplanation(['water']);
    // Just recorded = recently used, recency takes priority
    expect(result[0].reason).toBe('used recently');
  });

  test('returns an explanation for every candidate', async () => {
    await recordWordSelection('juice', []);
    const result = scoreWithExplanation(['juice', 'unknown_word']);
    expect(result.length).toBe(2);
    result.forEach(r => {
      expect(r.reason).toBeTruthy();
      expect(typeof r.score).toBe('number');
    });
  });

  test('sorts by score descending', async () => {
    for (let i = 0; i < 10; i++) await recordWordSelection('frequent', []);
    await recordWordSelection('rare', []);
    const result = scoreWithExplanation(['rare', 'frequent']);
    expect(result[0].word).toBe('frequent');
  });
});

describe('source tracking', () => {
  test('records suggestion acceptance by source', async () => {
    await recordSuggestionAccepted('bigram');
    await recordSuggestionAccepted('bigram');
    await recordSuggestionAccepted('vertex');
    const rates = getSourceAcceptanceRates();
    expect(rates).toBeDefined();
  });

  test('recordSourceShown does not throw', () => {
    expect(() => recordSourceShown('neural', 5)).not.toThrow();
  });

  test('getSourceAcceptanceRates returns defaults with no data', () => {
    const rates = getSourceAcceptanceRates();
    // Should return 0.5 default for all sources (not enough data)
    expect(rates.bigram).toBe(0.5);
    expect(rates.neural).toBe(0.5);
  });
});

describe('vocabulary gap insights', () => {
  test('returns empty insights with no data', () => {
    const insights = getVocabularyGapInsights();
    expect(insights.missingWords).toEqual([]);
    expect(insights.frequentPhrases).toEqual([]);
    expect(insights.stats).toBeDefined();
  });

  test('surfaces failed searches as missing words', async () => {
    await recordFailedSearch('dinosaur');
    await recordFailedSearch('dinosaur');
    await recordFailedSearch('unicorn');
    await recordFailedSearch('unicorn');
    const insights = getVocabularyGapInsights();
    expect(insights.missingWords.length).toBe(2);
    expect(insights.missingWords[0].term).toBe('dinosaur');
    expect(insights.missingWords[0].action).toContain('adding');
  });

  test('surfaces frequent phrases for quick-phrase candidates', async () => {
    const words = ['i', 'want', 'water'];
    for (let i = 0; i < 6; i++) {
      await recordSentenceSpoken(words);
    }
    const insights = getVocabularyGapInsights();
    expect(insights.frequentPhrases.length).toBeGreaterThan(0);
    expect(insights.frequentPhrases[0].action).toContain('quick phrase');
  });

  test('returns vocabulary size in stats', async () => {
    await recordWordSelection('hello', []);
    await recordWordSelection('world', []);
    const insights = getVocabularyGapInsights();
    expect(insights.stats.vocabularySize).toBe(2);
  });
});
