# Mobile Release Runbook — Voice v1.1.0

**Updated:** 2026-03-23

Complete these steps in order.

---

## Step 1 — Replace placeholder strings — DONE

Privacy policy URL and support email set. Brand updated to Voice.
```
brand.name: 'Voice'
privacyPolicyUrl: 'https://paulmartinmcneill.com/commai/privacy-policy'
supportEmail: 'support@paulmartinmcneill.com'
```

---

## Step 2 — Deploy Cloud Function

Prerequisites:
- Firebase CLI installed (`npm install -g firebase-tools`)
- Authenticated (`firebase login`)
- Project `commai-b98fe` accessible

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

Confirm deployed URL matches `src/services/hfImageCaption.js:17`:
```
https://us-central1-commai-b98fe.cloudfunctions.net/imageCaptionProxy
```

---

## Step 3 — Set Hugging Face token server-side

1. https://huggingface.co/settings/tokens → create new **read** token
2. Set it:
```bash
firebase functions:config:set hf.token="hf_YOUR_NEW_TOKEN"
firebase deploy --only functions
```

3. Smoke test:
```bash
curl -s -X POST \
  https://us-central1-commai-b98fe.cloudfunctions.net/imageCaptionProxy \
  -H "Content-Type: application/json" \
  -d '{"image":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}' | python3 -m json.tool
```

---

## Step 4 — Revoke compromised tokens

- Hugging Face: https://huggingface.co/settings/tokens → revoke `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`
- Google Cloud Vision: https://console.cloud.google.com/apis/credentials → delete `AIzaSyD4WZGLy8Zt5VsF6v2LmnikM4j7hcWoo9g`

---

## Step 5 — Run Voice-branded EAS production build

```bash
npx eas build --profile production --platform android
```

This produces a signed `.aab` with Voice branding (icon, name, splash, palette).

---

## Step 6 — Capture screenshots and generate Play Store images

See `docs/release/final-screenshot-capture-guide.md` for full details.

```bash
# After capturing 4 raw screenshots into the raw/ folder:
python3 scripts/composite-screenshots.py
```

---

## Step 7 — Smoke test on device

| Test | Expected |
|------|----------|
| App launches | No crash, shows "Voice" branding, onboarding or AAC board |
| Tap words → sentence bar | Words appear, TTS speaks on tap |
| Camera → take photo | Caption returned (or "Caption unavailable" if function not deployed) |
| Settings → Privacy Policy | Opens `https://paulmartinmcneill.com/commai/privacy-policy` |
| Settings → theme toggle | Light/dark/high-contrast works |
| Toggle airplane mode | Offline banner appears; core AAC still works |
| Sign in / sign out | Firebase auth flow completes |
| App icon in launcher | Shows Voice teal mic icon |

---

## Step 8 — Upload to Google Play Console

1. Go to https://play.google.com/console
2. Select app → **Internal testing** → **Create new release**
3. Upload the `.aab` from Step 5
4. Fill in:
   - **Store listing** — text from `docs/release/play-store-listing-draft.md`
   - **Screenshots** — `final-1.png` through `final-4.png` from Step 6
   - **Feature graphic** — `assets/branding/google-play/feature-graphic/feature-graphic-1024x500.png`
   - **Content rating** — IARC questionnaire (expected: Everyone)
   - **Data safety** — from `docs/release/data-safety-draft.md`
   - **Privacy policy URL** — `https://paulmartinmcneill.com/commai/privacy-policy`
   - **Contact email** — `support@paulmartinmcneill.com`
5. Submit for review
