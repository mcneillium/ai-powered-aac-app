# Final Mobile Go / No-Go — CommAI v1.1.0

**Date:** 2026-03-22
**Decision:** **CONDITIONAL GO** — code is release-ready; 6 execution items remain.

---

## GO criteria (all met)

| Criterion | Evidence | Status |
|-----------|----------|--------|
| Core AAC communication works offline | All core screens functional, no network dependency | GO |
| AI suggestions working and personalised | `aiProfileStore.js`, 13 tests passing | GO |
| User can disable/reset AI personalisation | `SettingsScreen.js` toggle + reset button | GO |
| Accessibility: screen reader, contrast, touch targets | High-contrast palette, `accessibilityLabel` throughout | GO |
| No third-party API secrets in mobile app | `grep -rn "hf_\|AIzaSyD\|Bearer" src/` → 0 results | GO |
| Backend proxy for billable APIs | `functions/index.js` — HF token server-side only | GO |
| Safe failure states for backend | `hfImageCaption.js:50,58,61` — fallback strings | GO |
| Release builds hard-fail without production signing | `build.gradle:123-128` — null signingConfig path | GO |
| EAS production config: AAB + remote credentials | `eas.json:22-24` | GO |
| Permissions minimal and justified | `app.json:37-40` — CAMERA, RECORD_AUDIO only | GO |
| Error handling: ErrorBoundary, offline banner | Present in app shell | GO |
| 36 tests passing, no regressions | 6 suites, 36 tests | GO |
| Play Store listing text drafted | `docs/release/play-store-listing-draft.md` | GO |
| Data safety responses drafted | `docs/release/data-safety-draft.md` | GO |
| Privacy policy link wired in Settings UI | `SettingsScreen.js:294` → `Linking.openURL(brand.privacyPolicyUrl)` | GO |
| Version consistent (1.1.0 / versionCode 2) | `package.json:4`, `app.json:5`, `build.gradle:95-96` | GO |

---

## NO-GO conditions (must clear before upload)

| # | Blocker | What to do | Runbook step | Est. |
|---|---------|-----------|-------------|------|
| 1 | Deploy Cloud Function | `cd functions && npm install && firebase deploy --only functions` | Step 1 | 15 min |
| 2 | Set new HF token server-side | `firebase functions:config:set hf.token="hf_NEW"` | Step 2 | 5 min |
| 3 | Revoke compromised HF + Vision tokens | huggingface.co/settings/tokens + Google Cloud Console | Step 3 | 10 min |
| 4 | Replace privacy URL + support email in `src/theme.js` | Host privacy policy page, update two strings | Step 5 | 30 min |
| 5 | Run EAS production build | `npm run eas:build:android:production` | Step 7 | 10 min |
| 6 | Create feature graphic + phone screenshots | 1024x500 graphic + min 2 screenshots at 1080x1920 | — | 30 min |

All blockers are external execution items. **Zero further code architecture changes needed.**

---

## Build path verification

| Path | Command | Signing | Output |
|------|---------|---------|--------|
| EAS production (recommended) | `npm run eas:build:android:production` | Remote upload keystore managed by EAS | `.aab` |
| Local production | `./gradlew bundleRelease -PRELEASE_STORE_FILE=... -PRELEASE_STORE_PASSWORD=... -PRELEASE_KEY_ALIAS=... -PRELEASE_KEY_PASSWORD=...` | Local keystore | `.aab` |
| Local debug-signed (testing only) | `./gradlew assembleRelease -PALLOW_DEBUG_SIGNING=true` | Debug keystore | `.apk` |
| Local bare (no flags) | `./gradlew assembleRelease` | **Fails** — no signingConfig | — |

**EAS submit path:** `npm run eas:submit:android` → uses `eas.json:29-34` → requires `google-play-service-account.json` (gitignored).

---

## After clearing blockers 1–7

1. Commit icon + `theme.js` changes
2. Build production AAB via EAS (step 7)
3. Validate AAB signing (step 8)
4. Upload to Play Console
5. Complete IARC content rating questionnaire
6. Enter data safety responses
7. Paste privacy policy URL in Play Console store listing
8. Submit for review

---

## Risk assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Play Store rejection for privacy policy content | Low | Draft covers all data types accurately |
| Crash on specific Android version | Low | Error boundary + offline-first |
| IARC rating higher than expected | Very low | No violence, gambling, or social features |
| TF model performance on low-end devices | Medium | Frequency model provides instant fallback |
| HF model cold-start latency | Medium | Cloud Function returns 502; app shows fallback |

---

**Bottom line:** The codebase is production-ready and security-clean. The 6 remaining items are deploy/config/asset tasks that require no further code changes beyond two string replacements in `src/theme.js`.
