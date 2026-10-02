// src/services/aiBackend.js
// Single client for the app's Cloud Function AI endpoints.
// Every request carries a Firebase ID token (signed-in or anonymous user) —
// the backend rejects unauthenticated calls to protect the AI budget.

import { auth } from '../../firebaseConfig';

const FUNCTIONS_BASE =
  process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL ||
  'https://us-central1-commai-b98fe.cloudfunctions.net';

export const ENDPOINTS = {
  caption: `${FUNCTIONS_BASE}/imageCaptionProxy`,
  phraseSuggestions: `${FUNCTIONS_BASE}/aacPhraseSuggestions`,
  imageToAAC: `${FUNCTIONS_BASE}/imageToAACPhrases`,
  ocrToAAC: `${FUNCTIONS_BASE}/ocrToAACPhrases`,
};

async function getIdToken() {
  try {
    return (await auth?.currentUser?.getIdToken()) || null;
  } catch {
    return null;
  }
}

/**
 * POST JSON to an AI endpoint with auth + timeout.
 * Returns the parsed JSON body, or null on any failure (network, auth,
 * timeout, non-2xx). Callers always have a local fallback path.
 */
export async function callAIBackend(endpoint, body, timeoutMs = 10000, label = 'ai') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = await getIdToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[aiBackend] ${label} HTTP ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`[aiBackend] ${label} timed out after ${timeoutMs}ms`);
    } else {
      console.warn(`[aiBackend] ${label} failed:`, error.message);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
