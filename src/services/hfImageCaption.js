// services/hfImageCaption.js
// Image captioning via backend proxy.
//
// Architecture:
// - The mobile app sends base64 image data to a Firebase Cloud Function.
// - The Cloud Function holds the Hugging Face token server-side and proxies
//   the request. The mobile app NEVER sees the HF token.
// - Falls back to a safe "caption unavailable" message when offline or
//   when the backend is unreachable.

import * as FileSystem from 'expo-file-system';

// The Cloud Function endpoint for image captioning.
// This URL is set after deploying the Cloud Function — see docs/architecture/mobile-api-architecture.md.
// IMPORTANT: This is a public HTTPS endpoint, NOT a secret. The secret (HF token) lives server-side only.
const IMAGE_CAPTION_ENDPOINT =
  'https://us-central1-commai-b98fe.cloudfunctions.net/imageCaptionProxy';

// Timeout for the backend call (ms). Image captioning is network-dependent;
// fail fast so the user isn't blocked.
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Get an AI-generated caption for an image via the backend proxy.
 *
 * @param {string} imageUri - Local file URI of the image
 * @returns {Promise<string>} A text description of the image
 */
export const getImageCaption = async (imageUri) => {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(IMAGE_CAPTION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn('Image caption backend error:', response.status, errorText);
      return 'Caption unavailable — try again later';
    }

    const result = await response.json();
    return result.caption || 'No description available';
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Image caption request timed out');
      return 'Caption timed out — try again later';
    }
    console.warn('Image caption error:', error.message);
    return 'Caption unavailable — check your connection';
  }
};
