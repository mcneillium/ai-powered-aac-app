// Tests for the shared authenticated AI backend client.

const mockGetIdToken = jest.fn();
jest.mock('firebase/auth', () => ({ signInAnonymously: jest.fn() }));
jest.mock('../../firebaseConfig', () => ({
  auth: {
    get currentUser() {
      return { getIdToken: mockGetIdToken };
    },
  },
}));

import { callAIBackend, ENDPOINTS } from '../services/aiBackend';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe('callAIBackend', () => {
  test('attaches the Firebase ID token as a Bearer header', async () => {
    mockGetIdToken.mockResolvedValue('test-token');
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: 1 }) });

    const result = await callAIBackend(ENDPOINTS.phraseSuggestions, { a: 1 }, 5000, 'test');

    expect(result).toEqual({ ok: 1 });
    const [, options] = fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(options.method).toBe('POST');
  });

  test('does not send personal content when authentication fails', async () => {
    mockGetIdToken.mockRejectedValue(new Error('no auth'));
    expect(await callAIBackend(ENDPOINTS.caption, { image: 'synthetic' }, 5000, 'test')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('returns null on non-2xx responses', async () => {
    mockGetIdToken.mockResolvedValue('t');
    fetch.mockResolvedValueOnce({ ok: false, status: 429 });
    expect(await callAIBackend(ENDPOINTS.ocrToAAC, {}, 5000, 'test')).toBeNull();
  });

  test('returns null on network failure', async () => {
    mockGetIdToken.mockResolvedValue('t');
    fetch.mockRejectedValueOnce(new Error('network down'));
    expect(await callAIBackend(ENDPOINTS.imageToAAC, {}, 5000, 'test')).toBeNull();
  });
});
