// src/utils/sanitize.js
// Simple input sanitization for text written to Firebase.

/**
 * Strip HTML tags, trim whitespace, and enforce a max length.
 * @param {*} text - input value (non-strings return '')
 * @param {number} maxLen - maximum character length (default 500)
 * @returns {string}
 */
export function sanitizeText(text, maxLen = 500) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}
