// src/services/speechService.js
// Centralized speech service for the AAC app.
// Manages speech queue, cancellation, voice settings, and expressive presets.
// All speech output goes through this module.

import * as Speech from 'expo-speech';

let isSpeaking = false;

// ── Speech event listeners ──
// Components can subscribe to know when text is spoken (e.g. Listener Display).
const speechListeners = new Set();
export function onSpeech(callback) {
  speechListeners.add(callback);
  return () => speechListeners.delete(callback);
}
function notifySpeechListeners(text) {
  speechListeners.forEach(cb => { try { cb(text); } catch {} });
}

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

/**
 * Apply a voice preset to user settings, returning merged options.
 */
export function applyPreset(presetId, baseOptions = {}) {
  const preset = voicePresets[presetId];
  if (!preset) return baseOptions;
  return {
    ...baseOptions,
    rate: preset.rate,
    pitch: preset.pitch,
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

  // Stop any current speech first
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
  notifySpeechListeners(text);
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
