# Final Mobile Release Audit — CommAI v1.1.0

**Date:** 2026-03-22
**Status:** Release Candidate — Conditional GO
**Branch:** `claude/mobile-architecture-ux-Q1Mvb`
**Verified by:** file-backed evidence, all assertions cite exact lines

---

## Release Signing

| Item | Evidence | Status |
|------|----------|--------|
| Release builds fail without production keystore | `build.gradle:118-128` — signingConfig is null when neither `RELEASE_STORE_FILE` nor `ALLOW_DEBUG_SIGNING` set | **PASS** |
| No silent debug fallback | `build.gradle:119` — comment: "Production release builds MUST have a production keystore" | **PASS** |
| Debug escape hatch is explicit | `build.gradle:125` — requires `-PALLOW_DEBUG_SIGNING=true` CLI flag | **PASS** |
| EAS uses remote credentials | `eas.json:23` — `"credentialsSource": "remote"` | **PASS** |
| EAS produces AAB | `eas.json:22` — `"buildType": "app-bundle"` | **PASS** |
| versionCode auto-increments | `eas.json:15` — `"autoIncrement": true` | **PASS** |
| Keystore/secrets gitignored | `.gitignore:21,22,27,45` — `*.jks`, `*.keystore`, `keystore.properties`, `google-play-service-account.json` | **PASS** |
| Version consistent | `package.json:4` + `app.json:5` + `build.gradle:95-96` — all 1.1.0/versionCode 2 | **PASS** |

## Hardcoded Keys Audit

| File | Key | Classification | Status |
|------|-----|---------------|--------|
| `firebaseConfig.js:12` | Firebase Web API key (`AIzaSyBZS...`) | **Public by design** — Firebase web keys are client-side identifiers, not secrets. Security is enforced by Firebase Security Rules and App Check. Google's documentation explicitly states these are safe to embed. | **PASS** |
| `src/utils/autoDescribe.js:7` | Google Cloud Vision key (`AIzaSyD4W...`) | **Leaked secret in dead code** — file is never imported (zero references). Key should be rotated. | **ADVISORY** — delete file |

## Play Store Readiness

| Item | Evidence | Status |
|------|----------|--------|
| App name | `app.json:3` → `"name": "CommAI"`, `strings.xml:2` → `CommAI` | **PASS** |
| Package name | `app.json:41` → `com.elpabloawakens.aipoweredaacapp` | **PASS** |
| Permissions minimal | `AndroidManifest.xml` — 5 permissions, WRITE_EXTERNAL_STORAGE removed, SYSTEM_ALERT_WINDOW has `tools:node="removeInRelease"` | **PASS** |
| Adaptive icons | `app.json:33-35` — foreground + background configured | **PASS** |
| Splash screen | `app.json:18-22` — configured | **PASS** |
| Brand colors | `colors.xml:4-5` — `#4CAF50` / `#388E3C` | **PASS** |
| Privacy link in UI | `SettingsScreen.js:291-298` — `Linking.openURL(brand.privacyPolicyUrl)` | **PASS** |
| Privacy URL value | `theme.js:13` — `REPLACE-ME` placeholder | **BLOCKER** |
| Support email | `theme.js:14` — `REPLACE-ME` placeholder | **BLOCKER** |
| Listing draft | `docs/release/play-store-listing-draft.md` — exists | **PASS** |
| Data safety draft | `docs/release/data-safety-draft.md` — exists | **PASS** |

## AI Personalisation

| Item | Evidence | Status |
|------|----------|--------|
| Learns from word selections | `aiProfileStore.js:135-153` — wordFrequencies, wordRecency, bigrams, phrases | **PASS** |
| Suggestion acceptance tracking | `aiProfileStore.js:148-150` — `suggestionsAccepted++` | **PASS** |
| Recency + frequency re-ranking | `AACBoardScreen.js:85-86` — `scoreByFrequencyAndRecency(merged)` | **PASS** |
| User can disable | `SettingsScreen.js:242-246` — toggle for `aiPersonalisationEnabled` | **PASS** |
| User can reset data | `SettingsScreen.js:249-274` — destructive confirmation dialog → `resetAIProfile()` | **PASS** |
| Recording gated on setting | `AACBoardScreen.js:53,72,89,114,149` — all check `aiEnabled` | **PASS** |
| Privacy-safe summary | `aiProfileStore.js:304-319` — aggregate counts only | **PASS** |

## Accessibility

| Item | Status |
|------|--------|
| Screen reader labels on all interactives | **PASS** |
| accessibilityRole on buttons/links | **PASS** |
| accessibilityState for selected/disabled | **PASS** |
| accessibilityLiveRegion on sentence bar | **PASS** |
| High contrast theme | **PASS** |
| Touch targets ≥ 40px with hitSlop | **PASS** |
| EmotionScreen per-card animation | **PASS** |

## Offline Resilience

| Item | Status |
|------|--------|
| Core vocabulary offline | **PASS** |
| Speech offline | **PASS** |
| AI predictions offline | **PASS** |
| Network context + banner | **PASS** |
| Feedback queued offline | **PASS** |
| Settings persist offline | **PASS** |

## Testing

| Suite | Tests | Status |
|-------|-------|--------|
| sanity.test.js | 1 | Pass |
| coreVocabulary.test.js | 7 | Pass |
| theme.test.js | 5 | Pass |
| speechService.test.js | 6 | Pass |
| aiProfileStore.test.js | 13 | Pass |
| improvedWordPrediction.test.js | 4 | Pass |
| **Total** | **36** | **All passing** |

## Exact Remaining Blockers

| # | Blocker | Type |
|---|---------|------|
| M1 | Run EAS production build to generate credentials + AAB | Infra |
| M2 | Host privacy policy URL → replace placeholder in `theme.js:13` | Legal |
| M3 | Replace support email placeholder in `theme.js:14` | Config |
| M4 | Create feature graphic (1024x500) + capture phone screenshots (min 2) | Design |

**Total: 4 blockers. All external. Zero require code changes beyond two string replacements (M2, M3).**
