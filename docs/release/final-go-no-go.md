# Final Go / No-Go Decision

**Date:** 2026-03-22
**Scope:** Mobile app + dashboard (where verifiable)

---

## Decision

| Component | Decision |
|-----------|----------|
| **Mobile** | **CONDITIONAL GO** — code is release-ready, 4 external actions remain |
| **Dashboard** | **CANNOT ASSESS** — repo not available in this environment |
| **Overall** | **GO for mobile** independently. Dashboard requires separate verification. |

---

## Mobile: Exact Blocker List (4)

Every item below is external. Zero code changes are needed.

| # | Blocker | What to do | Est. |
|---|---------|-----------|------|
| **M1** | No signed production AAB | Run `npm run eas:build:android:production`. EAS will prompt to generate or upload a keystore on first run. | 10 min |
| **M2** | Privacy policy URL is a placeholder | Host a privacy policy page. Then edit `src/theme.js` line 13: replace `https://REPLACE-ME.example.com/privacy-policy` with the real URL. Commit and rebuild. | 30 min |
| **M3** | Support email is a placeholder | Edit `src/theme.js` line 14: replace `REPLACE-ME@example.com` with a real email. | 1 min |
| **M4** | Missing Play Store graphics | Create 1024x500 feature graphic. Capture minimum 2 phone screenshots at 1080x1920. See `docs/release/play-store-assets-checklist.md`. | 30 min |

After completing M1–M4:
1. Commit the URL/email changes
2. Rebuild via EAS production
3. Upload AAB to Google Play Console
4. Fill IARC content rating + data safety form (drafts in `docs/release/data-safety-draft.md`)
5. Submit for review

---

## Mobile: What Was Verified (File Evidence)

| Criterion | Verified | Source |
|-----------|----------|--------|
| Release builds hard-fail without production signing | Yes | `build.gradle:118-128` — null signingConfig path, no debug fallback |
| ALLOW_DEBUG_SIGNING exists for local testing only | Yes | `build.gradle:125` — explicit opt-in flag |
| EAS production builds use remote credentials | Yes | `eas.json:23` — `credentialsSource: "remote"` |
| EAS produces AAB (not APK) | Yes | `eas.json:22` — `buildType: "app-bundle"` |
| Secrets not in repo | Yes | `.gitignore` covers `*.keystore`, `keystore.properties`, `google-play-service-account.json` |
| Firebase API key is intentionally client-side | Yes | `firebaseConfig.js` — standard Firebase web config pattern; security via rules, not key secrecy |
| Dead Vision API key flagged | Yes | `src/utils/autoDescribe.js` — never imported, advisory to delete |
| Permissions minimal | Yes | `AndroidManifest.xml` — 5 permissions, WRITE removed, SYSTEM_ALERT_WINDOW stripped in release |
| Privacy link wired in UI | Yes | `SettingsScreen.js:291-298` — Linking.openURL to brand.privacyPolicyUrl |
| Version consistent | Yes | 1.1.0 everywhere |
| 36 tests passing | Yes | Last run: 6 suites, 36 tests, 0 failures |
| AI personalisation toggle + reset | Yes | `SettingsScreen.js:231-274`, `aiProfileStore.js:109-127` |

---

## Dashboard: Cannot Verify

The repository `/home/user/ai-powered-aac-dashboard` does not exist on this machine. The following checks could not be performed:

- Hardcoded secrets audit
- Environment variable infrastructure
- Firebase security rules presence
- Rules test existence and pass/fail
- Schema patch application status

**Recommendation:** Run this same release gate from the dashboard repo environment to get the dashboard assessment.

---

## Advisory (Non-Blocking)

| Item | Risk | Recommendation |
|------|------|----------------|
| `src/utils/autoDescribe.js` contains a Google Cloud Vision API key | Medium | Delete the file (dead code) and rotate the key in Google Cloud Console |
| `archive/unused/` and `Old_models/` directories | None | Remove in future cleanup |
| Firebase Web API key in `firebaseConfig.js` | Low | Standard pattern — enforce via Firebase Security Rules + App Check |
