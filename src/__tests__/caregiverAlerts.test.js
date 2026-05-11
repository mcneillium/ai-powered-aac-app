import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadAlertState, recordEmotionSelection, recordActivity,
  checkPhraseDistress, checkInactivity, checkVocabularyGaps,
  runAllChecks,
} from '../services/caregiverAlerts';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/aiProfileStore', () => ({
  getFrequentFailedSearches: jest.fn(() => []),
}));

jest.mock('../services/sentenceHistoryStore', () => ({
  getSentenceHistory: jest.fn(() => []),
}));

const { getFrequentFailedSearches } = require('../services/aiProfileStore');

beforeEach(async () => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
  await loadAlertState();
});

describe('caregiverAlerts', () => {
  describe('loadAlertState', () => {
    test('initializes with default state', async () => {
      const state = await loadAlertState();
      expect(state).toHaveProperty('recentEmotions');
      expect(state).toHaveProperty('lastActivityTimestamp');
      expect(state.recentEmotions).toEqual([]);
    });

    test('loads persisted state', async () => {
      const persisted = {
        recentEmotions: [{ emotionId: 'sad', timestamp: Date.now() }],
        lastActivityTimestamp: Date.now(),
        lastDistressAlertAt: 0,
        lastInactivityAlertAt: 0,
        lastVocabGapAlertAt: 0,
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(persisted));
      const state = await loadAlertState();
      expect(state.recentEmotions.length).toBe(1);
    });
  });

  describe('recordEmotionSelection', () => {
    test('records emotion and updates activity', async () => {
      const result = await recordEmotionSelection('happy', 'medium');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test('triggers distress alert on multiple negative emotions', async () => {
      await recordEmotionSelection('sad', 'medium');
      await recordEmotionSelection('angry', 'medium');
      const result = await recordEmotionSelection('scared', 'medium');
      expect(result).not.toBeNull();
      expect(result.type).toBe('distress');
    });

    test('triggers early on high intensity negatives', async () => {
      await recordEmotionSelection('sad', 'lot');
      const result = await recordEmotionSelection('angry', 'lot');
      expect(result).not.toBeNull();
      expect(result.severity).toBe('high');
    });

    test('respects cooldown period', async () => {
      await recordEmotionSelection('sad', 'medium');
      await recordEmotionSelection('angry', 'medium');
      const first = await recordEmotionSelection('scared', 'medium');
      expect(first).not.toBeNull();

      const second = await recordEmotionSelection('worried', 'medium');
      expect(second).toBeNull();
    });
  });

  describe('checkPhraseDistress', () => {
    test('returns null for normal phrases', () => {
      const result = checkPhraseDistress('I want water');
      expect(result).toBeNull();
    });

    test('detects distress phrases', () => {
      const result = checkPhraseDistress('I need help, I am in pain');
      expect(result).not.toBeNull();
      expect(result.type).toBe('distress');
      expect(result.severity).toBe('high');
    });

    test('detects critical phrases', () => {
      const result = checkPhraseDistress("I can't breathe");
      expect(result).not.toBeNull();
      expect(result.severity).toBe('high');
    });

    test('returns null for empty input', () => {
      expect(checkPhraseDistress('')).toBeNull();
      expect(checkPhraseDistress(null)).toBeNull();
    });
  });

  describe('checkInactivity', () => {
    test('returns null when activity is recent', () => {
      const result = checkInactivity();
      expect(result).toBeNull();
    });
  });

  describe('checkVocabularyGaps', () => {
    test('returns null when no gaps', () => {
      getFrequentFailedSearches.mockReturnValue([]);
      const result = checkVocabularyGaps();
      expect(result).toBeNull();
    });

    test('returns alert when many gaps detected', () => {
      getFrequentFailedSearches.mockReturnValue([
        { term: 'dinosaur' }, { term: 'spaceship' }, { term: 'rocket' },
        { term: 'alien' }, { term: 'planet' },
      ]);
      const result = checkVocabularyGaps();
      expect(result).not.toBeNull();
      expect(result.type).toBe('vocabulary_gap');
      expect(result.missingWords).toContain('dinosaur');
    });
  });

  describe('runAllChecks', () => {
    test('returns array of alerts', () => {
      const alerts = runAllChecks();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('recordActivity', () => {
    test('updates timestamp', async () => {
      await recordActivity();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });
});
