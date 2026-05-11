import AsyncStorage from '@react-native-async-storage/async-storage';
import { runPrecacheIfNeeded } from '../services/symbolCacheService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/symbolService', () => ({
  precacheCoreVocabulary: jest.fn(() => Promise.resolve()),
}));

jest.mock('../data/coreVocabulary', () => ({
  corePages: {
    home: {
      buttons: [
        { id: '1', label: 'Hello', navigateTo: null },
        { id: '2', label: 'Go play', navigateTo: null },
        { id: '3', label: 'Actions', navigateTo: 'actions' },
      ],
    },
  },
}));

const { precacheCoreVocabulary } = require('../services/symbolService');

beforeEach(() => {
  jest.clearAllMocks();
  global.__symbolCacheProgress = null;
});

describe('symbolCacheService', () => {
  test('skips if already done', async () => {
    AsyncStorage.getItem.mockResolvedValue('true');
    await runPrecacheIfNeeded();
    expect(precacheCoreVocabulary).not.toHaveBeenCalled();
  });

  test('runs precache on first launch', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    await runPrecacheIfNeeded();
    expect(precacheCoreVocabulary).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@aac_symbol_precache_done',
      'true'
    );
  });

  test('extracts words from buttons (not navigation buttons)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    await runPrecacheIfNeeded();
    const calledWords = precacheCoreVocabulary.mock.calls[0][0];
    expect(calledWords).toContain('hello');
    expect(calledWords).toContain('go');
    expect(calledWords).toContain('play');
    expect(calledWords).not.toContain('actions');
  });

  test('sets progress callback when provided', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const onProgress = jest.fn();
    await runPrecacheIfNeeded(onProgress);
    expect(global.__symbolCacheProgress).toBeNull();
  });

  test('handles precache failure gracefully', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    precacheCoreVocabulary.mockRejectedValue(new Error('network error'));
    await expect(runPrecacheIfNeeded()).resolves.toBeUndefined();
  });
});
