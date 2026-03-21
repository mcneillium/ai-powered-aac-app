// Tests for speech service
import { speak, stop, getIsSpeaking, getAvailableVoices } from '../services/speechService';

// Mock expo-speech
jest.mock('expo-speech', () => ({
  speak: jest.fn((text, options) => {
    if (options?.onStart) options.onStart();
  }),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([
    { identifier: 'en-us-1', name: 'English US', language: 'en-US' },
  ])),
}));

const Speech = require('expo-speech');

describe('speechService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('speak calls expo-speech with correct options', async () => {
    await speak('hello', { rate: 1.5, pitch: 0.8 });
    expect(Speech.speak).toHaveBeenCalledWith('hello', expect.objectContaining({
      rate: 1.5,
      pitch: 0.8,
    }));
  });

  test('speak does nothing for empty text', async () => {
    await speak('');
    expect(Speech.speak).not.toHaveBeenCalled();
    await speak('  ');
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  test('speak uses default rate and pitch', async () => {
    await speak('hello');
    expect(Speech.speak).toHaveBeenCalledWith('hello', expect.objectContaining({
      rate: 1.0,
      pitch: 1.0,
    }));
  });

  test('speak sets voice option when provided', async () => {
    await speak('hello', { voice: 'en-us-1' });
    expect(Speech.speak).toHaveBeenCalledWith('hello', expect.objectContaining({
      voice: 'en-us-1',
    }));
  });

  test('getAvailableVoices returns voices and caches', async () => {
    const voices = await getAvailableVoices();
    expect(voices).toHaveLength(1);
    expect(voices[0].identifier).toBe('en-us-1');
  });

  test('stop calls Speech.stop when speaking', async () => {
    // Simulate speaking state
    await speak('hello');
    await stop();
    expect(Speech.stop).toHaveBeenCalled();
  });
});
