# Final Mobile Release Audit — CommAI v1.1.0

**Date:** 2026-03-22
**Status:** Release Candidate — Conditional GO
**Branch:** `claude/mobile-architecture-ux-Q1Mvb`
**Verified by:** file-backed evidence; all assertions cite exact file paths and line numbers.

---

## 1. Secret Remediation

| Item | Evidence | Status |
|------|----------|--------|
| HF token removed from mobile app | `grep -rn "hf_[A-Za-z]" src/` → 0 results | **PASS** |
| Google Cloud Vision key removed | `grep -rn "AIzaSyD" src/` → 0 results | **PASS** |
| No Bearer tokens in mobile code | `grep -rn "Bearer" src/` → 0 results | **PASS** |
| Dead code files deleted | `src/utils/autoDescribe.js` — does not exist | **PASS** |
| Archive files deleted | `src/services/archive/` — does not exist | **PASS** |
| Old model files deleted | `src/services/Old_models/` — does not exist | **PASS** |
| Image captioning uses backend proxy | `src/services/hfImageCaption.js:17` → Cloud Function URL, no token | **PASS** |
| Cloud Function holds HF token server-side | `functions/index.js:49` → `functions.config().hf?.token` | **PASS** |
| Firebase API key (public by design) | `firebaseConfig.js:12` → standard client-side Firebase key | **PASS** (not a secret) |

**Key rotation required (external action):**
1. Revoke HF token `hf_NHyUO...` at huggingface.co/settings/tokens
2. Revoke Vision key `AIzaSyD4W...` in Google Cloud Console
3. Set new HF token: `firebase functions:config:set hf.token="hf_NEW"`

---

## 2. Release Signing

| Item | Evidence | Status |
|------|----------|--------|
| Release builds fail without production keystore | `build.gradle:123-128` — signingConfig null when neither `RELEASE_STORE_FILE` nor `ALLOW_DEBUG_SIGNING` set | **PASS** |
| No silent debug fallback | `build.gradle:128` — explicit comment: "Gradle will refuse" | **PASS** |
| Debug escape requires explicit opt-in | `build.gradle:125` — requires `-PALLOW_DEBUG_SIGNING=true` | **PASS** |
| EAS uses remote credentials | `eas.json:24` → `"credentialsSource": "remote"` | **PASS** |
| EAS produces AAB | `eas.json:23` → `"buildType": "app-bundle"` | **PASS** |
| Keystore files gitignored | `.gitignore` → `*.jks`, `*.keystore`, `keystore.properties` | **PASS** |
| Service account key gitignored | `.gitignore` → `google-play-service-account.json` | **PASS** |
| Version consistent | `package.json:4` = 1.1.0, `app.json:5` = 1.1.0, `build.gradle:96` = 1.1.0, `app.json:42` versionCode = 2, `build.gradle:95` versionCode = 2 | **PASS** |

---

## 3. Play Store Readiness

| Item | Evidence | Status |
|------|----------|--------|
| App name | `app.json:3` → "CommAI" | **PASS** |
| Package name | `app.json:41` → `com.elpabloawakens.aipoweredaacapp` | **PASS** |
| Permissions minimal | `app.json:37-40` → CAMERA, RECORD_AUDIO | **PASS** |
| Privacy link wired in Settings UI | `SettingsScreen.js:294` → `Linking.openURL(brand.privacyPolicyUrl)` | **PASS** |
| Privacy URL placeholder | `src/theme.js:15` → `REPLACE-ME` | **BLOCKER** |
| Support email placeholder | `src/theme.js:16` → `REPLACE-ME` | **BLOCKER** |
| High-res icon 512x512 | `assets/icon.png` is **180x180** | **BLOCKER** |
| Adaptive icon | `assets/adaptive-icon.png` is 1024x1024 | **PASS** |
| Feature graphic 1024x500 | Does not exist | **BLOCKER** |
| Phone screenshots (min 2) | None captured | **BLOCKER** |
| Listing text | `docs/release/play-store-listing-draft.md` — complete | **PASS** |
| Data safety draft | `docs/release/data-safety-draft.md` — complete | **PASS** |

---

## 4. AI Personalisation

| Item | Evidence | Status |
|------|----------|--------|
| Learns from selections, bigrams, phrases | `aiProfileStore.js` — 13 tests passing | **PASS** |
| User can disable personalisation | Settings toggle, gated on `aiEnabled` | **PASS** |
| User can reset learned data | Settings reset button | **PASS** |

---

## 5. Testing

| Suite | Tests | Status |
|-------|-------|--------|
| sanity.test.js | 1 | Pass |
| coreVocabulary.test.js | 7 | Pass |
| theme.test.js | 5 | Pass |
| speechService.test.js | 6 | Pass |
| aiProfileStore.test.js | 13 | Pass |
| improvedWordPrediction.test.js | 4 | Pass |
| **Total** | **36** | **All passing** |

---

## 6. Exact Remaining Blockers

| # | Blocker | Type | Action |
|---|---------|------|--------|
| B1 | Deploy Cloud Function + set HF token | Infra | `firebase deploy --only functions` + `firebase functions:config:set` |
| B2 | Revoke compromised HF + Vision tokens | Security | External: huggingface.co + Google Cloud Console |
| B3 | Resize `assets/icon.png` to 512x512 | Asset | Export from `adaptive-icon.png` source |
| B4 | Replace privacy policy URL placeholder | Config | Host page, update `src/theme.js:15` |
| B5 | Replace support email placeholder | Config | Update `src/theme.js:16` |
| B6 | Run EAS production build | Infra | `npm run eas:build:android:production` |
| B7 | Create feature graphic + phone screenshots | Asset | 1024x500 graphic + min 2 screenshots at 1080x1920 |

**Total: 7 blockers. All are external execution items. Zero code architecture changes needed.**

Full execution steps documented in `docs/release/mobile-release-runbook.md`.
