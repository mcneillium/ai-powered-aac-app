# Mobile Release Runbook — CommAI v1.1.0

Complete these steps in order.

---

## Step 1 — Replace placeholder strings

Edit `src/theme.js` lines 15–16:

```javascript
privacyPolicyUrl: 'https://YOUR-ACTUAL-URL/privacy-policy',
supportEmail: 'your-real-email@example.com',
```

```bash
# Verify:
grep "REPLACE-ME" src/theme.js   # must return nothing
```

Commit:
```bash
git add src/theme.js
git commit -m "Set privacy policy URL and support email for release"
```

---

## Step 2 — Deploy Cloud Function

Prerequisites:
- Firebase CLI installed (`npm install -g firebase-tools`)
- Authenticated (`firebase login`)
- Project `commai-b98fe` accessible to your account

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

The CLI will print the deployed URL. Confirm it matches `src/services/hfImageCaption.js:17`:
```
https://us-central1-commai-b98fe.cloudfunctions.net/imageCaptionProxy
```

If the region or project differs, update `hfImageCaption.js:17`, commit, and rebuild.

---

## Step 3 — Set Hugging Face token server-side

1. Go to https://huggingface.co/settings/tokens
2. Create a new **read** token (do NOT reuse the compromised one)
3. Set it:

```bash
firebase functions:config:set hf.token="hf_YOUR_NEW_TOKEN"
firebase deploy --only functions
```

4. Smoke test:

```bash
curl -s -X POST \
  https://us-central1-commai-b98fe.cloudfunctions.net/imageCaptionProxy \
  -H "Content-Type: application/json" \
  -d '{"image":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}' | python3 -m json.tool
```

Expected: `{"caption": "..."}` or `{"error": "..."}` on model cold-start (retry in 30s).

---

## Step 4 — Revoke compromised tokens

### Hugging Face
1. https://huggingface.co/settings/tokens
2. Revoke token `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`

### Google Cloud Vision
1. https://console.cloud.google.com/apis/credentials (project `ai-powered-aac-app`)
2. Delete key `AIzaSyD4WZGLy8Zt5VsF6v2LmnikM4j7hcWoo9g`

---

## Step 5 — Run EAS production build

```bash
npm run eas:build:android:production
```

What this does (from `eas.json` production profile):
- `buildType: "app-bundle"` → AAB output
- `credentialsSource: "remote"` → EAS manages upload keystore
- `autoIncrement: true` → bumps versionCode

On first run, EAS will prompt to generate an upload keystore. The build runs on EAS cloud. Output: a download URL for the `.aab`.

---

## Step 6 — Validate the AAB

```bash
# Download AAB from the URL printed by EAS, then:
jarsigner -verify -verbose commai.aab 2>&1 | head -5
# Must NOT contain "androiddebugkey" or "debug"
```

---

## Step 7 — Smoke test on device

Install via bundletool or internal distribution, then verify:

| Test | Expected |
|------|----------|
| App launches | No crash, AAC board visible |
| Tap words → sentence bar | Words appear, TTS speaks on tap |
| Camera → take photo | Caption returned from Cloud Function (or "Caption unavailable" if offline) |
| Settings → Privacy Policy | Opens browser to correct URL |
| Settings → theme toggle | Light/dark/high-contrast switch works |
| Toggle airplane mode | Offline banner appears; core AAC still works |
| Sign in / sign up | Firebase auth flow completes |
| Sign out | Returns to login screen |

---

## Step 8 — Create Play Store assets

- **Feature graphic:** 1024 x 500 px, JPEG or 24-bit PNG, no alpha
- **Phone screenshots:** min 2, recommended 1080x1920

Capture method:
```bash
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png
```

---

## Step 9 — Upload to Google Play Console

1. Go to https://play.google.com/console
2. Select app → **Production** → **Create new release**
3. Upload the `.aab`
4. Fill in:
   - **Store listing** — text from `docs/release/play-store-listing-draft.md`
   - **Screenshots + feature graphic** from step 8
   - **Content rating** — IARC questionnaire (expected: Everyone)
   - **Data safety** — from `docs/release/data-safety-draft.md`
   - **Privacy policy URL** — same as `brand.privacyPolicyUrl` in `src/theme.js`
5. Submit for review

---

## Step 10 — Post-submission checklist

- [ ] Cloud Function returns captions (step 3 curl test)
- [ ] Old HF token revoked
- [ ] Old Vision key deleted
- [ ] AAB is production-signed (step 6)
- [ ] Privacy policy URL loads in browser
- [ ] `grep "REPLACE-ME" src/` returns nothing
- [ ] `grep "hf_[A-Za-z]" src/` returns nothing
