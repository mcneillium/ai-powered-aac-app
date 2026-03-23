# Final Mobile Release Audit — Voice v1.1.0

**Date:** 2026-03-23
**Status:** **CONDITIONAL GO** — needs Voice-branded EAS build + screenshots
**Branch:** `claude/mobile-architecture-ux-Q1Mvb`
**Verified by:** file-backed evidence; all assertions cite exact file paths.

---

## 1. Brand Identity

| Item | Evidence | Status |
|------|----------|--------|
| App name "Voice" | `app.json:3`, `src/theme.js:7` | **PASS** |
| Brand palette (teal #5BB5B5) | `src/theme.js:9`, `app.json:35` | **PASS** |
| Zero "CommAI" refs in src/ | `grep -rn "CommAI" src/` → 0 results | **PASS** |
| Voice app icon | `assets/icon.png` — 512x512, mic + wordmark | **PASS** |
| Adaptive icon (fg + bg) | `assets/adaptive-icon.png` + `adaptive-icon-background.png` | **PASS** |
| Feature graphic | `assets/branding/google-play/feature-graphic/feature-graphic-1024x500.png` | **PASS** |
| Screenshot templates | 4 templates at 1080x1920 in `assets/branding/google-play/screenshots/` | **PASS** |
| Compositing script | `scripts/composite-screenshots.py` | **PASS** |

---

## 2. Secret Remediation

| Item | Evidence | Status |
|------|----------|--------|
| HF token removed from mobile app | `grep -rn "hf_[A-Za-z]" src/` → 0 results | **PASS** |
| Google Cloud Vision key removed | `grep -rn "AIzaSyD" src/` → 0 results | **PASS** |
| No Bearer tokens in mobile code | `grep -rn "Bearer" src/` → 0 results | **PASS** |
| Image captioning uses backend proxy | `src/services/hfImageCaption.js:17` → Cloud Function URL | **PASS** |
| Cloud Function holds HF token server-side | `functions/index.js` → `functions.config().hf?.token` | **PASS** |
| Firebase API key (public by design) | `firebaseConfig.js` → standard client-side key | **PASS** |

**Key rotation required:**
1. Revoke HF token `hf_NHyUO...` at huggingface.co
2. Revoke Vision key `AIzaSyD4W...` in Google Cloud Console
3. Set new HF token via `firebase functions:config:set`

---

## 3. Release Signing & Build

| Item | Evidence | Status |
|------|----------|--------|
| EAS uses remote credentials | `eas.json:28` → `"credentialsSource": "remote"` | **PASS** |
| EAS produces AAB | `eas.json:27` → `"buildType": "app-bundle"` | **PASS** |
| Release builds fail without keystore | CNG workflow, no committed android/ | **PASS** |
| Keystore files gitignored | `.gitignore` → `*.jks`, `*.keystore` | **PASS** |
| Service account key gitignored | `.gitignore` → `google-play-service-account.json` | **PASS** |
| Version consistent | `package.json` = 1.1.0, `app.json` = 1.1.0, versionCode = 2 | **PASS** |
| Voice-branded AAB | **TODO** — EAS build needed with current code | **PENDING** |

---

## 4. Play Store Readiness

| Item | Evidence | Status |
|------|----------|--------|
| App name "Voice" | `app.json:3` | **PASS** |
| Package name | `app.json:41` → `com.elpabloawakens.aipoweredaacapp` | **PASS** |
| Permissions minimal | `app.json:37-40` → CAMERA, RECORD_AUDIO | **PASS** |
| Privacy link in Settings UI | `SettingsScreen.js` → `Linking.openURL(brand.privacyPolicyUrl)` | **PASS** |
| Privacy URL set | `src/theme.js:11` | **PASS** |
| Support email set | `src/theme.js:12` | **PASS** |
| Feature graphic | 1024x500 RGB PNG | **PASS** |
| Phone screenshots | Templates ready, compositing script ready | **PENDING** (capture needed) |
| Listing text (Voice brand) | `docs/release/play-store-listing-draft.md` | **PASS** |
| Data safety draft | `docs/release/data-safety-draft.md` | **PASS** |

---

## 5. Testing

| Suite | Tests | Status |
|-------|-------|--------|
| sanity.test.js | 1 | Pass |
| coreVocabulary.test.js | 7 | Pass |
| theme.test.js | 5 | Pass (updated for Voice palette) |
| speechService.test.js | 6 | Pass |
| aiProfileStore.test.js | 13 | Pass |
| improvedWordPrediction.test.js | 4 | Pass |
| **Total** | **36** | **All passing** |

---

## 6. Remaining Items

| # | Item | Type |
|---|------|------|
| 1 | Run Voice-branded EAS build | Build |
| 2 | Capture 4 screenshots + run compositing | Design |
| 3 | Complete Play Console forms (IARC, data safety, audience) | Admin |
| 4 | Deploy Cloud Function + set HF token | Infra |
| 5 | Revoke compromised tokens | Security |

**All are human-only execution. Zero code changes remain.**
