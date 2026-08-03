// src/services/vertexAISuggestions.js
// Client-side service for calling Vertex AI-powered AAC suggestions
// via Firebase Cloud Functions. No secrets on the client; requests are
// authenticated with the current Firebase user's ID token.

import { callAIBackend, ENDPOINTS } from './aiBackend';

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

/**
 * Get AI-powered AAC phrase suggestions based on current context.
 *
 * @param {string[]} currentWords - Words in the current sentence
 * @param {string[]} recentPhrases - Recently spoken phrases
 * @returns {Promise<string[]>} Array of phrase suggestions (empty on failure)
 */
export async function getAACPhraseSuggestions(currentWords = [], recentPhrases = []) {
  const result = await callAIBackend(
    ENDPOINTS.phraseSuggestions,
    { currentWords, recentPhrases, timeOfDay: getTimeOfDay() },
    10000,
    'phrase-suggestions'
  );
  return Array.isArray(result?.suggestions) ? result.suggestions : [];
}

/**
 * Get AAC-friendly phrases describing an image.
 *
 * @param {string} base64Image - Base64-encoded image data
 * @returns {Promise<string[]>} Array of AAC phrase suggestions (empty on failure)
 */
export async function getImageAACPhrases(base64Image) {
  const result = await callAIBackend(
    ENDPOINTS.imageToAAC,
    { image: base64Image },
    15000,
    'image-aac'
  );
  return Array.isArray(result?.phrases) ? result.phrases : [];
}

/**
 * Read text from a photo (sign, menu, label) and get AAC phrases.
 *
 * @param {string} base64Image - Base64-encoded image data
 * @returns {Promise<{ extractedText: string, phrases: string[] }>}
 */
export async function getOCRAACPhrases(base64Image) {
  const result = await callAIBackend(
    ENDPOINTS.ocrToAAC,
    { image: base64Image },
    15000,
    'ocr-aac'
  );
  return {
    extractedText: typeof result?.extractedText === 'string' ? result.extractedText : '',
    phrases: Array.isArray(result?.phrases) ? result.phrases : [],
  };
}
