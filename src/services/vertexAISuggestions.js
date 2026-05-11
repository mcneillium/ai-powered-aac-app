// src/services/vertexAISuggestions.js
// Client-side service for calling Vertex AI-powered AAC suggestions
// via Firebase Cloud Functions. No secrets on the client.

import { getAuth } from 'firebase/auth';

const FUNCTIONS_BASE = 'https://us-central1-commai-b98fe.cloudfunctions.net';
const PHRASE_ENDPOINT = `${FUNCTIONS_BASE}/aacPhraseSuggestions`;
const IMAGE_AAC_ENDPOINT = `${FUNCTIONS_BASE}/imageToAACPhrases`;
const OCR_AAC_ENDPOINT = `${FUNCTIONS_BASE}/ocrToAACPhrases`;
const QUICK_PAGE_ENDPOINT = `${FUNCTIONS_BASE}/generateQuickPage`;
const REQUEST_TIMEOUT_MS = 10000;

// Circuit breaker: stop calling Vertex if it fails repeatedly
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000;
let _consecutiveFailures = 0;
let _circuitOpenUntil = 0;

function isCircuitOpen() {
  if (_consecutiveFailures < CIRCUIT_BREAKER_THRESHOLD) return false;
  if (Date.now() > _circuitOpenUntil) {
    _consecutiveFailures = 0;
    return false;
  }
  return true;
}

function recordSuccess() { _consecutiveFailures = 0; }
function recordFailure() {
  _consecutiveFailures++;
  if (_consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    _circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_RESET_MS;
  }
}

// LRU response cache for phrase suggestions
const _phraseCache = new Map();
const MAX_CACHE = 50;
function cacheGet(key) { return _phraseCache.get(key); }
function cacheSet(key, value) {
  if (_phraseCache.has(key)) _phraseCache.delete(key);
  _phraseCache.set(key, value);
  if (_phraseCache.size > MAX_CACHE) {
    _phraseCache.delete(_phraseCache.keys().next().value);
  }
}

async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const user = getAuth().currentUser;
    if (user) {
      headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
    }
  } catch {}
  return headers;
}

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
  if (isCircuitOpen()) return [];

  const cacheKey = currentWords.join(' ');
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(PHRASE_ENDPOINT, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        currentWords,
        recentPhrases,
        timeOfDay: getTimeOfDay(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      recordFailure();
      return [];
    }

    const result = await response.json();
    const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
    recordSuccess();
    if (suggestions.length > 0) cacheSet(cacheKey, suggestions);
    return suggestions;
  } catch (error) {
    recordFailure();
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
      headers: await getAuthHeaders(),
      body: JSON.stringify({ image: base64Image }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const result = await response.json();
    return Array.isArray(result.phrases) ? result.phrases : [];
  } catch {
    // Non-fatal: network error or timeout — return empty results
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
      headers: await getAuthHeaders(),
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
  } catch {
    // Non-fatal: network error or timeout — return empty results
    return { extractedText: '', phrases: [] };
  }
}

/**
 * Generate AAC phrases for a situation using AI.
 * Powers the "AI Quick Page" feature — describe a situation,
 * get a ready-to-use communication page.
 *
 * @param {string} situation - Description of the situation (e.g. "swimming lesson")
 * @param {string[]} existingPhrases - Optional existing phrases to complement
 * @returns {Promise<{ situationLabel: string, phrases: string[] }>}
 */
export async function generateQuickPagePhrases(situation, existingPhrases = []) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(QUICK_PAGE_ENDPOINT, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ situation, existingPhrases }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return { situationLabel: situation, phrases: [] };

    const result = await response.json();
    return {
      situationLabel: result.situationLabel || situation,
      phrases: Array.isArray(result.phrases) ? result.phrases : [],
    };
  } catch {
    // Non-fatal: network error or timeout — return empty results
    return { situationLabel: situation, phrases: [] };
  }
}
