// Reliability behaviour of the speech service: chunking, voice fallback,
// pronunciation substitution and stop().

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([
    { identifier: 'device-voice', name: 'Device', language: 'en-GB' },
  ])),
  maxSpeechInputLength: 4000,
}));
const mockSpeech = require('expo-speech');

import { speak, stop, chunkText } from '../services/speechService';
import { _resetPronunciationsForTests } from '../services/pronunciationStore';

beforeEach(() => {
  jest.clearAllMocks();
  _resetPronunciationsForTests([]);
});

describe('chunkText', () => {
  test('returns short text unchanged', () => {
    expect(chunkText('hello there', 4000)).toEqual(['hello there']);
  });

  test('splits long text at sentence or word boundaries within the limit', () => {
    const text = 'One two three. Four five six. Seven eight nine.';
    const chunks = chunkText(text, 20);
    chunks.forEach(c => expect(c.length).toBeLessThanOrEqual(20));
    expect(chunks.join(' ')).toBe(text);
    expect(chunks[0]).toBe('One two three.');
  });
});

describe('speak', () => {
  test('always calls the native stop before speaking, even if onStart never fired', async () => {
    await speak('first');
    await speak('second');
    expect(mockSpeech.stop).toHaveBeenCalledTimes(2);
    await stop();
    expect(mockSpeech.stop).toHaveBeenCalledTimes(3);
  });

  test('splits text longer than the platform limit into several utterances', async () => {
    const long = Array.from({ length: 900 }, (_, i) => `word${i}`).join(' ');
    expect(long.length).toBeGreaterThan(4000);
    await speak(long);
    expect(mockSpeech.speak.mock.calls.length).toBeGreaterThan(1);
    mockSpeech.speak.mock.calls.forEach(([chunk]) => expect(chunk.length).toBeLessThanOrEqual(4000));
  });

  test('drops a saved voice that does not exist on this device', async () => {
    await speak('hello', { voice: 'voice-from-another-phone' });
    expect(mockSpeech.speak.mock.calls[0][1].voice).toBeUndefined();
  });

  test('keeps a saved voice that exists on this device', async () => {
    await speak('hello', { voice: 'device-voice' });
    expect(mockSpeech.speak.mock.calls[0][1].voice).toBe('device-voice');
  });

  test('retries with the default voice when the engine reports an error', async () => {
    await speak('hello', { voice: 'device-voice' });
    const [, opts] = mockSpeech.speak.mock.calls[0];
    opts.onError(new Error('voice failed'));
    expect(mockSpeech.speak).toHaveBeenCalledTimes(2);
    expect(mockSpeech.speak.mock.calls[1][1].voice).toBeUndefined();
    // Only one retry
    mockSpeech.speak.mock.calls[1][1].onError(new Error('again'));
    expect(mockSpeech.speak).toHaveBeenCalledTimes(2);
  });

  test('applies the pronunciation dictionary to spoken text only', async () => {
    _resetPronunciationsForTests([{ id: '1', written: 'Siobhan', spoken: 'Shivawn' }]);
    await speak('I want Siobhan');
    expect(mockSpeech.speak.mock.calls[0][0]).toBe('I want Shivawn');
  });
});
