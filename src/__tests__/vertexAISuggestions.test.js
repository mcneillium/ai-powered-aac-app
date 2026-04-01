// Tests for vertexAISuggestions client service
// Tests the pure logic and error handling — network calls are mocked.

import { getAACPhraseSuggestions, getImageAACPhrases } from '../services/vertexAISuggestions';

// Mock global fetch
global.fetch = jest.fn();
global.AbortController = class {
  constructor() {
    this.signal = {};
    this.abort = jest.fn();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getAACPhraseSuggestions', () => {
  test('returns suggestions on successful response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: ['I want more', 'help please'] }),
    });

    const result = await getAACPhraseSuggestions(['I', 'want'], []);
    expect(result).toEqual(['I want more', 'help please']);
  });

  test('returns empty array on HTTP error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await getAACPhraseSuggestions(['hello'], []);
    expect(result).toEqual([]);
  });

  test('returns empty array on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await getAACPhraseSuggestions(['test'], []);
    expect(result).toEqual([]);
  });

  test('returns empty array on timeout (AbortError)', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    fetch.mockRejectedValueOnce(abortError);

    const result = await getAACPhraseSuggestions(['test'], []);
    expect(result).toEqual([]);
  });

  test('returns empty array when response has no suggestions key', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'wrong shape' }),
    });

    const result = await getAACPhraseSuggestions([], []);
    expect(result).toEqual([]);
  });

  test('handles missing parameters gracefully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: ['hello'] }),
    });

    const result = await getAACPhraseSuggestions();
    expect(result).toEqual(['hello']);
  });
});

describe('getImageAACPhrases', () => {
  test('returns phrases on successful response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ phrases: ['I see a dog', 'it is big'] }),
    });

    const result = await getImageAACPhrases('base64data');
    expect(result).toEqual(['I see a dog', 'it is big']);
  });

  test('returns empty array on HTTP error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 502 });

    const result = await getImageAACPhrases('base64data');
    expect(result).toEqual([]);
  });

  test('returns empty array on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed'));

    const result = await getImageAACPhrases('base64data');
    expect(result).toEqual([]);
  });
});
