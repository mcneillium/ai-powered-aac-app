# Voice — Play Console Content Pack

**Version:** 1.1.0
**Package:** `com.elpabloawakens.aipoweredaacapp`
**Last updated:** 2026-03-23

Copy-paste from this document into Google Play Console. All text is final and upload-ready.

---

## 1. App Name

```
Voice
```

---

## 2. Short Description

80 characters max. Current: 76 characters.

```
Calm, friendly AAC communication app with smart predictions. Works offline.
```

---

## 3. Full Description

4000 characters max. Copy everything between the markers below.

```
Voice is an Augmentative and Alternative Communication (AAC) app designed for children, adults, and families who benefit from supported communication. Whether you're learning to communicate, supporting someone who is, or looking for a reliable AAC tool — Voice makes everyday communication calmer, clearer, and more personal.

Simple Communication
Tap colour-coded words to build sentences, then speak them aloud. The vocabulary grid uses Fitzgerald Key colours so word types are easy to spot: verbs in green, nouns in orange, pronouns in yellow, adjectives in blue, and social phrases in pink. Buttons stay in the same place so motor plans are never disrupted.

Smart, Private Suggestions
Voice learns from communication patterns — completely on your device. The more you use it, the better your word suggestions become. No personal data leaves your device unless you choose to sync. You can turn learning off or reset it at any time in Settings.

Works Offline
Every core feature works without the internet. Vocabulary, speech output, sentence history, and word predictions are all available offline. Communicate anywhere, any time.

Multiple Ways to Communicate
• Core vocabulary board with colour-coded word categories
• Visual sentence builder with pictogram search
• Emotion expression screen — tap how you feel and speak it
• Camera mode for describing objects and scenes
• Sentence history — quickly repeat recent messages

Fully Accessible
Designed with accessibility at its heart: screen reader support, large touch targets, high-contrast mode, adjustable grid sizes, customisable speech rate, pitch, and voice. Buttons never move unexpectedly.

Personalise Everything
• Light, dark, and high-contrast themes
• 2, 3, or 4-column grid layouts
• Adjustable speech speed and pitch
• Choose from available system voices
• Optional AI suggestions that learn from your usage

Safe and Calm
Voice is built to be a trustworthy, everyday tool. There are no ads, no tracking, and no surprises. Communication data stays on your device. Cloud sync is optional and only available when signed in.
```

---

## 4. Release Notes

500 characters max. For the "What's new" field.

```
• Smart word suggestions on the main communication board
• New guided onboarding experience
• Sentence history — tap to repeat recent messages
• Offline indicator when disconnected
• Improved screen reader labels and accessibility
• AI personalisation controls in Settings
• Performance improvements and bug fixes
```

---

## 5. Content Rating

IARC questionnaire — expected answers:

| Question area | Answer |
|---------------|--------|
| Violence | None |
| Sexual content | None |
| Profanity | None |
| Drugs/alcohol/tobacco | None |
| Gambling | None |
| User-generated content shared with others | No |
| Users can interact/communicate with each other | No |
| Location sharing | No |
| Digital purchases | No |

**Expected rating:** Everyone

---

## 6. Category & Tags

| Field | Value |
|-------|-------|
| Category | **Education** (or Medical) |
| Tags | AAC, communication, speech, accessibility, augmentative communication, assistive technology, text to speech |

---

## 7. Contact Information

| Field | Value |
|-------|-------|
| Developer name | El Pablo Awakens |
| Email | `support@paulmartinmcneill.com` |
| Website | `https://paulmartinmcneill.com` |
| Privacy policy URL | `https://paulmartinmcneill.com/commai/privacy-policy` |

---

## 8. Feature Graphic

| File | Size | Format |
|------|------|--------|
| `assets/branding/google-play/feature-graphic/feature-graphic-1024x500.png` | 1024x500 | RGB PNG, no alpha |

Upload to: Store listing → Feature graphic

---

## 9. Screenshots

After capturing and compositing (see below), upload in this order:

| Order | File | Caption |
|-------|------|---------|
| 1 | `assets/branding/google-play/screenshots/final-1.png` | Tap. Build. Speak. |
| 2 | `assets/branding/google-play/screenshots/final-2.png` | Smart Suggestions |
| 3 | `assets/branding/google-play/screenshots/final-3.png` | Your Way, Your Voice |
| 4 | `assets/branding/google-play/screenshots/final-4.png` | Works Everywhere |

All 1080x1920 RGB PNG.

**To generate these:**
1. Capture 4 raw screenshots from the app (details in `docs/release/final-screenshot-capture-guide.md`)
2. Save as `raw-1.png` through `raw-4.png` in `assets/branding/google-play/screenshots/raw/`
3. Run: `python scripts/composite-screenshots.py`

---

## 10. Data Safety — Verification Checklist

Use `docs/release/data-safety-draft.md` for detailed responses. Before submitting, verify these:

### Data collected

| Category | Collected? | Verify |
|----------|-----------|--------|
| Email address | Optional — only if user creates account | Firebase Auth |
| Name | Optional — during signup | Firebase Auth |
| App interactions (word usage) | Yes — on-device only via AsyncStorage | Never transmitted unless cloud sync enabled |
| Photos/videos | Processed on-device, not stored or uploaded | Camera for object recognition only |

### Data NOT collected — confirm these remain true

- [ ] No location data
- [ ] No financial/payment data
- [ ] No health data
- [ ] No device identifiers (AAID, IMEI)
- [ ] No browsing/search history sent to servers
- [ ] No audio recordings stored or transmitted
- [ ] No crash reporting SDK (no Crashlytics, Sentry, etc.)

### Data sharing

- [ ] No data shared with third parties — confirm no new SDKs were added

### Encryption

- [ ] Data encrypted in transit (Firebase uses HTTPS) — confirm

### Data deletion

- [ ] Users can reset AI data in Settings (Settings → Reset AI Data)
- [ ] Uninstalling removes all local data
- [ ] **Account deletion: see section 11 below**

---

## 11. Account Deletion & App Access

### Account deletion disclosure

**Current state:** The app allows optional account creation via Firebase Auth, but **there is no in-app account deletion button**. Google Play requires apps that offer account creation to also offer account deletion.

**Options to resolve before or shortly after submission:**

1. **Add an in-app delete button** — call `firebase.auth().currentUser.delete()` from Settings or Profile screen
2. **Provide a web-based deletion path** — add a deletion request form/page at the privacy policy URL and reference it in Play Console
3. **Email-based deletion** — state in Play Console that users can request deletion via `support@paulmartinmcneill.com`

For internal testing track, option 3 is sufficient. For production release, option 1 or 2 is recommended.

**Action needed:** Choose one option and implement or document it before production submission.

### App access for reviewers

The app works fully **without an account** (guest mode). No reviewer login credentials needed. If Play Console asks for test account details, note:

```
This app does not require login. All features are available in guest mode.
Optional account creation is available for cloud sync only.
```

---

## 12. Target Audience

| Question | Answer |
|----------|--------|
| Is this app primarily directed at children? | No — it is for all ages, used with caregiver supervision |
| Target age group | All ages |
| Does the app contain ads? | No |
| Does the app allow purchases? | No |

If the app is listed under Education or Medical, Play Console may ask additional audience questions. Answer based on: this is an assistive communication tool suitable for all ages, typically used by or with caregivers.

---

## 13. Upload Checklist

### AAB

- [ ] Run `npx eas build --profile production --platform android` from your machine
- [ ] Download the `.aab` from the EAS artifact URL
- [ ] Upload to Play Console → Internal testing → Create new release

### Store listing

- [ ] Paste app name: `Voice`
- [ ] Paste short description (section 2 above)
- [ ] Paste full description (section 3 above)
- [ ] Upload feature graphic from `assets/branding/google-play/feature-graphic/`
- [ ] Upload 4 screenshots from `assets/branding/google-play/screenshots/final-*.png`

### Settings & forms

- [ ] Set privacy policy URL: `https://paulmartinmcneill.com/commai/privacy-policy`
- [ ] Set support email: `support@paulmartinmcneill.com`
- [ ] Complete IARC content rating (section 5 above)
- [ ] Complete data safety form (section 10 above + `data-safety-draft.md`)
- [ ] Set app category and tags (section 6 above)
- [ ] Set target audience (section 12 above)
- [ ] Address account deletion disclosure (section 11 above)

### Submit

- [ ] Review all fields in Play Console
- [ ] Submit for internal testing review

---

## 14. Remaining Human-Only Actions — Summary

```
1. Build:     npx eas build --profile production --platform android
2. Capture:   4 screenshots → raw/ folder → python scripts/composite-screenshots.py
3. Upload:    AAB + feature graphic + 4 screenshots to Play Console
4. Forms:     IARC + data safety + target audience + account deletion disclosure
5. Copy:      Paste short/full description + release notes + contact info
6. Infra:     firebase deploy --only functions + set HF token (for image captioning)
7. Security:  Revoke old HF + Vision tokens
```

Steps 1-5 are required for submission. Steps 6-7 are required for full functionality.
