// src/services/vertexAISuggestions.js
// Client-side service for calling Vertex AI-powered AAC suggestions
// via Firebase Cloud Functions. No secrets on the client.

const FUNCTIONS_BASE = 'https://us-central1-commai-b98fe.cloudfunctions.net';
const PHRASE_ENDPOINT = `${FUNCTIONS_BASE}/aacPhraseSuggestions`;
const IMAGE_AAC_ENDPOINT = `${FUNCTIONS_BASE}/imageToAACPhrases`;
const OCR_AAC_ENDPOINT = `${FUNCTIONS_BASE}/ocrToAACPhrases`;
const REQUEST_TIMEOUT_MS = 10000;

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
 * Uses Vertex AI Gemini via Cloud Function.
 *
 * @param {string[]} currentWords - Words in the current sentence
 * @param {string[]} recentPhrases - Recently spoken phrases
 * @returns {Promise<string[]>} Array of phrase suggestions
 */
export async function getAACPhraseSuggestions(currentWords = [], recentPhrases = []) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(PHRASE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentWords,
        recentPhrases,
        timeOfDay: getTimeOfDay(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const result = await response.json();
    return Array.isArray(result.suggestions) ? result.suggestions : [];
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Vertex AI suggestion request timed out');
    }
    return [];
  }
}

/**
 * Get AAC-friendly phrases describing an image.
 * Uses Vertex AI Gemini Vision via Cloud Function.
 *
 * @param {string} base64Image - Base64-encoded image data
 * @returns {Promise<string[]>} Array of AAC phrase suggestions
 */
export async function getImageAACPhrases(base64Image) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(IMAGE_AAC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const result = await response.json();
    return Array.isArray(result.phrases) ? result.phrases : [];
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Image AAC request timed out');
    }
    return [];
  }
}

/**
 * Read text from a photo (sign, menu, label) and get AAC phrases.
 * Uses Vertex AI Gemini Vision OCR via Cloud Function.
 *
 * @param {string} base64Image - Base64-encoded image data
 * @returns {Promise<{ extractedText: string, phrases: string[] }>}
 */
export async function getOCRAACPhrases(base64Image) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(OCR_AAC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return { extractedText: '', phrases: [] };

    const result = await response.json();
    return {
      extractedText: result.extractedText || '',
      phrases: Array.isArray(result.phrases) ? result.phrases : [],
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('OCR AAC request timed out');
    }
    return { extractedText: '', phrases: [] };
  }
}
