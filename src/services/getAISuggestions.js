// src/services/getAISuggestions.js
// Optional remote fallback. Keep simple; your app already prefers local.

export async function getAISuggestions(tokens, k = 5) {
  // If you have a server endpoint, call it here; otherwise return empty.
  // Example:
  // const res = await fetch('https://your-api/suggest', { method:'POST', body: JSON.stringify({ tokens, k })});
  // return await res.json();

  return []; // no-op fallback
}
