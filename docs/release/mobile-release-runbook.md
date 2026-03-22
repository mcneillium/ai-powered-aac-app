# Mobile Release Runbook — CommAI v1.1.0

Complete these steps in order. Each step depends on the one before it.

---

## Step 1 — Deploy Cloud Function

The Cloud Function proxy in `functions/index.js` holds the Hugging Face token server-side. Until deployed, camera captioning in the app will show a graceful fallback ("Caption unavailable").

```bash
cd functions
npm install
firebase deploy --only functions
```

**Verify:** The CLI prints the deployed URL. It should match the endpoint in `src/services/hfImageCaption.js:17`:
```
https://us-central1-commai-b98fe.cloudfunctions.net/imageCaptionProxy
```

If the project ID or region differs, update line 17 of `hfImageCaption.js` to match, commit, and rebuild.

---

## Step 2 — Set new Hugging Face token server-side

1. Go to https://huggingface.co/settings/tokens
2. Create a new **read** token (do NOT reuse the old one)
3. Set it in Firebase Functions config:

```bash
firebase functions:config:set hf.token="hf_YOUR_NEW_TOKEN"
firebase deploy --only functions
```

4. Test the endpoint:

```bash
# Minimal smoke test — should return a JSON object, not an error
curl -X POST \
  https://us-central1-commai-b98fe.cloudfunctions.net/imageCaptionProxy \
  -H "Content-Type: application/json" \
  -d '{"image":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualEQAAAABJRU5ErkJggg=="}'
```

Expected: `{"caption":"...some text..."}` or `{"error":"..."}` if the model is cold-starting (retry in 30s).

---

## Step 3 — Revoke compromised tokens

Both of these were previously hardcoded in source and must be treated as compromised.

### Hugging Face token
1. Go to https://huggingface.co/settings/tokens
2. Find token starting with `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`
3. Click **Revoke**

### Google Cloud Vision key
1. Go to https://console.cloud.google.com/apis/credentials
2. Select project `ai-powered-aac-app`
3. Find key starting with `AIzaSyD4WZGLy8Zt5VsF6v2LmnikM4j7hcWoo9g`
4. Click **Delete** (this key is no longer used by the app)

---

## Step 4 — Set app icon to 512x512

The current `assets/icon.png` is **180x180**. Google Play requires **512x512**.

Option A: Export a 512x512 PNG from the source artwork and overwrite `assets/icon.png`.
Option B: Resize `assets/adaptive-icon.png` (currently 1024x1024) to 512x512 and save as `assets/icon.png`.

```bash
# Verify after replacing:
file assets/icon.png
# Must show: PNG image data, 512 x 512
```

---

## Step 5 — Replace placeholder strings

Edit `src/theme.js` (lines 15–16 of the `brand` object):

```javascript
privacyPolicyUrl: 'https://YOUR-ACTUAL-DOMAIN.com/privacy-policy',
supportEmail: 'your-actual-email@example.com',
```

Both values are marked with `← REPLACE before release` comments. The privacy policy URL must point to a live, publicly accessible page before Play Store submission.

```bash
# Verify no placeholders remain:
grep "REPLACE-ME" src/theme.js
# Must return: no output
```

---

## Step 6 — Commit placeholder + icon changes

```bash
git add src/theme.js assets/icon.png
git commit -m "Set privacy policy URL, support email, and 512x512 icon for release"
```

---

## Step 7 — Run EAS production build

```bash
npm run eas:build:android:production
```

This runs `eas build --profile production --platform android` which:
- Uses `eas.json` → `build.production.android`:
  - `buildType: "app-bundle"` → produces AAB (not APK)
  - `credentialsSource: "remote"` → EAS manages the upload keystore
  - `autoIncrement: true` → bumps versionCode automatically
- On first run, EAS prompts to generate a new upload keystore (stored in EAS servers)
- Build runs on EAS cloud infrastructure

**Output:** An `.aab` file URL printed to the terminal. Download it.

---

## Step 8 — Validate the AAB

```bash
# 1. Download the AAB from the URL printed by EAS
# 2. Check it with bundletool:
java -jar bundletool.jar validate --bundle=commai.aab

# 3. Check signing:
jarsigner -verify -verbose commai.aab | head -20
# Must NOT say "debug" or "androiddebugkey"

# 4. Install on a test device via bundletool:
java -jar bundletool.jar build-apks --bundle=commai.aab --output=commai.apks
java -jar bundletool.jar install-apks --apks=commai.apks
```

Quick smoke test on device:
- App launches without crash
- AAC board loads, words are tappable, speech works
- Camera captioning returns a result (if Cloud Function is deployed) or shows "Caption unavailable" (graceful)
- Settings → Privacy Policy opens a browser to the correct URL
- Offline mode works (toggle airplane mode)

---

## Step 9 — Upload to Google Play Console

1. Go to https://play.google.com/console
2. Select app → **Production** → **Create new release**
3. Upload the `.aab` file
4. Paste release notes from `docs/release/play-store-listing-draft.md` → "Release Notes (v1.1.0)"
5. Complete:
   - **Store listing** — title, descriptions, screenshots, feature graphic
   - **Content rating** — IARC questionnaire (expected: Everyone)
   - **Data safety** — use responses from `docs/release/data-safety-draft.md`
   - **Privacy policy URL** — paste the same URL from `brand.privacyPolicyUrl`
6. **Review and roll out**

---

## Step 10 — Post-submission verification

- [ ] Cloud Function responding (step 2 curl test)
- [ ] Old tokens revoked (step 3)
- [ ] AAB is production-signed, not debug-signed (step 8)
- [ ] Privacy policy URL loads in a browser
- [ ] Play Store listing preview looks correct
- [ ] `grep "REPLACE-ME" src/` returns nothing
- [ ] `grep "hf_[A-Za-z]" src/` returns nothing
