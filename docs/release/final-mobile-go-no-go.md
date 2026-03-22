# Final Mobile Go / No-Go — CommAI v1.1.0

**Date:** 2026-03-22
**Decision:** **CONDITIONAL GO** — code is release-ready; 6 human-only execution items remain.

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
| Firebase deploy config present | `firebase.json` + `.firebaserc` (project `commai-b98fe`) | GO |
| Safe failure states for backend | `hfImageCaption.js:50,58,61` — fallback strings | GO |
| Release builds hard-fail without production signing | `build.gradle:123-128` — null signingConfig path | GO |
| EAS production config: AAB + remote credentials | `eas.json:22-24` | GO |
| Permissions minimal and justified | `app.json:37-40` — CAMERA, RECORD_AUDIO only | GO |
| 36 tests passing, no regressions | 6 suites, 36 tests | GO |
| Play Store listing text drafted | `docs/release/play-store-listing-draft.md` | GO |
| Data safety responses drafted | `docs/release/data-safety-draft.md` | GO |
| Privacy policy link wired in Settings UI | `SettingsScreen.js:294` | GO |
| App icon 512x512 | `assets/icon.png` — 512x512 RGBA PNG | GO |
| Version consistent (1.1.0 / versionCode 2) | `package.json:4`, `app.json:5`, `build.gradle:95-96` | GO |

---

## NO-GO conditions (must clear before upload)

| # | Blocker | What to do | Runbook step |
|---|---------|-----------|-------------|
| 1 | Replace privacy URL + support email | Edit `src/theme.js:15-16`, commit | Step 1 |
| 2 | Deploy Cloud Function | `firebase deploy --only functions` (requires Firebase CLI login) | Step 2 |
| 3 | Set new HF token server-side | `firebase functions:config:set hf.token="hf_NEW"` + redeploy | Step 3 |
| 4 | Revoke compromised tokens | huggingface.co + Google Cloud Console | Step 4 |
| 5 | Run EAS production build | `npm run eas:build:android:production` (requires Expo login) | Step 5 |
| 6 | Create feature graphic + screenshots | 1024x500 graphic + min 2 phone screenshots | Step 8 |

All are human-only tasks requiring credentials or design tools. **Zero code changes remain.**

---

## Build path verification

| Path | Command | Signing | Output |
|------|---------|---------|--------|
| EAS production (recommended) | `npm run eas:build:android:production` | Remote upload keystore managed by EAS | `.aab` |
| Local production | `./gradlew bundleRelease -PRELEASE_STORE_FILE=...` | Developer-provided keystore | `.aab` |
| Local debug-signed (testing only) | `./gradlew assembleRelease -PALLOW_DEBUG_SIGNING=true` | Debug keystore (explicit opt-in) | `.apk` |
| Local bare (no flags) | `./gradlew assembleRelease` | **Fails** — no signingConfig | — |

**EAS submit:** `npm run eas:submit:android` → `eas.json:29-34` → requires `google-play-service-account.json` (gitignored).

---

## After clearing blockers 1–6

1. Build production AAB via EAS (step 5)
2. Validate AAB signing (step 6)
3. Smoke test on device (step 7)
4. Upload to Play Console (step 9)
5. Complete IARC + data safety form
6. Submit for review

---

## Risk assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Play Store rejection for privacy policy | Low | Draft covers all data types |
| Crash on specific Android version | Low | Error boundary + offline-first |
| HF model cold-start latency | Medium | Cloud Function returns 502; app shows fallback |
| TF model on low-end devices | Medium | Frequency model provides instant fallback |

---

**Bottom line:** The codebase is production-ready and security-clean. The 6 remaining items are human-only tasks (credentials, hosting, design) that cannot be automated from the repo.
