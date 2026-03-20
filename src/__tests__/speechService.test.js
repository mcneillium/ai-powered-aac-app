// Tests for speechService — the primary output channel for AAC users.
// Speech must be reliable: never crash, always handle edge cases gracefully.

const mockSpeak = jest.fn();
const mockStop = jest.fn();
const mockGetVoices = jest.fn(() =>
  Promise.resolve([
    { identifier: 'en-us-1', name: 'English US', language: 'en-US' },
    { identifier: 'en-gb-1', name: 'English UK', language: 'en-GB' },
  ])
);

jest.mock('expo-speech', () => ({
  speak: mockSpeak,
  stop: mockStop,
  getAvailableVoicesAsync: mockGetVoices,
}));

describe('speechService', () => {
  beforeEach(() => {
    mockSpeak.mockClear();
    mockStop.mockClear();
    mockGetVoices.mockClear();
    // Reset modules so each test gets fresh speechService state
    jest.resetModules();
  });

  test('speak calls Speech.speak with correct options', async () => {
    const { speak } = require('../services/speechService');
    await speak('hello', { rate: 1.2, pitch: 0.8, voice: 'en-us-1' });

    expect(mockSpeak).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({
        rate: 1.2,
        pitch: 0.8,
        voice: 'en-us-1',
      })
    );
  });

  test('speak ignores empty strings', async () => {
    const { speak } = require('../services/speechService');
    await speak('');
    await speak('   ');
    await speak(null);
    await speak(undefined);

    expect(mockSpeak).not.toHaveBeenCalled();
  });

  test('speak uses default rate and pitch when not specified', async () => {
    const { speak } = require('../services/speechService');
    await speak('hello');

    expect(mockSpeak).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({
        rate: 1.0,
        pitch: 1.0,
      })
    );
  });

  test('stop calls Speech.stop when speaking', async () => {
    const { speak, stop, getIsSpeaking } = require('../services/speechService');

    await speak('test');
    // Invoke the onStart callback to set isSpeaking=true
    const speechOpts = mockSpeak.mock.calls[0][1];
    speechOpts.onStart();

    expect(getIsSpeaking()).toBe(true);
    await stop();
    expect(mockStop).toHaveBeenCalled();
    expect(getIsSpeaking()).toBe(false);
  });

  test('getAvailableVoices returns voices', async () => {
    const { getAvailableVoices } = require('../services/speechService');

    const voices = await getAvailableVoices();
    expect(voices).toHaveLength(2);
    expect(voices[0].language).toBe('en-US');
  });

  test('getAvailableVoices returns empty array on error', async () => {
    mockGetVoices.mockRejectedValueOnce(new Error('fail'));
    const { getAvailableVoices } = require('../services/speechService');
    const voices = await getAvailableVoices();
    expect(voices).toEqual([]);
  });
});
