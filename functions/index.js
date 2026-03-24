// functions/index.js
// Firebase Cloud Functions — server-side proxy for AI APIs.
//
// The mobile app calls these HTTPS endpoints. Secrets are stored
// in Firebase Functions config — the mobile app NEVER sees them.
//
// Setup:
//   firebase functions:config:set hf.token="hf_YOUR_TOKEN_HERE"
//   firebase functions:config:set vertex.project_id="commai-b98fe"
//   firebase deploy --only functions

const functions = require('firebase-functions');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
admin.initializeApp();

// ── CORS helper ──
function setCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ════════════════════════════════════════════
// 1. IMAGE CAPTION PROXY (Hugging Face)
// ════════════════════════════════════════════
exports.imageCaptionProxy = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Missing "image" field (base64)' });

  const hfToken = functions.config().hf?.token;
  if (!hfToken) {
    console.error('HF token not configured.');
    return res.status(500).json({ error: 'Image captioning service not configured' });
  }

  try {
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
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

// ════════════════════════════════════════════
// 2. AAC PHRASE SUGGESTIONS (Vertex AI Gemini)
// ════════════════════════════════════════════
//
// Uses Vertex AI Gemini to generate contextual AAC phrase suggestions.
// Input: current sentence words, user context (time of day, recent phrases)
// Output: array of simple, AAC-appropriate phrase completions
//
// Setup:
//   firebase functions:config:set vertex.project_id="commai-b98fe"
//   Ensure the Cloud Functions service account has Vertex AI User role.
//   The function uses Application Default Credentials (ADC) — no API key needed.

const VERTEX_SYSTEM_PROMPT = `You are a communication assistant for an AAC (Augmentative and Alternative Communication) app called Voice.
Users have speech or motor disabilities and communicate by tapping words.

Your job: suggest 4-6 short, practical phrase completions or next phrases.

Rules:
- Keep phrases SHORT (2-5 words max)
- Use simple, everyday vocabulary
- Never use complex grammar, slang, or idioms
- Suggest practical, functional communication (needs, feelings, social phrases)
- Be child-friendly and appropriate for all ages
- Never suggest medical advice or diagnoses
- If the context is about food, suggest food-related phrases
- If the context is about feelings, suggest emotion expressions
- If no context, suggest common daily communication starters
- Return ONLY a JSON array of strings, nothing else

Example: ["I want more", "thank you", "I am done", "help please"]`;

exports.aacPhraseSuggestions = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { currentWords, recentPhrases, timeOfDay } = req.body || {};

  const projectId = functions.config().vertex?.project_id || 'commai-b98fe';
  const location = 'europe-west1';
  const model = 'gemini-2.0-flash-lite';

  // Build the user prompt
  let userPrompt = 'Suggest AAC phrases';
  if (currentWords && currentWords.length > 0) {
    userPrompt += `. Current sentence so far: "${currentWords.join(' ')}"`;
  }
  if (recentPhrases && recentPhrases.length > 0) {
    userPrompt += `. Recently spoken: ${recentPhrases.slice(0, 3).join(', ')}`;
  }
  if (timeOfDay) {
    userPrompt += `. Time of day: ${timeOfDay}`;
  }
  userPrompt += '. Return a JSON array of 4-6 short phrase suggestions.';

  try {
    // Use ADC (Application Default Credentials) for Vertex AI
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const vertexResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
        systemInstruction: { parts: [{ text: VERTEX_SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 256,
          topP: 0.9,
        },
      }),
    });

    if (!vertexResponse.ok) {
      const errText = await vertexResponse.text().catch(() => '');
      console.error('Vertex AI error:', vertexResponse.status, errText);
      return res.status(502).json({ error: 'AI suggestion service error', suggestions: [] });
    }

    const vertexResult = await vertexResponse.json();
    const rawText = vertexResult.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // Parse the JSON array from the response
    let suggestions = [];
    try {
      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.warn('Failed to parse Vertex AI suggestions:', rawText);
      suggestions = [];
    }

    // Validate: only keep short strings
    suggestions = suggestions
      .filter(s => typeof s === 'string' && s.length > 0 && s.length <= 40)
      .slice(0, 6);

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error('AAC suggestion error:', error.message);
    return res.status(500).json({ error: 'Internal server error', suggestions: [] });
  }
});

// ════════════════════════════════════════════
// 3. IMAGE TO AAC PHRASES (Vertex AI Vision)
// ════════════════════════════════════════════
//
// Takes an image and returns AAC-friendly phrase suggestions
// describing the scene — not just a caption, but communication-ready phrases.

const IMAGE_AAC_PROMPT = `Look at this image. You are helping an AAC user communicate about what they see.

Generate 4-6 short, simple phrases (2-5 words each) that an AAC user might want to say about this image.
Focus on: what objects are visible, what actions are happening, feelings it might evoke.

Return ONLY a JSON array of strings. Example: ["I see a dog", "it is big", "I like it", "can I touch"]`;

exports.imageToAACPhrases = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Missing "image" field (base64)' });

  const projectId = functions.config().vertex?.project_id || 'commai-b98fe';
  const location = 'europe-west1';
  const model = 'gemini-2.0-flash-lite';

  try {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const vertexResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: IMAGE_AAC_PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: image } },
          ],
        }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 256,
          topP: 0.9,
        },
      }),
    });

    if (!vertexResponse.ok) {
      const errText = await vertexResponse.text().catch(() => '');
      console.error('Vertex Vision error:', vertexResponse.status, errText);
      return res.status(502).json({ error: 'AI vision service error', phrases: [] });
    }

    const result = await vertexResponse.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    let phrases = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) phrases = JSON.parse(jsonMatch[0]);
    } catch {
      phrases = [];
    }

    phrases = phrases
      .filter(s => typeof s === 'string' && s.length > 0 && s.length <= 40)
      .slice(0, 6);

    return res.status(200).json({ phrases });
  } catch (error) {
    console.error('Image-to-AAC error:', error.message);
    return res.status(500).json({ error: 'Internal server error', phrases: [] });
  }
});
