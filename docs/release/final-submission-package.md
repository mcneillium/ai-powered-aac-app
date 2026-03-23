# Voice — Final Play Console Submission Package

**Date:** 2026-03-23
**Version:** 1.1.0
**Brand:** Voice

---

## AAB File

| Item | Value |
|------|-------|
| Build command | `npx eas build --profile production --platform android` |
| Status | **TODO — run from your machine (requires EAS login)** |
| Previous CommAI build | `https://expo.dev/artifacts/eas/b3SUx6vPMMNBFteQjM1scg.aab` (old brand) |

After building, the artifact URL will be printed by EAS. Download the `.aab` for upload.

---

## App Icon

Already baked into the AAB via `app.json`. For the Play Console "High-res icon" upload:

| File | Size |
|------|------|
| `assets/branding/logo/icon-1024.png` | 1024x1024 |

---

## Feature Graphic

| File | Size |
|------|------|
| `assets/branding/google-play/feature-graphic/feature-graphic-1024x500.png` | 1024x500, RGB, no alpha |

Upload directly to Play Console → Store listing → Feature graphic.

---

## Screenshots

After capture + compositing (see `final-screenshot-capture-guide.md`):

| Order | File | Headline |
|-------|------|----------|
| 1 | `assets/branding/google-play/screenshots/final-1.png` | Tap. Build. Speak. |
| 2 | `assets/branding/google-play/screenshots/final-2.png` | Smart Suggestions |
| 3 | `assets/branding/google-play/screenshots/final-3.png` | Your Way, Your Voice |
| 4 | `assets/branding/google-play/screenshots/final-4.png` | Works Everywhere |

All 1080x1920 RGB PNG.

---

## Store Listing Text

### App Name
```
Voice
```

### Short Description (76 chars)
```
Calm, friendly AAC communication app with smart predictions. Works offline.
```

### Full Description
See `docs/release/play-store-listing-draft.md` — copy the full description section.

### Release Notes
```
What's New:
- Smart word suggestions on the main communication board
- New guided onboarding experience
- Sentence history — tap to repeat recent messages
- Offline indicator when disconnected
- Improved screen reader labels and accessibility
- AI personalisation controls in Settings
- Performance improvements
- Bug fixes and visual polish
```

---

## Privacy & Contact

| Field | Value |
|-------|-------|
| Privacy policy URL | `https://paulmartinmcneill.com/commai/privacy-policy` |
| Support email | `support@paulmartinmcneill.com` |
| Developer name | El Pablo Awakens |
| Website | `https://paulmartinmcneill.com` |

---

## Play Console Forms

### Content Rating (IARC)
- Expected rating: **Everyone**
- Contains no: violence, sexual content, profanity, gambling, drugs, user-generated content sharing

### Data Safety
Use responses from `docs/release/data-safety-draft.md`:
- Collects: email (optional), name (optional), in-app interactions (on-device only)
- Does NOT collect: location, financial info, health data, device IDs
- Does NOT share data with third parties
- Users can request account deletion
- Data encrypted in transit

### Target Audience & Category
- Category: **Education** (or Medical)
- Target: People who use AAC for communication, caregivers, educators
- Not primarily directed at children under 13 (but suitable for all ages with caregiver)

---

## Exact Remaining Human Actions

### Before upload (required)
```
1. npx eas build --profile production --platform android
   → Download the .aab from the URL EAS prints

2. Install .aab on device/emulator
   Capture 4 screenshots (see final-screenshot-capture-guide.md)
   Save as raw-1.png through raw-4.png in:
     assets/branding/google-play/screenshots/raw/

3. python3 scripts/composite-screenshots.py
   → Produces final-1.png through final-4.png
```

### Play Console upload
```
4. Upload .aab to Internal testing track
5. Upload feature-graphic-1024x500.png
6. Upload final-1.png through final-4.png as screenshots
7. Paste short description + full description + release notes
8. Set privacy policy URL + support email
9. Complete IARC content rating questionnaire
10. Complete data safety form
11. Set target audience + app category
12. Submit for review
```

### Infrastructure (can do before or after)
```
13. firebase login && cd functions && npm install && cd ..
    firebase deploy --only functions
14. firebase functions:config:set hf.token="hf_NEW_TOKEN"
    firebase deploy --only functions
15. Revoke old HF token at huggingface.co/settings/tokens
16. Revoke old Vision key at console.cloud.google.com/apis/credentials
```
