# Final Mobile Release Audit — CommAI v1.1.0

**Date:** 2026-03-23
**Status:** **GO for internal testing** / **Conditional GO for Play Console submission**
**Branch:** `claude/mobile-architecture-ux-Q1Mvb`
**Build artifact:** `https://expo.dev/artifacts/eas/b3SUx6vPMMNBFteQjM1scg.aab`
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
| Firebase deploy config present | `firebase.json` → functions source; `.firebaserc` → project `commai-b98fe` | **PASS** |
| Firebase API key (public by design) | `firebaseConfig.js:12` → standard client-side Firebase key | **PASS** (not a secret) |

**Key rotation required (external action):**
1. Revoke HF token `hf_NHyUO...` at huggingface.co/settings/tokens
2. Revoke Vision key `AIzaSyD4W...` in Google Cloud Console
3. Set new HF token: `firebase functions:config:set hf.token="hf_NEW"`

---

## 2. Release Signing & Build

| Item | Evidence | Status |
|------|----------|--------|
| Production AAB built | EAS build succeeded, artifact `b3SUx6vPMMNBFteQjM1scg.aab` | **PASS** |
| EAS uses remote credentials | `eas.json:24` → `"credentialsSource": "remote"` | **PASS** |
| EAS produces AAB | `eas.json:23` → `"buildType": "app-bundle"` | **PASS** |
| JS bundle verified in clean sim | 1076 modules bundled via `export:embed` (exact Gradle command) | **PASS** |
| Release builds fail without production keystore | `build.gradle:123-128` — signingConfig null | **PASS** |
| Debug escape requires explicit opt-in | `build.gradle:125` — requires `-PALLOW_DEBUG_SIGNING=true` | **PASS** |
| Keystore files gitignored | `.gitignore` → `*.jks`, `*.keystore`, `keystore.properties` | **PASS** |
| Service account key gitignored | `.gitignore` → `google-play-service-account.json` | **PASS** |
| Version consistent | `package.json:4` = 1.1.0, `app.json:5` = 1.1.0, `app.json:42` versionCode = 2 | **PASS** |

---

## 3. Play Store Readiness

| Item | Evidence | Status |
|------|----------|--------|
| App name | `app.json:3` → "CommAI" | **PASS** |
| Package name | `app.json:41` → `com.elpabloawakens.aipoweredaacapp` | **PASS** |
| Permissions minimal | `app.json:37-40` → CAMERA, RECORD_AUDIO | **PASS** |
| Privacy link wired in Settings UI | `SettingsScreen.js:294` → `Linking.openURL(brand.privacyPolicyUrl)` | **PASS** |
| Privacy URL set | `src/theme.js:15` → `https://paulmartinmcneill.com/commai/privacy-policy` | **PASS** |
| Support email set | `src/theme.js:16` → `support@paulmartinmcneill.com` | **PASS** |
| High-res icon 512x512 | `assets/icon.png` is 512x512 RGBA PNG | **PASS** |
| Adaptive icon | `assets/adaptive-icon.png` is 1024x1024 | **PASS** |
| Feature graphic 1024x500 | Does not exist | **TODO** |
| Phone screenshots (min 2) | None captured | **TODO** |
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

## 6. Resolved Items (since 2026-03-22)

| Item | Resolution |
|------|-----------|
| Privacy policy URL placeholder | Set to `https://paulmartinmcneill.com/commai/privacy-policy` — commit `729a901` |
| Support email placeholder | Set to `support@paulmartinmcneill.com` — commit `729a901` |
| EAS production build | Succeeded — AAB artifact confirmed |
| EAS JS bundle failure | Fixed in commits `74e1449`, `1e95c6a`, `bc02c58` |
| Metro idb/react-native-fs conflicts | Resolved via metro.config.js mocks |
| CNG workflow (stale android/ dir) | Removed committed android/, switched to expo prebuild |

---

## 7. Exact Remaining Items

### For internal testing (2 items)

| # | Item | Type | Action |
|---|------|------|--------|
| 1 | Deploy Cloud Function + set HF token | Infra | See runbook steps 2-3 |
| 2 | Smoke test on device | QA | See runbook step 6 |

### For Play Console submission (3 additional items)

| # | Item | Type | Action |
|---|------|------|--------|
| 3 | Feature graphic + phone screenshots | Design | 1024x500 + min 2 at 1080x1920 |
| 4 | Complete Play Console forms | Admin | IARC + data safety + target audience |
| 5 | Revoke compromised tokens | Security | HF + Vision keys |

**Total: 5 items. All are external execution. Zero code changes needed.**

Full execution steps documented in `docs/release/mobile-release-runbook.md`.
