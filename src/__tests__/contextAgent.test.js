import { getContextSuggestions, getSuggestedContextPacks, getConversationContext } from '../services/contextAgent';

jest.mock('../services/sentenceHistoryStore', () => ({
  getSentenceHistory: jest.fn(() => []),
}));

jest.mock('../services/aiProfileStore', () => ({
  getTopWords: jest.fn(() => []),
  getBigramPredictions: jest.fn(() => []),
  getRepeatedPhrases: jest.fn(() => []),
  getFrequentStarters: jest.fn(() => []),
}));

jest.mock('../data/contextPacks', () => ({
  getAllContextPacks: jest.fn(() => [
    { id: 'home', label: 'Home', buttons: [] },
    { id: 'school', label: 'School', buttons: [] },
    { id: 'meals', label: 'Meals', buttons: [] },
  ]),
}));

const { getSentenceHistory } = require('../services/sentenceHistoryStore');
const { getFrequentStarters, getRepeatedPhrases } = require('../services/aiProfileStore');

beforeEach(() => {
  jest.clearAllMocks();
  getSentenceHistory.mockReturnValue([]);
});

describe('contextAgent', () => {
  describe('getContextSuggestions', () => {
    test('returns time-based greetings when no sentence and no history', () => {
      const results = getContextSuggestions([], { maxSuggestions: 6 });
      expect(results.length).toBeGreaterThan(0);
      const words = results.map(r => r.word);
      const hasGreeting = words.some(w =>
        ['Good morning', 'Good afternoon', 'Good evening', 'Goodnight', 'Hello'].includes(w)
      );
      expect(hasGreeting).toBe(true);
    });

    test('returns follow-ups based on last utterance type', () => {
      getSentenceHistory.mockReturnValue([
        { text: 'Hello everyone', timestamp: Date.now() },
      ]);
      const results = getContextSuggestions([], { maxSuggestions: 6 });
      const words = results.map(r => r.word);
      expect(words).toContain('How are you?');
    });

    test('includes frequent starters', () => {
      getFrequentStarters.mockReturnValue([
        { starter: 'I want' },
        { starter: 'Can I have' },
      ]);
      const results = getContextSuggestions([], { maxSuggestions: 10 });
      const words = results.map(r => r.word);
      expect(words).toContain('I want');
    });

    test('returns follow-ups for in-progress sentence', () => {
      const results = getContextSuggestions(['I', 'feel', 'sad'], { maxSuggestions: 6 });
      expect(results.length).toBeGreaterThan(0);
      const reasons = results.map(r => r.reason);
      expect(reasons).toContain('natural follow-up');
    });

    test('suggests phrase completions', () => {
      getRepeatedPhrases.mockReturnValue([
        { phrase: 'i want water' },
      ]);
      const results = getContextSuggestions(['I', 'want'], { maxSuggestions: 6 });
      const completions = results.filter(r => r.reason === 'complete your phrase');
      expect(completions.length).toBeGreaterThan(0);
    });

    test('respects maxSuggestions limit', () => {
      const results = getContextSuggestions([], { maxSuggestions: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getSuggestedContextPacks', () => {
    test('returns packs matching current time slot', () => {
      const packs = getSuggestedContextPacks();
      expect(packs.length).toBeGreaterThan(0);
      packs.forEach(p => {
        expect(p.reason).toMatch(/Good for (morning|afternoon|evening|night)/);
      });
    });
  });

  describe('getConversationContext', () => {
    test('returns null when no history', () => {
      const ctx = getConversationContext();
      expect(ctx).toBeNull();
    });

    test('returns context with mood detection', () => {
      getSentenceHistory.mockReturnValue([
        { text: 'I feel sad and scared', timestamp: Date.now() },
      ]);
      const ctx = getConversationContext();
      expect(ctx).not.toBeNull();
      expect(ctx.mood).toBe('negative');
      expect(ctx.lastUtteranceType).toBe('feeling');
    });

    test('detects positive mood', () => {
      getSentenceHistory.mockReturnValue([
        { text: 'I feel happy and excited', timestamp: Date.now() },
      ]);
      const ctx = getConversationContext();
      expect(ctx.mood).toBe('positive');
    });
  });
});
