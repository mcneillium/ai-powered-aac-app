# Final Go / No-Go Decision

**Date:** 2026-03-22
**App:** CommAI v1.1.0

---

## Decision: **CONDITIONAL GO**

The codebase is secure and release-ready. Six external actions remain.

---

## What was resolved this session

| Blocker | Resolution |
|---------|-----------|
| HF token hardcoded in `hfImageCaption.js` | Refactored to Cloud Function proxy. Token removed from mobile app. |
| Vision key in `autoDescribe.js` | File deleted (dead code). |
| HF tokens in `archive/unused/` | Files deleted. |
| Vertex AI file in `Old_models/` | File deleted. |
| No secure API architecture | Cloud Function proxy created at `functions/index.js`. |
| No failure states for backend | Safe fallback strings on timeout/error/offline. |

**Verification:**
```
grep -rn "hf_[A-Za-z]" src/   → 0 results
grep -rn "AIzaSyD" src/        → 0 results
grep -rn "Bearer" src/         → 0 results
```

---

## Remaining blockers (6)

| # | Blocker | What to do | Est. |
|---|---------|-----------|------|
| **M1** | Deploy Cloud Function | `cd functions && npm install && firebase deploy --only functions` then `firebase functions:config:set hf.token="hf_NEW"` | 15 min |
| **M2** | Rotate compromised tokens | Revoke `hf_NHyUO...` at huggingface.co. Revoke `AIzaSyD4W...` in Google Cloud Console. | 10 min |
| **M3** | Run EAS production build | `npm run eas:build:android:production` — EAS prompts for credentials on first run | 10 min |
| **M4** | Host privacy policy URL | Host page, replace `brand.privacyPolicyUrl` in `src/theme.js:13` | 30 min |
| **M5** | Set support email | Replace `brand.supportEmail` in `src/theme.js:14` | 1 min |
| **M6** | Play Store graphics | Create 1024x500 feature graphic + capture min 2 phone screenshots | 30 min |

After completing M1–M6:
1. Commit M4+M5 string replacements
2. Rebuild via EAS production
3. Upload AAB to Google Play Console
4. Fill IARC + data safety form
5. Submit for review

---

## Signing posture

| Build path | Signing behaviour | Evidence |
|-----------|-------------------|----------|
| `./gradlew assembleRelease` (no flags) | **Fails** — no signingConfig | `build.gradle:118-128` |
| `./gradlew assembleRelease -PALLOW_DEBUG_SIGNING=true` | Debug-signed (local testing only) | `build.gradle:125-126` |
| `./gradlew bundleRelease -PRELEASE_STORE_FILE=...` | Production-signed | `build.gradle:123-124` |
| `npm run eas:build:android:production` | Production-signed via EAS remote credentials | `eas.json:22-23` |

No path silently uses debug signing for a production artifact.

---

## Risk summary

| Risk | Status |
|------|--------|
| Third-party API secrets in mobile app | **Eliminated** |
| Debug signing used for production | **Eliminated** |
| Compromised tokens still active | **Requires rotation (M2)** |
| Cloud Function not yet deployed | **Requires deploy (M1)** — camera captioning will fail gracefully until deployed |
