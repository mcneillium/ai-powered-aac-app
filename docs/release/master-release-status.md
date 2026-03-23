# Master Release Status

**Date:** 2026-03-23
**Verified from:** file-backed evidence in repository

---

## Mobile App — CommAI v1.1.0

### Status: **GO for internal testing** / **CONDITIONAL GO for Play Console**

### Build

| Item | Status |
|------|--------|
| EAS production build | **SUCCEEDED** |
| AAB artifact | `https://expo.dev/artifacts/eas/b3SUx6vPMMNBFteQjM1scg.aab` |
| JS bundle verification | 1076 modules, clean sim passed |
| Signing | Remote keystore managed by EAS |

### Verified (file evidence)

| Check | File | Finding | Status |
|-------|------|---------|--------|
| Release builds fail without production keystore | `build.gradle:123-128` | `signingConfig` null without env vars | PASS |
| EAS production config correct | `eas.json:20-29` | `credentialsSource: "remote"`, `buildType: "app-bundle"`, `autoIncrement: true` | PASS |
| Privacy policy URL set | `src/theme.js:15` | `https://paulmartinmcneill.com/commai/privacy-policy` | PASS |
| Support email set | `src/theme.js:16` | `support@paulmartinmcneill.com` | PASS |
| App identity correct | `app.json:3,41` | Name: "CommAI", package: `com.elpabloawakens.aipoweredaacapp`, versionCode: 2 | PASS |
| Permissions minimal | `app.json:37-40` | CAMERA, RECORD_AUDIO | PASS |
| Secrets in .gitignore | `.gitignore` | `*.keystore`, `keystore.properties`, `google-play-service-account.json` | PASS |
| Version synchronized | `package.json:4`, `app.json:5` | All 1.1.0 / versionCode 2 | PASS |
| Tests passing | `npm test` | 36/36 passing | PASS |
| AI personalisation controllable | `SettingsScreen.js` | Toggle + reset button + gated recording | PASS |
| No secrets in source | `grep -rn "hf_\|AIzaSyD\|Bearer" src/` | 0 results | PASS |

### Remaining Items (5 total, all human-only)

| # | Item | Type | Needed for |
|---|------|------|-----------|
| 1 | Deploy Cloud Function + set HF token | Infra | Internal testing |
| 2 | Smoke test on device | QA | Internal testing |
| 3 | Create feature graphic + screenshots | Design | Play Console |
| 4 | Complete IARC + data safety + target audience forms | Admin | Play Console |
| 5 | Revoke compromised HF + Vision tokens | Security | Hygiene |

**Zero code changes remain.**

---

## Dashboard — ai-powered-aac-dashboard

### Status: **NOT IN SCOPE** — separate repository, not assessed from this environment.

---

## Overall

| Component | Status | Remaining items |
|-----------|--------|-----------------|
| Mobile app | **GO (internal testing)** / **CONDITIONAL GO (Play Console)** | 5 human-only |
| Dashboard | Out of scope | — |
