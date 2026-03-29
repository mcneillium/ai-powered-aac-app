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
const { GoogleAuth } = require('google-auth-library');
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

  // Input validation: limit array sizes to prevent abuse
  if (Array.isArray(currentWords) && currentWords.length > 50) {
    return res.status(400).json({ error: 'currentWords too long', suggestions: [] });
  }
  if (Array.isArray(recentPhrases) && recentPhrases.length > 10) {
    return res.status(400).json({ error: 'recentPhrases too long', suggestions: [] });
  }

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

  // Limit image size to ~5MB base64 (~3.75MB raw)
  if (typeof image !== 'string' || image.length > 7_000_000) {
    return res.status(400).json({ error: 'Image too large (max ~5MB)', phrases: [] });
  }

  const projectId = functions.config().vertex?.project_id || 'commai-b98fe';
  const location = 'europe-west1';
  const model = 'gemini-2.0-flash-lite';

  try {
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

// ════════════════════════════════════════════
// 4. OCR TO AAC PHRASES (Vertex AI Vision)
// ════════════════════════════════════════════
//
// Reads text from signs, menus, labels, and generates AAC-friendly
// phrases the user might want to say about what they read.
// Example: photo of a menu → "I want the pizza", "how much is it?"

const OCR_AAC_PROMPT = `You are helping an AAC user read and respond to text in their environment.

1. First, extract any readable text from this image (signs, menus, labels, screens, notices).
2. Then generate 4-6 short AAC phrases (2-5 words each) the user might want to say about what they read.
   Include a mix of: requesting, commenting, asking questions.
3. Return a JSON object with two fields:
   - "extractedText": the text you read from the image (string, max 200 chars)
   - "phrases": array of 4-6 short AAC phrase strings

Example: {"extractedText": "Pizza $8, Pasta $10, Salad $6", "phrases": ["I want pizza", "how much is it", "can I see the menu", "I want something else"]}`;

exports.ocrToAACPhrases = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Missing "image" field (base64)' });
  if (typeof image !== 'string' || image.length > 7_000_000) {
    return res.status(400).json({ error: 'Image too large', extractedText: '', phrases: [] });
  }

  const projectId = functions.config().vertex?.project_id || 'commai-b98fe';
  const location = 'europe-west1';
  const model = 'gemini-2.0-flash-lite';

  try {
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
            { text: OCR_AAC_PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: image } },
          ],
        }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 512, topP: 0.9 },
      }),
    });

    if (!vertexResponse.ok) {
      const errText = await vertexResponse.text().catch(() => '');
      console.error('OCR Vision error:', vertexResponse.status, errText);
      return res.status(502).json({ error: 'OCR service error', extractedText: '', phrases: [] });
    }

    const result = await vertexResponse.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed = { extractedText: '', phrases: [] };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // Try array-only fallback
      try {
        const arrMatch = rawText.match(/\[[\s\S]*\]/);
        if (arrMatch) parsed = { extractedText: '', phrases: JSON.parse(arrMatch[0]) };
      } catch { /* give up */ }
    }

    const extractedText = typeof parsed.extractedText === 'string'
      ? parsed.extractedText.slice(0, 200)
      : '';

    const phrases = Array.isArray(parsed.phrases)
      ? parsed.phrases.filter(s => typeof s === 'string' && s.length > 0 && s.length <= 40).slice(0, 6)
      : [];

    return res.status(200).json({ extractedText, phrases });
  } catch (error) {
    console.error('OCR-to-AAC error:', error.message);
    return res.status(500).json({ error: 'Internal server error', extractedText: '', phrases: [] });
  }
});

// ════════════════════════════════════════════
// 5. LOG RETENTION — scheduled cleanup
// ════════════════════════════════════════════
//
// Runs daily. Deletes log entries older than 30 days from
// /userLogs/{uid}. Each user's logs are pruned independently.
//
// Deploy: firebase deploy --only functions
// The schedule uses Cloud Scheduler (requires Blaze plan).

exports.pruneUserLogs = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('UTC')
  .onRun(async () => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    try {
      const db = admin.database();
      const usersSnap = await db.ref('userLogs').once('value');
      if (!usersSnap.exists()) return null;

      const promises = [];
      usersSnap.forEach((userSnap) => {
        userSnap.forEach((logSnap) => {
          const ts = logSnap.val()?.timestamp;
          if (typeof ts === 'number' && ts < cutoff) {
            promises.push(logSnap.ref.remove());
          }
        });
      });

      if (promises.length > 0) {
        await Promise.all(promises);
        console.log(`pruneUserLogs: removed ${promises.length} entries older than 30 days`);
      }
    } catch (error) {
      console.error('pruneUserLogs error:', error.message);
    }

    return null;
  });

// ════════════════════════════════════════════
// 6. LEGACY LOG CLEANUP — one-time migration
// ════════════════════════════════════════════
//
// Deletes entries at the old shared /userLogs root that were written
// before the per-uid migration. These entries have no $uid parent —
// they sit directly under /userLogs/{pushId}.
//
// Call once via: curl -X POST https://...cloudfunctions.net/cleanupLegacyLogs
// After running, this function can be removed.

exports.cleanupLegacyLogs = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const db = admin.database();
    const snap = await db.ref('userLogs').once('value');
    if (!snap.exists()) return res.status(200).json({ removed: 0 });

    let removed = 0;
    const promises = [];

    snap.forEach((child) => {
      const val = child.val();
      // Legacy entries are objects with an 'action' field directly (not a uid node).
      // Per-uid nodes contain nested push IDs, not action/timestamp directly.
      if (val && typeof val === 'object' && typeof val.action === 'string') {
        promises.push(child.ref.remove());
        removed++;
      }
    });

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    console.log(`cleanupLegacyLogs: removed ${removed} legacy entries`);
    return res.status(200).json({ removed });
  } catch (error) {
    console.error('cleanupLegacyLogs error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
