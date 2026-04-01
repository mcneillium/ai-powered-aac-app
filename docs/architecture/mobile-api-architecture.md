# Mobile API Architecture

## Principle

**No billable third-party API secrets in the mobile app.**

A mobile app bundle is extractable. Any key or token embedded in JavaScript, Expo config, or environment variables can be read by decompiling the APK/AAB. Therefore:

- Firebase Web API keys → **OK client-side** (public identifiers, secured by rules)
- Hugging Face tokens → **Server-side only** (billable, abuse risk)
- Google Cloud Vision keys → **Server-side only** (billable, abuse risk)
- Any future OpenAI/Anthropic/etc. keys → **Server-side only**

## Architecture

```
┌─────────────────┐       HTTPS        ┌──────────────────────┐       Authed       ┌──────────────┐
│   Mobile App    │ ──────────────────→ │  Firebase Cloud Fn   │ ────────────────→  │  Hugging Face│
│  (no secrets)   │  POST {image:b64}   │  (holds HF token)    │  Bearer hf_...     │  API         │
│                 │ ←────────────────── │                      │ ←──────────────── │              │
│                 │  {caption:"..."}    │                      │  [{generated_text}] │              │
└─────────────────┘                    └──────────────────────┘                    └──────────────┘
```

## Components

### Mobile App (`src/services/hfImageCaption.js`)

- Reads image from device as base64
- POSTs to Cloud Function endpoint
- Receives `{ caption: "..." }` response
- Shows safe fallback strings on timeout / error / offline
- **Contains no API tokens**

### Cloud Function (`functions/index.js`)

- `imageCaptionProxy` — HTTPS endpoint
- Reads HF token from Firebase Functions config (`functions.config().hf.token`)
- Proxies request to Hugging Face inference API
- Returns caption or structured error
- CORS enabled for mobile fetch

### Configuration

The HF token is set via Firebase CLI (never in code):

```bash
# Set the token (one time, stored encrypted by Firebase)
firebase functions:config:set hf.token="hf_YOUR_TOKEN"

# Deploy the function
cd functions && npm install && firebase deploy --only functions

# Verify the config
firebase functions:config:get
```

## Failure Modes

| Scenario | Mobile behaviour |
|----------|-----------------|
| Backend unreachable (offline) | Shows "Caption unavailable — check your connection" |
| Backend timeout (>15s) | Shows "Caption timed out — try again later" |
| Backend returns 5xx | Shows "Caption unavailable — try again later" |
| HF token not configured | Cloud Function returns 500; mobile shows fallback |
| HF model loading (cold start) | HF may return 503; Cloud Function returns 502; mobile shows fallback |

In all cases, the camera screen remains usable — the image is shown, and the caption area displays a helpful message instead of crashing.

## Adding New Third-Party APIs

To add any new billable API (e.g., Google Cloud Vision, OpenAI):

1. Add a new export in `functions/index.js`
2. Store the API key via `firebase functions:config:set`
3. Create a matching client function in `src/services/`
4. The client function calls the Cloud Function endpoint — never the third-party API directly
5. Add failure states that return safe strings

## What Stays Client-Side

| Item | Reason |
|------|--------|
| Firebase Web API key | Public identifier, not a secret |
| Firebase project config (authDomain, projectId, etc.) | Public metadata |
| TensorFlow.js model weights | Bundled asset, not a secret |
| ARASAAC pictogram URLs | Public API, no auth required |
| Cloud Function endpoint URL | Public HTTPS endpoint |
