# Mobile Secret Remediation

**Date:** 2026-03-22

## Problem Statement

The mobile app contained hardcoded third-party API secrets in client-side code. A mobile app bundle is extractable — any secret embedded in the JavaScript bundle, Expo config, or environment variable can be read by anyone with a copy of the APK/AAB. These secrets must live server-side.

## Secrets Found

| File | Secret type | Status before | Status after |
|------|------------|--------------|-------------|
| `src/services/hfImageCaption.js:12` | Hugging Face token `hf_NHyUO...` | **Hardcoded in active code** | **Removed** — refactored to backend proxy |
| `src/utils/autoDescribe.js:7` | Google Cloud Vision key `AIzaS...` | Hardcoded in dead code | **File deleted** |
| `src/services/archive/unused/aiSuggestions.js:12` | Hugging Face token (same) | Hardcoded in dead code | **File deleted** |
| `src/services/archive/unused/aiRearrange.js:8` | Hugging Face token (same) | Hardcoded in dead code | **File deleted** |
| `src/services/Old_models/vertexAIService.js:5` | Vertex AI endpoint URL | Endpoint URL in dead code (not a secret, but stale) | **File deleted** |
| `firebaseConfig.js:12` | Firebase Web API key | Hardcoded | **No action needed** — public by design per Google documentation |

## Actions Taken

### 1. Deleted all dead code with leaked secrets

Removed entirely:
- `src/utils/autoDescribe.js`
- `src/services/archive/unused/aiSuggestions.js`
- `src/services/archive/unused/aiRearrange.js`
- `src/services/archive/unused/betterModel.js`
- `src/services/Old_models/vertexAIService.js`

Plus the now-empty `archive/unused/` and `Old_models/` directories.

### 2. Refactored image captioning to backend proxy

**Before:** The mobile app held the Hugging Face token and called the HF API directly.

**After:**
- `src/services/hfImageCaption.js` calls a Firebase Cloud Function endpoint via HTTPS
- `functions/index.js` (Cloud Function) holds the HF token via Firebase Functions config (`firebase functions:config:set hf.token="..."`)
- The mobile app never sees the token

### 3. Created Firebase Cloud Function

`functions/index.js` implements `imageCaptionProxy`:
- Accepts POST `{ image: "<base64>" }`
- Reads HF token from Firebase Functions config
- Proxies to Hugging Face API
- Returns `{ caption: "..." }`
- Returns 500 if token is not configured
- Returns 502 if HF API fails

### 4. Added failure states

- `hfImageCaption.js` returns safe user-facing strings on timeout, network error, or backend error
- `CameraScreen.js` shows caption text rather than blocking Alert on failure
- 15-second timeout prevents indefinite hangs

## Key Rotation Required

The following tokens have been exposed in git history and **must be rotated**:

1. **Hugging Face token** `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`
   - Go to: https://huggingface.co/settings/tokens
   - Revoke the old token
   - Create a new token
   - Set it server-side: `firebase functions:config:set hf.token="hf_NEW_TOKEN"`

2. **Google Cloud Vision key** `AIzaSyD4WZGLy8Zt5VsF6v2LmnikM4j7hcWoo9g`
   - Go to: Google Cloud Console → APIs & Services → Credentials
   - Delete or restrict the key
   - No new key needed (feature removed from mobile app; re-add via Cloud Function if needed later)

## What About firebaseConfig.js?

The Firebase Web API key (`AIzaSyBZS_Bfl7Bj4axlFt8Pg3HebYzAbrqBDQs`) is **intentionally client-side**. This is the standard Firebase pattern. Security is enforced by:
- Firebase Security Rules (database/storage access control)
- Firebase App Check (optional, prevents abuse from non-app clients)
- Firebase Authentication (user identity)

The key itself is not a secret — it's an identifier. This is explicitly documented by Google: https://firebase.google.com/docs/projects/api-keys

## Verification

After remediation:

```bash
# Confirm no third-party API secrets remain in source
grep -rn "hf_" src/ --include="*.js" --include="*.ts"
grep -rn "AIzaSyD" src/ --include="*.js" --include="*.ts"
grep -rn "Bearer" src/ --include="*.js" --include="*.ts"
```

All three should return zero results.
