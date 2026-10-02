// src/services/speechService.js
// Centralized speech service for the AAC app.
// Manages speech queue, cancellation, voice settings, and expressive presets.
// All speech output goes through this module.
//
// Reliability rules:
// - Always call Speech.stop() before speaking; never rely on onStart having fired.
// - Text longer than the platform limit (~4000 chars on Android) fails silently,
//   so it is split into chunks and queued.
// - If a saved voice is unavailable on this device (e.g. settings synced from
//   another phone) or the engine reports an error, retry once with the default voice.
// - Pronunciation corrections are applied here so every screen benefits; the
//   on-screen text is never changed.

import * as Speech from 'expo-speech';
import { applyPronunciations } from './pronunciationStore';

let isSpeaking = false;

// Android's TextToSpeech rejects input over its limit without an error.
const FALLBACK_MAX_INPUT = 4000;

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

  // Stop any current speech first
  await stop();

  const spoken = applyPronunciations(text.trim());
  const chunks = chunkText(spoken, getMaxInputLength());
  const voice = await resolveVoice(options.voice);

  chunks.forEach((chunk, i) => {
    const isLast = i === chunks.length - 1;
    speakChunk(chunk, options, voice, isLast, true);
  });
}

function speakChunk(chunk, options, voice, isLast, allowRetry) {
  const speechOptions = {
    rate: options.rate ?? 1.0,
    pitch: options.pitch ?? 1.0,
    onStart: () => { isSpeaking = true; },
    onDone: () => {
      if (!isLast) return;
      isSpeaking = false;
      if (options.onDone) options.onDone();
    },
    onError: () => {
      isSpeaking = false;
      // A missing/broken voice should never leave the user silent: retry
      // once with the system default voice.
      if (allowRetry && voice) {
        speakChunk(chunk, options, null, isLast, false);
      }
    },
    onStopped: () => { isSpeaking = false; },
  };

  if (voice) {
    speechOptions.voice = voice;
  }
  if (options.language) {
    speechOptions.language = options.language;
  }

  // Speech is queued by the native engine, so chunks play in order.
  isSpeaking = true;
  Speech.speak(chunk, speechOptions);
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

/**
 * Stop any current speech output immediately.
 * Always calls the native stop: onStart is not guaranteed to fire on every
 * platform, so the local flag alone is not a reliable signal.
 */
export async function stop() {
  isSpeaking = false;
  try {
    await Speech.stop();
  } catch {
    // Nothing to stop
  }
}

/**
 * Check if speech is currently active.
 */
export function getIsSpeaking() {
  return isSpeaking;
}

/**
 * Get available voices on this device.
 * Non-empty results are cached; an empty list is retried next time because
 * Android can report no voices before its TTS engine has initialised.
 */
let cachedVoices = null;
let lastEmptyFetch = 0;
const EMPTY_RETRY_MS = 30000;
export async function getAvailableVoices() {
  if (cachedVoices) return cachedVoices;
  // Don't re-query on every tap while the engine keeps reporting no voices.
  if (lastEmptyFetch && Date.now() - lastEmptyFetch < EMPTY_RETRY_MS) return [];
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!Array.isArray(voices) || voices.length === 0) lastEmptyFetch = Date.now();
    if (Array.isArray(voices) && voices.length > 0) cachedVoices = voices;
    return voices || [];
  } catch (e) {
    console.warn('Failed to get available voices:', e);
    return [];
  }
}
