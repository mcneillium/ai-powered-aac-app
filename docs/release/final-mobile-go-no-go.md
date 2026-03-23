# Final Mobile Go / No-Go — CommAI v1.1.0

**Date:** 2026-03-23
**Decision:** **GO for internal testing** / **CONDITIONAL GO for Play Console submission**

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
| Privacy policy URL set | `src/theme.js:15` → `https://paulmartinmcneill.com/commai/privacy-policy` | GO |
| Support email set | `src/theme.js:16` → `support@paulmartinmcneill.com` | GO |
| App icon 512x512 | `assets/icon.png` — 512x512 RGBA PNG | GO |
| Version consistent (1.1.0 / versionCode 2) | `package.json:4`, `app.json:5` | GO |
| Production AAB built | EAS build succeeded, artifact: `b3SUx6vPMMNBFteQjM1scg.aab` | GO |
| JS bundle verified in clean sim | 1076 modules bundled, `export:embed` passes | GO |

---

## Resolved since last review (2026-03-22)

| Former blocker | Resolution |
|----------------|-----------|
| Replace privacy URL + support email | Set in commit `729a901` — `src/theme.js:15-16` |
| Run EAS production build | Succeeded — AAB artifact at `expo.dev/artifacts/eas/b3SUx6vPMMNBFteQjM1scg.aab` |

---

## Remaining items for internal testing (2 items)

| # | Item | Type | Action |
|---|------|------|--------|
| 1 | Deploy Cloud Function + set HF token | Infra | `firebase deploy --only functions` then `firebase functions:config:set hf.token="hf_NEW"` then redeploy |
| 2 | Smoke test on device | QA | Install AAB via bundletool or internal distribution, run smoke test checklist |

Image captioning will return "Caption unavailable" until item 1 is done. All other features work without it.

---

## Additional items for Play Console submission (3 items)

| # | Item | Type | Action |
|---|------|------|--------|
| 3 | Create feature graphic + phone screenshots | Design | 1024x500 graphic + min 2 phone screenshots at 1080x1920 |
| 4 | Complete Play Console forms | Admin | IARC content rating + data safety form + target audience |
| 5 | Revoke compromised tokens | Security | HF token at huggingface.co + Vision key at Google Cloud Console |

---

## Build path verification

| Path | Command | Signing | Output |
|------|---------|---------|--------|
| EAS production (used) | `npm run eas:build:android:production` | Remote keystore managed by EAS | `.aab` (**DONE**) |
| EAS submit | `npm run eas:submit:android` | Requires `google-play-service-account.json` | Play Console upload |

---

## Risk assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Privacy policy URL returns 404 | Low-Medium | Verify URL loads before submission |
| Play Store rejection for privacy policy | Low | Draft covers all data types |
| HF model cold-start latency | Medium | Cloud Function returns 502; app shows fallback |
| TF model on low-end devices | Medium | Frequency model provides instant fallback |

---

**Bottom line:** The codebase is production-ready, the AAB is built and signed. Internal testing can begin immediately after Cloud Function deployment. Play Console submission requires 3 additional human-only items (assets, forms, token rotation).
