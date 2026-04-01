# Final Mobile Go / No-Go — Voice v1.1.0

**Date:** 2026-03-23
**Brand:** Voice (rebranded from CommAI)
**Decision:** **CONDITIONAL GO** — new Voice-branded EAS build required, then GO for submission

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
| EAS production config: AAB + remote credentials | `eas.json` production profile | GO |
| Permissions minimal and justified | `app.json:37-40` — CAMERA, RECORD_AUDIO only | GO |
| 36 tests passing, no regressions | 6 suites, 36 tests | GO |
| Play Store listing text drafted | `docs/release/play-store-listing-draft.md` (Voice brand) | GO |
| Data safety responses drafted | `docs/release/data-safety-draft.md` | GO |
| Privacy policy link wired in Settings UI | `SettingsScreen.js:294` → `brand.privacyPolicyUrl` | GO |
| Privacy policy URL set | `src/theme.js:11` → `https://paulmartinmcneill.com/commai/privacy-policy` | GO |
| Support email set | `src/theme.js:12` → `support@paulmartinmcneill.com` | GO |
| Voice brand applied | `app.json:3` → "Voice", `src/theme.js:7` → "Voice", teal palette | GO |
| App icon 512x512 (Voice branded) | `assets/icon.png` — Voice mic + wordmark | GO |
| Adaptive icon with background | `assets/adaptive-icon.png` + `adaptive-icon-background.png` | GO |
| Feature graphic 1024x500 | `assets/branding/google-play/feature-graphic/feature-graphic-1024x500.png` | GO |
| Screenshot templates ready | 4 templates + compositing script + capture guide | GO |
| Version consistent (1.1.0) | `package.json:4`, `app.json:5` | GO |

---

## Remaining items (5 total, all human-only)

### Must do before Play Console upload

| # | Item | Type | Action |
|---|------|------|--------|
| 1 | **Run Voice-branded EAS build** | Build | `npx eas build --profile production --platform android` |
| 2 | **Capture 4 screenshots** | Design | See `docs/release/final-screenshot-capture-guide.md` |
| 3 | **Complete Play Console forms** | Admin | IARC + data safety + target audience |

### Should do (infra + security)

| # | Item | Type | Action |
|---|------|------|--------|
| 4 | Deploy Cloud Function + set HF token | Infra | `firebase deploy --only functions` + `firebase functions:config:set hf.token="hf_NEW"` |
| 5 | Revoke compromised tokens | Security | HF token + Vision key in external consoles |

Image captioning returns "Caption unavailable" until item 4 is done. All other features work without it.

---

## Risk assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Privacy policy URL returns 404 | Low-Medium | Verify URL loads before submission |
| Play Store rejection for privacy policy | Low | Draft covers all data types |
| HF model cold-start latency | Medium | Cloud Function returns 502; app shows fallback |

---

**Bottom line:** Code, branding, assets, and docs are complete. One EAS build + 4 screenshots + Play Console forms are the only remaining steps.
