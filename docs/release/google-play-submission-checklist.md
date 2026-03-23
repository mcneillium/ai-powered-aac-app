# Google Play Store Submission Checklist

**Updated:** 2026-03-23

## Hard Blockers (Must resolve before upload)

- [x] Release builds fail without production signing (no silent debug fallback)
- [x] EAS production profile configured with `credentialsSource: "remote"` and `buildType: "app-bundle"`
- [x] **Production AAB built** — EAS build succeeded, artifact: `b3SUx6vPMMNBFteQjM1scg.aab`
- [x] **Privacy policy URL set** — `https://paulmartinmcneill.com/commai/privacy-policy` in `src/theme.js:15`
- [x] **Support email set** — `support@paulmartinmcneill.com` in `src/theme.js:16`
- [ ] **Feature graphic created** (1024x500) — see `play-store-assets-checklist.md`
- [ ] **Phone screenshots captured** (min 2) — see `play-store-assets-checklist.md`

## Completed (Code/Config)

### Signing & Build
- [x] Release signing in build.gradle: env-driven, hard-fails without production keystore
- [x] `ALLOW_DEBUG_SIGNING` escape hatch for local testing only
- [x] `.gitignore` excludes `*.keystore`, `*.jks`, `keystore.properties`, `google-play-service-account.json`
- [x] EAS production profile: `autoIncrement`, `credentialsSource: "remote"`, `buildType: "app-bundle"`
- [x] EAS submit configured with service account key path and internal track
- [x] Version: 1.1.0, versionCode: 2
- [x] Production AAB built and artifact available

### App Identity
- [x] Package name: `com.elpabloawakens.aipoweredaacapp`
- [x] App name: "CommAI" (app.json)
- [x] Adaptive icon configured (foreground + background)
- [x] Splash screen configured
- [x] Portrait orientation locked
- [x] Brand colors: primaryColor #4CAF50, accentColor #2196F3

### Permissions (Minimal)
- [x] `CAMERA` — object recognition / scene mode
- [x] `RECORD_AUDIO` — audio communication features
- [x] `INTERNET` — Firebase sync (optional)

### Content & Assets
- [x] Short description drafted (71 chars)
- [x] Full description drafted
- [x] Release notes drafted
- [x] App icon exists at `assets/icon.png` (512x512)
- [ ] Feature graphic (1024x500) — **needs creation**
- [ ] Phone screenshots (min 2) — **needs capture**

### Privacy & Compliance
- [x] Data safety draft prepared (`docs/release/data-safety-draft.md`)
- [x] Privacy policy link wired in Settings screen
- [x] Privacy policy URL set (not a placeholder)
- [x] Support email set (not a placeholder)
- [ ] Data safety form entered in Play Console
- [ ] IARC content rating completed
- [ ] Target audience declared

### Technical Quality
- [x] Hermes engine enabled
- [x] New Architecture enabled
- [x] Offline-first — core communication without internet
- [x] Error boundary wraps entire app
- [x] No crash on first launch (onboarding handles fresh state)
- [x] 36 tests passing
- [x] AI model loads non-blocking
- [x] JS bundle verified in clean EAS simulation

## Post-Submission

- [ ] Set up staged rollout (start at 10%)
- [ ] Monitor crash rate in Play Console (target < 1.09%)
- [ ] Monitor ANR rate (target < 0.47%)
- [ ] Respond to user reviews within 48 hours
- [ ] Monitor Play Console pre-launch report for accessibility findings
