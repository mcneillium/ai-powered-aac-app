// src/services/speechService.js
// Centralized speech service for the AAC app.
// Manages speech queue, cancellation, and voice settings.
// All speech output goes through this module.

import * as Speech from 'expo-speech';

let isSpeaking = false;

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

  // Stop any current speech first — prevents garbled overlapping output
  await stop();

  const speechOptions = {
    rate: options.rate ?? 1.0,
    pitch: options.pitch ?? 1.0,
    onStart: () => { isSpeaking = true; },
    onDone: () => {
      isSpeaking = false;
      if (options.onDone) options.onDone();
    },
    onError: () => { isSpeaking = false; },
    onStopped: () => { isSpeaking = false; },
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
 */
export async function stop() {
  if (isSpeaking) {
    Speech.stop();
    isSpeaking = false;
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
