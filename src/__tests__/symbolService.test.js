import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSymbolForWord, getSymbolsForWords } from '../services/symbolService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../data/symbolAssetMap', () => ({
  wordToHexcode: { happy: '1F604', water: '1F4A7' },
  openmojiAssets: { '1F604': 'mock-happy-asset', '1F4A7': 'mock-water-asset' },
  getOpenMojiForWord: jest.fn((word) => {
    const map = { happy: 'mock-happy-asset', water: 'mock-water-asset' };
    return map[word.toLowerCase()] || null;
  }),
  getOpenMojiSource: jest.fn((hex) => {
    const map = { '1F604': 'mock-happy-asset', '1F4A7': 'mock-water-asset' };
    return map[hex] || null;
  }),
}));

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
});

describe('symbolService', () => {
  describe('getSymbolForWord', () => {
    test('returns static OpenMoji for mapped word', async () => {
      const result = await getSymbolForWord('happy');
      expect(result).not.toBeNull();
      expect(result.source).toBe('openmoji');
      expect(result.type).toBe('static');
      expect(result.word).toBe('happy');
    });

    test('returns cached ARASAAC symbol when available', async () => {
      const cached = {
        symbol: { source: 'arasaac', type: 'remote', uri: 'https://example.com/pic.png', id: 123, word: 'chair' },
        cachedAt: Date.now(),
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(cached));

      const result = await getSymbolForWord('chair');
      expect(result).not.toBeNull();
      expect(result.source).toBe('arasaac');
      expect(result.uri).toBe('https://example.com/pic.png');
    });

    test('returns null for expired cache and failed fetch', async () => {
      const expired = {
        symbol: { source: 'arasaac', type: 'remote', uri: 'https://example.com/old.png', id: 1, word: 'xyz' },
        cachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(expired));
      global.fetch.mockRejectedValue(new Error('offline'));

      const result = await getSymbolForWord('xyz');
      expect(result).toBeNull();
    });

    test('fetches from ARASAAC API when not cached or mapped', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ _id: 456 }]),
      });

      const result = await getSymbolForWord('giraffe');
      expect(result).not.toBeNull();
      expect(result.source).toBe('arasaac');
      expect(result.id).toBe(456);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    test('returns null when API returns empty results', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await getSymbolForWord('zzzznonword');
      expect(result).toBeNull();
    });

    test('is case-insensitive', async () => {
      const result = await getSymbolForWord('HAPPY');
      expect(result).not.toBeNull();
      expect(result.word).toBe('happy');
    });
  });

  describe('getSymbolsForWords', () => {
    test('resolves multiple words', async () => {
      const results = await getSymbolsForWords(['happy', 'water']);
      expect(results.happy).not.toBeNull();
      expect(results.water).not.toBeNull();
      expect(results.happy.source).toBe('openmoji');
      expect(results.water.source).toBe('openmoji');
    });

    test('handles mix of mapped and unmapped words', async () => {
      global.fetch.mockRejectedValue(new Error('offline'));
      const results = await getSymbolsForWords(['happy', 'unknownword']);
      expect(results.happy).not.toBeNull();
      expect(results.unknownword).toBeNull();
    });
  });
});
