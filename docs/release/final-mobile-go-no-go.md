# Final Mobile Go / No-Go

**App:** CommAI v1.1.0
**Date:** 2026-03-22
**Decision:** **CONDITIONAL GO** — code is release-ready; 4 external actions remain.

---

## GO criteria (all met)

| Criterion | Status |
|-----------|--------|
| Core AAC communication works offline | GO |
| AI suggestions working and personalised | GO |
| User can disable/reset AI personalisation | GO |
| Accessibility: screen reader, contrast, touch targets | GO |
| Release builds hard-fail without production signing | GO |
| EAS production config with remote credentials and AAB | GO |
| Permissions minimal and justified | GO |
| Error handling: ErrorBoundary, offline banner | GO |
| 36 tests passing, no regressions | GO |
| Play Store listing text drafted | GO |
| Data safety responses drafted | GO |
| Privacy policy link wired in Settings | GO |
| Version consistent (1.1.0 / versionCode 2) | GO |
| No secrets in repository | GO |
| Unused dependencies removed | GO |

## NO-GO conditions (must clear before upload)

| # | Action | Estimated effort | Who |
|---|--------|-----------------|-----|
| 1 | Run `npm run eas:build:android:production` to generate credentials + AAB | 10 min | Developer |
| 2 | Host privacy policy at a URL and replace `brand.privacyPolicyUrl` in `src/theme.js` | 30 min | Developer |
| 3 | Replace `brand.supportEmail` in `src/theme.js` | 1 min | Developer |
| 4 | Create 1024x500 feature graphic + capture 2+ phone screenshots | 30 min | Developer |

After clearing these 4 items:
1. Commit the URL/email changes
2. Build production AAB via EAS
3. Upload AAB to Play Console
4. Fill in content rating (IARC) and data safety form
5. Submit for review

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Play Store rejection for privacy policy content | Low | Draft covers all data types accurately |
| Crash on specific Android version | Low | Error boundary + offline-first design |
| IARC rating higher than expected | Very low | No violence, gambling, or social features |
| Model performance on low-end devices | Medium | Frequency model provides instant fallback |
| Large APK size due to TF model | Medium | Model is ~2MB; acceptable for AAC app |

---

**Bottom line:** The codebase is production-ready. The remaining 4 items are external actions (credential setup, hosting, asset creation) that require no further code changes.
