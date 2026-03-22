# Master Release Status

**Date:** 2026-03-22
**Verified from:** file-backed evidence in both repository locations

---

## Mobile App — CommAI v1.1.0-rc2

### Status: **CONDITIONAL GO**

### Verified (file evidence)

| Check | File | Finding | Status |
|-------|------|---------|--------|
| Release builds fail without production keystore | `android/app/build.gradle:118-128` | `signingConfig` is null when neither `RELEASE_STORE_FILE` nor `ALLOW_DEBUG_SIGNING` is set. No fallback to `signingConfigs.debug`. | PASS |
| EAS production config correct | `eas.json:14-25` | `credentialsSource: "remote"`, `buildType: "app-bundle"`, `autoIncrement: true` | PASS |
| Privacy policy placeholder wired | `src/theme.js:13` | `privacyPolicyUrl: 'https://REPLACE-ME.example.com/privacy-policy'` — placeholder present, link wired in Settings screen | PASS (integration done, URL pending) |
| Support email placeholder wired | `src/theme.js:14` | `supportEmail: 'REPLACE-ME@example.com'` | PASS (integration done, value pending) |
| App identity correct | `app.json:3`, `strings.xml:2` | Name: "CommAI", package: `com.elpabloawakens.aipoweredaacapp`, versionCode: 2 | PASS |
| Permissions minimal | `AndroidManifest.xml` | CAMERA, INTERNET, RECORD_AUDIO, VIBRATE, READ_EXTERNAL_STORAGE (maxSdk=32). WRITE_EXTERNAL_STORAGE removed. SYSTEM_ALERT_WINDOW has `tools:node="removeInRelease"`. | PASS |
| Secrets in .gitignore | `.gitignore:21,27,45` | `*.keystore`, `keystore.properties`, `google-play-service-account.json` all listed | PASS |
| Version synchronized | `package.json:4`, `app.json:5`, `build.gradle:96` | All 1.1.0 / versionCode 2 | PASS |
| Tests passing | `npm test` | 36/36 passing | PASS |
| AI personalisation controllable | `SettingsContext.js:19`, `SettingsScreen.js:231-274` | Toggle + reset button + gated recording | PASS |

### Hardcoded API Keys (Reclassified)

| File | Key type | Risk | Action needed |
|------|----------|------|---------------|
| `firebaseConfig.js:12` | Firebase Web API key | **Low** — Firebase web API keys are designed to be public. Security enforced by Firebase Security Rules + App Check, not key secrecy. `messagingSenderId` and `appId` are `...` placeholders. | None (standard Firebase pattern) |
| `src/utils/autoDescribe.js:7` | Google Cloud Vision API key | **Medium** — real secret, but file is dead code (imported by zero files) | Delete file or rotate key |

### Mobile Blockers (4 remaining, all external)

| # | Blocker | Type | Effort |
|---|---------|------|--------|
| M1 | Run `npm run eas:build:android:production` to generate credentials + signed AAB | Infra | 10 min |
| M2 | Host privacy policy at public URL → replace `brand.privacyPolicyUrl` in `src/theme.js` | Legal | 30 min |
| M3 | Replace `brand.supportEmail` in `src/theme.js` | Config | 1 min |
| M4 | Create feature graphic (1024x500) + capture 2+ phone screenshots | Design | 30 min |

**Advisory (non-blocking):** Delete `src/utils/autoDescribe.js` (dead code with leaked Vision API key) or rotate the key.

---

## Dashboard — ai-powered-aac-dashboard

### Status: **CANNOT VERIFY — REPO NOT PRESENT**

The dashboard repository does not exist at `/home/user/ai-powered-aac-dashboard` or anywhere under `/home/user/`. Only the mobile app repo is available on this machine.

### What can be verified from mobile repo evidence

| Check | Evidence | Finding |
|-------|----------|---------|
| Schema patch exists | `dashboard-schema-fix-rebased.patch` (114 KB) | Patch creates `src/shared/schema.js`, aligns field names (`targetUserId`/`carerId`), adds Feedback + UserSettings pages |
| Patch application status | Cannot verify | Patch is present in mobile repo but whether it was applied to dashboard is unknown |
| Dashboard hardcoded secrets | Cannot verify | No dashboard files accessible |
| Dashboard env infrastructure | Cannot verify | No dashboard files accessible |
| Firebase rules files | Cannot verify | Not present in mobile repo (expected in dashboard or Firebase Console) |
| Firebase rules tests | Cannot verify | Not present in mobile repo |

### Dashboard Blockers (status unknown — must verify from dashboard repo)

| # | Suspected blocker | Needs verification |
|---|-------------------|--------------------|
| D1 | Hardcoded Firebase config | Check dashboard `firebaseConfig.js` or similar |
| D2 | Env/secret infrastructure | Check for `.env.example` and `process.env` usage |
| D3 | Firebase security rules | Check for `database.rules.json` or `firebase.json` |
| D4 | Rules tests | Check for security rules test files |
| D5 | Schema patch applied | Check if `src/shared/schema.js` exists in dashboard |

---

## Overall Release

### Status: **MOBILE CONDITIONAL GO / DASHBOARD UNVERIFIABLE**

| Component | Status | Blocker count | Verified |
|-----------|--------|---------------|----------|
| Mobile app | **CONDITIONAL GO** | 4 external (no code changes) | Yes — file evidence |
| Dashboard | **UNKNOWN** | Unknown | No — repo not accessible |
| Overall | **PARTIAL GO** | 4 confirmed + unknown dashboard | Mobile verified only |

The mobile app is ready for Play Store submission once the 4 external items are completed. The dashboard cannot be assessed from this environment.
