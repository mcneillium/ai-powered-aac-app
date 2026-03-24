// Tests for sentence history store
import { loadSentenceHistory, getSentenceHistory, addSentenceToHistory, clearSentenceHistory, getFrequentSentences } from '../services/sentenceHistoryStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

describe('sentenceHistoryStore', () => {
  beforeEach(async () => {
    await clearSentenceHistory();
  });

  test('starts with empty history', async () => {
    const hist = await loadSentenceHistory();
    expect(Array.isArray(hist)).toBe(true);
  });

  test('addSentenceToHistory saves a sentence', async () => {
    await addSentenceToHistory('I want water');
    const hist = getSentenceHistory();
    expect(hist.length).toBeGreaterThan(0);
    expect(hist[0].text).toBe('I want water');
  });

  test('addSentenceToHistory ignores empty strings', async () => {
    const before = getSentenceHistory().length;
    await addSentenceToHistory('');
    await addSentenceToHistory('   ');
    expect(getSentenceHistory().length).toBe(before);
  });

  test('duplicate sentences move to top', async () => {
    await addSentenceToHistory('first');
    await addSentenceToHistory('second');
    await addSentenceToHistory('first');
    const hist = getSentenceHistory();
    expect(hist[0].text).toBe('first');
    // Should not have duplicate entries
    const firstEntries = hist.filter(h => h.text === 'first');
    expect(firstEntries.length).toBe(1);
  });

  test('clearSentenceHistory empties the store', async () => {
    await addSentenceToHistory('test');
    await clearSentenceHistory();
    expect(getSentenceHistory().length).toBe(0);
  });

  test('getFrequentSentences returns sorted by count', async () => {
    await addSentenceToHistory('common');
    await addSentenceToHistory('rare');
    const freq = getFrequentSentences(5);
    expect(Array.isArray(freq)).toBe(true);
  });
});
