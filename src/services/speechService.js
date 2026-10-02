// src/services/speechService.js
// Centralized speech service for the AAC app.
// Manages speech queue, cancellation, voice settings, and expressive presets.
// All speech output goes through this module.
//
// Reliability rules:
// - Every speak() gets a generation number; stop() and any newer speak()
//   invalidate older generations. Callbacks from an old generation are
//   ignored, so a late error/stop event can never restart speech after Stop,
//   and two rapid taps can never both play.
// - Text longer than the platform limit (~4000 chars on Android) fails
//   silently, so it is split into chunks and queued in order.
// - A saved voice that is missing on this device (e.g. settings synced from
//   another phone) is dropped. If the engine reports an error BEFORE the
//   utterance starts, the remaining text is retried once with the system
//   default voice. Errors after speech has started are not retried (that
//   would repeat words the listener already heard).
// - Voice lookups time out: on Android with no working TTS engine the voice
//   list never resolves, and speech must not wait on it.
// - Speaking state cannot get stuck: it clears on done/stopped/error, and a
//   watchdog checks the engine if no completion event arrives.
// - If speech never starts (no TTS engine / no voice data), listeners get an
//   'unavailable' status so the UI can say so; the message stays on screen.
// - Pronunciation corrections are applied here so every screen benefits; the
//   on-screen text is never changed.

import * as Speech from 'expo-speech';
import { applyPronunciations } from './pronunciationStore';

// Android's TextToSpeech rejects input over its limit without an error.
const FALLBACK_MAX_INPUT = 4000;
const VOICE_LOOKUP_TIMEOUT_MS = 1500;
const START_TIMEOUT_MS = 5000;
const WATCHDOG_MIN_MS = 4000;

let generation = 0;
let isSpeaking = false;
let watchdogTimer = null;
let startTimer = null;

// ── Status listeners (UI can show a notice when speech is unavailable) ──
const statusListeners = new Set();
let lastStatus = { speaking: false, error: null };

function emitStatus(next) {
  lastStatus = { ...lastStatus, ...next };
  statusListeners.forEach(fn => {
    try { fn(lastStatus); } catch { /* listener errors never affect speech */ }
  });
}

/** Subscribe to { speaking, error } changes. Returns an unsubscribe function. */
export function subscribeSpeechStatus(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function getSpeechStatus() {
  return lastStatus;
}

// ── Expressive Voice Presets ──
// Rate and pitch are MULTIPLIERS on the user's own voice settings, so a user
// who chose a slow speech rate in Settings keeps it when picking "Excited".
export const voicePresets = {
  normal:  { label: 'Normal',  rate: 1.0, pitch: 1.0,  icon: 'mic-outline' },
  calm:    { label: 'Calm',    rate: 0.8, pitch: 0.9,  icon: 'leaf-outline' },
  excited: { label: 'Excited', rate: 1.3, pitch: 1.2,  icon: 'flash-outline' },
  serious: { label: 'Serious', rate: 0.9, pitch: 0.8,  icon: 'shield-outline' },
  gentle:  { label: 'Gentle',  rate: 0.7, pitch: 1.1,  icon: 'heart-outline' },
  loud:    { label: 'Loud',    rate: 1.1, pitch: 1.0,  icon: 'volume-high-outline' },
};

const RATE_RANGE = [0.1, 2.0];
const PITCH_RANGE = [0.5, 2.0];

function clamp(value, [min, max]) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Apply a voice preset to the user's base options, returning merged options.
 * The preset scales the base rate/pitch (default 1.0) rather than replacing it.
 */
export function applyPreset(presetId, baseOptions = {}) {
  const preset = voicePresets[presetId];
  if (!preset) return baseOptions;
  return {
    ...baseOptions,
    rate: clamp((baseOptions.rate ?? 1.0) * preset.rate, RATE_RANGE),
    pitch: clamp((baseOptions.pitch ?? 1.0) * preset.pitch, PITCH_RANGE),
  };
}

/**
 * Build speak() options from the user's settings and an optional preset.
 * Every screen should use this so speech sounds the same everywhere.
 */
export function buildSpeechOptions(settings = {}, presetId = 'normal') {
  return applyPreset(presetId, {
    rate: settings.speechRate ?? 1.0,
    pitch: settings.speechPitch ?? 1.0,
    voice: settings.speechVoice || null,
  });
}

/**
 * Split text into pieces no longer than maxLen, preferring sentence and word
 * boundaries so speech does not break mid-word.
 */
export function chunkText(text, maxLen = FALLBACK_MAX_INPUT) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > maxLen) {
    const window = rest.slice(0, maxLen);
    let cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
    if (cut > 0) cut += 1;
    else cut = window.lastIndexOf(' ');
    if (cut <= 0) cut = maxLen;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

function getMaxInputLength() {
  const max = Speech.maxSpeechInputLength;
  return typeof max === 'number' && Number.isFinite(max) && max > 0
    ? Math.min(max, FALLBACK_MAX_INPUT)
    : FALLBACK_MAX_INPUT;
}

function clearTimers() {
  clearTimeout(watchdogTimer);
  clearTimeout(startTimer);
  watchdogTimer = null;
  startTimer = null;
}

function setIdle() {
  clearTimers();
  if (isSpeaking || lastStatus.speaking) {
    isSpeaking = false;
    emitStatus({ speaking: false });
  }
}

/**
 * Speak text with the user's preferred settings.
 * Stops any current speech before starting.
 *
 * @param {string} text - Text to speak
 * @param {object} options - Speech options from settings
 * @param {number} [options.rate] - Speech rate (0.1 to 2.0, default 1.0)
 * @param {number} [options.pitch] - Speech pitch (0.5 to 2.0, default 1.0)
 * @param {string} [options.voice] - Voice identifier (null = system default)
 * @param {string} [options.language] - Language code (e.g., 'en-US')
 * @param {function} [options.onDone] - Callback when speech finishes
 */
export async function speak(text, options = {}) {
  if (!text || !text.trim()) return;

  // Claim a new generation BEFORE any await, so a newer tap always wins.
  const gen = ++generation;
  clearTimers();
  await nativeStop();

  const spoken = applyPronunciations(text.trim());
  const chunks = chunkText(spoken, getMaxInputLength());
  const voice = await resolveVoice(options.voice);

  // Another speak() or stop() happened while we were waiting.
  if (gen !== generation) return;

  isSpeaking = true;
  emitStatus({ speaking: true, error: null });
  startChunks(gen, chunks, 0, options, voice, true);
}

/**
 * Queue chunks[from..] for one generation. Tracks whether speech actually
 * started so errors before start can be retried once with the default voice.
 */
function startChunks(gen, chunks, from, options, voice, allowRetry) {
  let started = false;

  // No onStart within the timeout → the engine is missing or has no voice data.
  startTimer = setTimeout(() => {
    if (gen !== generation || started) return;
    setIdle();
    emitStatus({ error: 'unavailable' });
  }, START_TIMEOUT_MS);

  for (let i = from; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isLast = i === chunks.length - 1;
    const speechOptions = {
      rate: options.rate ?? 1.0,
      pitch: options.pitch ?? 1.0,
      onStart: () => {
        if (gen !== generation) return;
        if (!started) {
          started = true;
          clearTimeout(startTimer);
          armWatchdog(gen, chunks.slice(i).join(' '), options.rate ?? 1.0);
        }
      },
      onDone: () => {
        if (gen !== generation || !isLast) return;
        setIdle();
        if (options.onDone) options.onDone();
      },
      onStopped: () => {
        if (gen !== generation) return;
        setIdle();
      },
      onError: () => {
        if (gen !== generation) return; // stale: e.g. web fires onerror on cancel()
        if (!started && allowRetry && voice) {
          // The chosen voice failed before anything was heard: replace this
          // attempt with the remaining text in the default voice, once.
          const retryGen = ++generation;
          clearTimers();
          nativeStop().then(() => {
            if (retryGen !== generation) return;
            startChunks(retryGen, chunks, i, options, null, false);
          });
          return;
        }
        setIdle();
        emitStatus({ error: 'failed' });
      },
    };
    if (voice) speechOptions.voice = voice;
    if (options.language) speechOptions.language = options.language;

    try {
      // Speech is queued by the native engine, so chunks play in order.
      const result = Speech.speak(chunk, speechOptions);
      // Some platforms reject asynchronously (e.g. iOS with an unknown voice
      // throws natively and never emits an error event).
      if (result && typeof result.catch === 'function') {
        result.catch(() => speechOptions.onError());
      }
    } catch {
      speechOptions.onError();
      return;
    }
  }
}

/**
 * Safety net for platforms that occasionally never send onDone: after the
 * expected duration, ask the engine whether it is still speaking.
 */
function armWatchdog(gen, text, rate) {
  // ~15 characters per second at rate 1.0, plus generous slack.
  const expected = (text.length / (15 * Math.max(rate, 0.1))) * 1000;
  const delay = Math.max(WATCHDOG_MIN_MS, expected * 1.5 + 2000);
  clearTimeout(watchdogTimer);
  watchdogTimer = setTimeout(async () => {
    if (gen !== generation) return;
    let still = false;
    try {
      still = typeof Speech.isSpeakingAsync === 'function' && await Speech.isSpeakingAsync();
    } catch { /* assume finished */ }
    if (gen !== generation) return;
    if (still) armWatchdog(gen, '', rate);
    else setIdle();
  }, delay);
}

/**
 * Return the voice id if it exists on this device, otherwise null (system
 * default). Unknown voice lists (e.g. engine not ready) keep the saved voice.
 */
async function resolveVoice(voiceId) {
  if (!voiceId) return null;
  const voices = await getAvailableVoices();
  if (!voices || voices.length === 0) return voiceId;
  return voices.some(v => v.identifier === voiceId) ? voiceId : null;
}

async function nativeStop() {
  try {
    await Speech.stop();
  } catch {
    // Nothing to stop
  }
}

/**
 * Stop any current speech output immediately and invalidate pending
 * callbacks, so nothing queued or retried can start afterwards.
 */
export async function stop() {
  generation++;
  setIdle();
  await nativeStop();
}

/**
 * Check if speech is currently active.
 */
export function getIsSpeaking() {
  return isSpeaking;
}

/**
 * Get available voices on this device.
 * Non-empty results are cached; an empty list is retried later because
 * Android can report no voices before its TTS engine has initialised. The
 * lookup times out because a missing engine never answers at all.
 */
let cachedVoices = null;
let lastEmptyFetch = 0;
const EMPTY_RETRY_MS = 30000;
export async function getAvailableVoices() {
  if (cachedVoices) return cachedVoices;
  // Don't re-query on every tap while the engine keeps reporting no voices.
  if (lastEmptyFetch && Date.now() - lastEmptyFetch < EMPTY_RETRY_MS) return [];
  try {
    let timer;
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve(null), VOICE_LOOKUP_TIMEOUT_MS);
    });
    const voices = await Promise.race([Speech.getAvailableVoicesAsync(), timeout]);
    clearTimeout(timer);
    if (!Array.isArray(voices) || voices.length === 0) {
      lastEmptyFetch = Date.now();
      return [];
    }
    cachedVoices = voices;
    return voices;
  } catch (e) {
    console.warn('Failed to get available voices:', e);
    lastEmptyFetch = Date.now();
    return [];
  }
}

/** Test helper: reset module state. */
export function _resetSpeechForTests() {
  generation = 0;
  isSpeaking = false;
  clearTimers();
  cachedVoices = null;
  lastEmptyFetch = 0;
  lastStatus = { speaking: false, error: null };
  statusListeners.clear();
}
