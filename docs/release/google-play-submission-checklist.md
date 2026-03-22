# Google Play Store Submission Checklist

## Hard Blockers (Must resolve before upload)

- [x] Release builds fail without production signing (no silent debug fallback)
- [x] EAS production profile configured with `credentialsSource: "remote"` and `buildType: "app-bundle"`
- [ ] **Production keystore generated** — run `npm run eas:build:android:production` (EAS will prompt) or generate locally per `android-signing.md`
- [ ] **Signed AAB built and verified** — see `release-build-verification.md`
- [ ] **Privacy policy URL hosted** — replace placeholder in `src/theme.js` → `brand.privacyPolicyUrl`
- [ ] **Feature graphic created** (1024x500) — see `play-store-assets-checklist.md`
- [ ] **Phone screenshots captured** (min 2) — see `play-store-assets-checklist.md`
- [ ] **Support email set** — replace placeholder in `src/theme.js` → `brand.supportEmail`

## Completed (Code/Config)

### Signing & Build
- [x] Release signing in build.gradle: env-driven, hard-fails without production keystore
- [x] `ALLOW_DEBUG_SIGNING` escape hatch for local testing only
- [x] `.gitignore` excludes `*.keystore`, `*.jks`, `keystore.properties`, `google-play-service-account.json`
- [x] EAS production profile: `autoIncrement`, `credentialsSource: "remote"`, `buildType: "app-bundle"`
- [x] EAS submit configured with service account key path and internal track
- [x] Version: 1.1.0, versionCode: 2

### App Identity
- [x] Package name: `com.elpabloawakens.aipoweredaacapp`
- [x] App name: "CommAI" (strings.xml, app.json)
- [x] Adaptive icon configured (foreground + background, all densities)
- [x] Splash screen configured
- [x] Portrait orientation locked
- [x] Brand colors: colorPrimary #4CAF50, colorPrimaryDark #388E3C

### Permissions (Minimal)
- [x] `CAMERA` — object recognition / scene mode
- [x] `RECORD_AUDIO` — audio communication features
- [x] `INTERNET` — Firebase sync (optional)
- [x] `VIBRATE` — haptic feedback
- [x] `READ_EXTERNAL_STORAGE` (maxSdkVersion=32) — legacy image picker
- [x] `SYSTEM_ALERT_WINDOW` removed from release builds
- [x] `WRITE_EXTERNAL_STORAGE` removed
- [x] Duplicates removed from app.json

### Content & Assets
- [x] Short description drafted (80 chars)
- [x] Full description drafted (4000 chars)
- [x] Release notes drafted
- [x] App icon exists at `assets/icon.png`
- [ ] Feature graphic (1024x500) — **needs creation**
- [ ] Phone screenshots (min 2) — **needs capture**

### Privacy & Compliance
- [x] Data safety draft prepared (`docs/release/data-safety-draft.md`)
- [x] Privacy policy link wired in Settings screen
- [ ] Privacy policy URL hosted and placeholder replaced
- [ ] Data safety form entered in Play Console
- [ ] IARC content rating completed
- [ ] Target audience declared

### Technical Quality
- [x] ProGuard rules for TensorFlow, Firebase, Expo, Hermes
- [x] Hermes engine enabled
- [x] New Architecture enabled
- [x] Offline-first — core communication without internet
- [x] Error boundary wraps entire app
- [x] No crash on first launch (onboarding handles fresh state)
- [x] 36 tests passing
- [x] AI model loads non-blocking
- [x] Unused `an-array-of-english-words` dependency removed

## Post-Submission

- [ ] Set up staged rollout (start at 10%)
- [ ] Monitor crash rate in Play Console (target < 1.09%)
- [ ] Monitor ANR rate (target < 0.47%)
- [ ] Respond to user reviews within 48 hours
- [ ] Monitor Play Console pre-launch report for accessibility findings
