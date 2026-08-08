// src/services/speechService.js
// Centralized speech service for the AAC app.
// Manages speech queue, cancellation, voice settings, and expressive presets.
// All speech output goes through this module.

import * as Speech from 'expo-speech';

let isSpeaking = false;
// Set synchronously by speak(); isSpeaking is only set by the async onStart
// callback and so cannot be trusted to decide whether a stop is needed.
let speakRequested = false;

// ── Expressive Voice Presets ──
// These adjust rate and pitch to convey different moods/intentions.
// Users can select a preset from the AAC Board.
export const voicePresets = {
  normal:  { label: 'Normal',  rate: 1.0, pitch: 1.0,  icon: 'mic-outline' },
  calm:    { label: 'Calm',    rate: 0.8, pitch: 0.9,  icon: 'leaf-outline' },
  excited: { label: 'Excited', rate: 1.3, pitch: 1.2,  icon: 'flash-outline' },
  serious: { label: 'Serious', rate: 0.9, pitch: 0.8,  icon: 'shield-outline' },
  gentle:  { label: 'Gentle',  rate: 0.7, pitch: 1.1,  icon: 'heart-outline' },
  loud:    { label: 'Loud',    rate: 1.1, pitch: 1.0,  icon: 'volume-high-outline' },
};

// expo-speech clamps outside these; clamping here keeps a preset from pushing a
// user's already-extreme setting somewhere unintelligible.
const RATE_RANGE = [0.1, 2.0];
const PITCH_RANGE = [0.5, 2.0];

const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));

/**
 * Apply a voice preset on top of the user's speech settings.
 *
 * Presets are **multipliers**, not replacements. They used to overwrite `rate`
 * and `pitch` outright, which silently discarded the user's own setting on
 * every board utterance: `voicePresets.normal` is {1.0, 1.0} and is the
 * default, so a user who chose 0.5x in Settings was spoken at 1.0x. Two paths
 * (repeat-from-history, speak-favourite) bypassed this function entirely and
 * did honour the setting, so the same word spoke at different speeds depending
 * on how it was triggered.
 *
 * Speech rate is not a cosmetic preference in AAC — it is what makes the
 * utterance intelligible to the listener, and for some users what makes it
 * comprehensible to themselves.
 */
export function applyPreset(presetId, baseOptions = {}) {
  const preset = voicePresets[presetId];
  if (!preset) return baseOptions;
  const baseRate = baseOptions.rate ?? 1.0;
  const basePitch = baseOptions.pitch ?? 1.0;
  return {
    ...baseOptions,
    rate: clamp(baseRate * preset.rate, RATE_RANGE),
    pitch: clamp(basePitch * preset.pitch, PITCH_RANGE),
  };
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

  // Stop any current speech first.
  //
  // `isSpeaking` alone is not enough to decide this: it only becomes true
  // inside the asynchronous `onStart` callback, so two taps in quick succession
  // both see `false`, both skip the stop, and expo-speech *queues* the second
  // utterance behind the first instead of replacing it. `speakRequested` is set
  // synchronously below, which closes that window.
  await stop({ force: speakRequested });
  speakRequested = true;

  const speechOptions = {
    rate: options.rate ?? 1.0,
    pitch: options.pitch ?? 1.0,
    onStart: () => { isSpeaking = true; },
    onDone: () => {
      isSpeaking = false;
      speakRequested = false;
      if (options.onDone) options.onDone();
    },
    onError: () => { isSpeaking = false; speakRequested = false; },
    onStopped: () => { isSpeaking = false; speakRequested = false; },
  };

  if (options.voice) {
    speechOptions.voice = options.voice;
  }
  if (options.language) {
    speechOptions.language = options.language;
  }

  Speech.speak(text, speechOptions);
}

/**
 * Stop any current speech output immediately.
 *
 * Call with no arguments from user-facing controls: `force` defaults to true so
 * a stop button always stops, even if the utterance has been requested but has
 * not yet reached `onStart`. The internal caller in `speak()` passes an explicit
 * `force` so the very first utterance of a session does not pay for a redundant
 * native call.
 */
export async function stop({ force = true } = {}) {
  if (isSpeaking || force) {
    Speech.stop();
    isSpeaking = false;
    speakRequested = false;
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
 * Results are cached after first call.
 */
let cachedVoices = null;
export async function getAvailableVoices() {
  if (cachedVoices) return cachedVoices;
  try {
    cachedVoices = await Speech.getAvailableVoicesAsync();
    return cachedVoices;
  } catch (e) {
    console.warn('Failed to get available voices:', e);
    return [];
  }
}
