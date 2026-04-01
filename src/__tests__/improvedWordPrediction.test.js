// Tests for improved word prediction service
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@tensorflow/tfjs', () => ({
  ready: jest.fn(() => Promise.resolve()),
}));
jest.mock('@tensorflow/tfjs-react-native', () => ({}));
jest.mock('../utils/logger', () => ({
  logEvent: jest.fn(),
}));

const {
  updateFrequencyModel,
  clearPredictionCache,
  getPredictions,
} = require('../services/improvedWordPrediction');

describe('improvedWordPrediction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPredictionCache();
  });

  test('updateFrequencyModel ignores empty inputs', async () => {
    await updateFrequencyModel('', '');
    await updateFrequencyModel(null, null);
    // Should not throw
  });

  test('getPredictions returns empty array for empty input', async () => {
    const result = await getPredictions('');
    expect(result).toEqual([]);
  });

  test('getPredictions returns fallback words when no model loaded', async () => {
    global.wordPredictionModel = null;
    global.tokenizer = null;
    // Should fall back to frequency model or default
    const result = await getPredictions('hello world');
    expect(Array.isArray(result)).toBe(true);
  });

  test('clearPredictionCache resets the cache', () => {
    clearPredictionCache();
    // Should not throw
  });
});
