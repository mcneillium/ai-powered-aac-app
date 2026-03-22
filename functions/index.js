// functions/index.js
// Firebase Cloud Functions — server-side proxy for third-party AI APIs.
//
// The mobile app calls these HTTPS endpoints. The Cloud Function holds
// the API secrets (Hugging Face token, etc.) via Firebase environment config.
// The mobile app NEVER sees these secrets.
//
// Setup:
//   firebase functions:config:set hf.token="hf_YOUR_TOKEN_HERE"
//   firebase deploy --only functions
//
// Or for v2 secrets:
//   firebase functions:secrets:set HF_TOKEN
//   firebase deploy --only functions

const functions = require('firebase-functions');
const fetch = require('node-fetch');

/**
 * imageCaptionProxy — proxies image captioning requests to Hugging Face.
 *
 * The mobile app sends: POST { image: "<base64>" }
 * This function sends: POST to HF API with Bearer token
 * Returns: { caption: "a cat sitting on a couch" }
 *
 * The HF token is stored in Firebase Functions config:
 *   firebase functions:config:set hf.token="hf_..."
 */
exports.imageCaptionProxy = functions.https.onRequest(async (req, res) => {
  // CORS: allow requests from any origin (mobile app uses fetch, not browser)
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: 'Missing "image" field (base64)' });
  }

  // Read HF token from Firebase config (set via CLI, never in code)
  const hfToken = functions.config().hf?.token;
  if (!hfToken) {
    console.error('HF token not configured. Run: firebase functions:config:set hf.token="hf_..."');
    return res.status(500).json({ error: 'Image captioning service not configured' });
  }

  try {
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: image }),
      }
    );

    if (!hfResponse.ok) {
      const errorText = await hfResponse.text().catch(() => '');
      console.error('HF API error:', hfResponse.status, errorText);
      return res.status(502).json({ error: 'Upstream captioning service error' });
    }

    const result = await hfResponse.json();
    const caption = result[0]?.generated_text || 'No description available';

    return res.status(200).json({ caption });
  } catch (error) {
    console.error('Image captioning proxy error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
