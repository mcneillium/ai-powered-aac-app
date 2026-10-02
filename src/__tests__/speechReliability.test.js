// Reliability behaviour of the speech service: chunking, voice fallback,
// pronunciation, Stop, rapid taps, stale callbacks and stuck states.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([
    { identifier: 'device-voice', name: 'Device', language: 'en-GB' },
  ])),
  maxSpeechInputLength: 4000,
}));
const mockSpeech = require('expo-speech');

import {
  speak, stop, chunkText, getIsSpeaking, subscribeSpeechStatus,
  getAvailableVoices, _resetSpeechForTests,
} from '../services/speechService';
import { _resetPronunciationsForTests } from '../services/pronunciationStore';

const flush = () => new Promise(r => setTimeout(r, 0));
const lastCall = () => mockSpeech.speak.mock.calls[mockSpeech.speak.mock.calls.length - 1];

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  _resetSpeechForTests();
  _resetPronunciationsForTests([]);
  mockSpeech.getAvailableVoicesAsync.mockImplementation(() => Promise.resolve([
    { identifier: 'device-voice', name: 'Device', language: 'en-GB' },
  ]));
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

  test('splits text longer than the platform limit into ordered utterances', async () => {
    const long = Array.from({ length: 900 }, (_, i) => `word${i}`).join(' ');
    expect(long.length).toBeGreaterThan(4000);
    await speak(long);
    const chunks = mockSpeech.speak.mock.calls.map(([c]) => c);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(c => expect(c.length).toBeLessThanOrEqual(4000));
    expect(chunks.join(' ')).toBe(long);
  });

  test('drops a saved voice that does not exist on this device', async () => {
    await speak('hello', { voice: 'voice-from-another-phone' });
    expect(mockSpeech.speak.mock.calls[0][1].voice).toBeUndefined();
  });

  test('keeps a saved voice that exists on this device', async () => {
    await speak('hello', { voice: 'device-voice' });
    expect(mockSpeech.speak.mock.calls[0][1].voice).toBe('device-voice');
  });

  test('an error before speech starts retries once with the default voice', async () => {
    await speak('hello', { voice: 'device-voice' });
    mockSpeech.speak.mock.calls[0][1].onError();
    await flush();
    expect(mockSpeech.speak).toHaveBeenCalledTimes(2);
    expect(mockSpeech.speak.mock.calls[1][1].voice).toBeUndefined();
    // Only one retry
    mockSpeech.speak.mock.calls[1][1].onError();
    await flush();
    expect(mockSpeech.speak).toHaveBeenCalledTimes(2);
    expect(getIsSpeaking()).toBe(false);
  });

  test('an error after speech has started is not retried (no repeated words)', async () => {
    await speak('hello', { voice: 'device-voice' });
    const [, opts] = mockSpeech.speak.mock.calls[0];
    opts.onStart();
    opts.onError();
    await flush();
    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
    expect(getIsSpeaking()).toBe(false);
  });

  test('applies the pronunciation dictionary to spoken text only', async () => {
    _resetPronunciationsForTests([{ id: '1', written: 'Siobhan', spoken: 'Shivawn' }]);
    await speak('I want Siobhan');
    expect(mockSpeech.speak.mock.calls[0][0]).toBe('I want Shivawn');
  });
});

describe('Stop, rapid taps and stale callbacks', () => {
  test('an error event arriving after Stop does not restart speech', async () => {
    // Web fires onerror("interrupted") when speech is cancelled.
    await speak('hello', { voice: 'device-voice' });
    const [, opts] = mockSpeech.speak.mock.calls[0];
    await stop();
    opts.onError();
    await flush();
    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
    expect(getIsSpeaking()).toBe(false);
  });

  test('a stale error from the previous utterance cannot replay it', async () => {
    await speak('first', { voice: 'device-voice' });
    const [, firstOpts] = mockSpeech.speak.mock.calls[0];
    await speak('second', { voice: 'device-voice' });
    firstOpts.onError();
    await flush();
    expect(mockSpeech.speak.mock.calls.map(c => c[0])).toEqual(['first', 'second']);
  });

  test('rapid taps: only the latest utterance plays even when voice lookup is slow', async () => {
    let releaseVoices;
    mockSpeech.getAvailableVoicesAsync.mockImplementationOnce(
      () => new Promise(r => { releaseVoices = r; })
    );
    const p1 = speak('one', { voice: 'device-voice' });
    await flush();
    const p2 = speak('two');
    const p3 = speak('three');
    releaseVoices([{ identifier: 'device-voice' }]);
    await Promise.all([p1, p2, p3]);
    expect(mockSpeech.speak.mock.calls.map(c => c[0])).toEqual(['three']);
  });

  test('stop() during the voice lookup prevents speech entirely', async () => {
    let releaseVoices;
    mockSpeech.getAvailableVoicesAsync.mockImplementationOnce(
      () => new Promise(r => { releaseVoices = r; })
    );
    const p = speak('hello', { voice: 'device-voice' });
    await flush();
    await stop();
    releaseVoices([{ identifier: 'device-voice' }]);
    await p;
    expect(mockSpeech.speak).not.toHaveBeenCalled();
    expect(getIsSpeaking()).toBe(false);
  });

  test('speaking state clears on done, stopped and error', async () => {
    await speak('a');
    expect(getIsSpeaking()).toBe(true);
    lastCall()[1].onDone();
    expect(getIsSpeaking()).toBe(false);

    await speak('b');
    lastCall()[1].onStopped();
    expect(getIsSpeaking()).toBe(false);

    await speak('c');
    lastCall()[1].onStart();
    lastCall()[1].onError();
    expect(getIsSpeaking()).toBe(false);
  });

  test('a synchronous throw from the engine never leaves speech stuck', async () => {
    mockSpeech.speak.mockImplementationOnce(() => { throw new Error('engine gone'); });
    const statuses = [];
    subscribeSpeechStatus(s => statuses.push(s));
    await speak('hello');
    expect(getIsSpeaking()).toBe(false);
    expect(statuses[statuses.length - 1].error).toBe('failed');
  });
});

describe('missing engine / no voice data', () => {
  test('voice lookup times out instead of hanging when the engine never answers', async () => {
    jest.useFakeTimers();
    mockSpeech.getAvailableVoicesAsync.mockImplementationOnce(() => new Promise(() => {}));
    const p = getAvailableVoices();
    jest.advanceTimersByTime(1600);
    await expect(p).resolves.toEqual([]);
  });

  test('speech that never starts reports "unavailable" and clears speaking state', async () => {
    jest.useFakeTimers();
    const statuses = [];
    subscribeSpeechStatus(s => statuses.push(s));
    await speak('hello');
    expect(getIsSpeaking()).toBe(true);
    jest.advanceTimersByTime(5100);
    expect(getIsSpeaking()).toBe(false);
    expect(statuses[statuses.length - 1]).toEqual({ speaking: false, error: 'unavailable' });
  });

  test('watchdog clears a missing onDone once the engine reports idle', async () => {
    jest.useFakeTimers();
    await speak('hello');
    lastCall()[1].onStart(); // started, but onDone will never come
    expect(getIsSpeaking()).toBe(true);
    jest.advanceTimersByTime(10000);
    await Promise.resolve(); await Promise.resolve();
    expect(getIsSpeaking()).toBe(false);
  });
});

describe('review fixes', () => {
  test('a final error mid-queue cancels the remaining chunks', async () => {
    const long = Array.from({ length: 900 }, (_, i) => `word${i}`).join(' ');
    await speak(long);
    const calls = mockSpeech.speak.mock.calls;
    expect(calls.length).toBeGreaterThan(1);
    calls[0][1].onStart();
    const stopsBefore = mockSpeech.stop.mock.calls.length;
    calls[1][1].onError();
    expect(mockSpeech.stop.mock.calls.length).toBe(stopsBefore + 1);
    // A later chunk finishing must not be treated as current
    const doneSpy = jest.fn();
    calls[calls.length - 1][1].onDone(doneSpy);
    expect(getIsSpeaking()).toBe(false);
  });

  test('a saved voice that never starts (iOS silent rejection) retries with the default voice', async () => {
    jest.useFakeTimers();
    mockSpeech.getAvailableVoicesAsync.mockImplementationOnce(() => Promise.resolve([])); // list unknown → voice kept
    await speak('hello', { voice: 'ios-voice' });
    expect(mockSpeech.speak.mock.calls[0][1].voice).toBe('ios-voice');
    jest.advanceTimersByTime(5100);
    await Promise.resolve(); await Promise.resolve();
    expect(mockSpeech.speak).toHaveBeenCalledTimes(2);
    expect(mockSpeech.speak.mock.calls[1][1].voice).toBeUndefined();
  });

  test('a late start after the timeout restores the speaking state', async () => {
    jest.useFakeTimers();
    const statuses = [];
    subscribeSpeechStatus(s => statuses.push(s));
    await speak('hello');
    jest.advanceTimersByTime(5100);
    expect(statuses[statuses.length - 1].error).toBe('unavailable');
    lastCall()[1].onStart();
    expect(getIsSpeaking()).toBe(true);
    expect(statuses[statuses.length - 1]).toEqual({ speaking: true, error: null });
  });
});

