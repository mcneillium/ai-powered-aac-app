// src/services/getAISuggestions.js
// Remote fallback ONLY. Do not import from other local services here.

export async function getAISuggestions(text) {
  const url = 'https://<your-endpoint>/suggest'; // <-- replace
  const body = { prompt: String(text || '').slice(0, 500) };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.log('[getAISuggestions] HTTP', res.status);
      return [];
    }

    const data = await res.json();
    if (Array.isArray(data)) return data.map(String);
    if (Array.isArray(data?.suggestions)) return data.suggestions.map(String);
    return [];
  } catch (e) {
    console.log('[getAISuggestions] remote error:', e?.message || e);
    return [];
  }
}

export default getAISuggestions;
