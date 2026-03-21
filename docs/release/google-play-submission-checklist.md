# Google Play Store Submission Checklist

## Pre-submission Requirements

### Signing & Build
- [x] Release signing configured in build.gradle (env-driven, not hardcoded)
- [x] Debug keystore NOT used for release builds
- [x] `.gitignore` excludes keystore and properties files
- [x] EAS production profile configured with autoIncrement
- [x] Version: 1.1.0, versionCode: 2
- [ ] Production keystore generated (or EAS credentials configured)
- [ ] Signed AAB built and verified

### App Identity
- [x] Package name: `com.elpabloawakens.aipoweredaacapp`
- [x] App name: "CommAI" (set in strings.xml and app.json)
- [x] Adaptive icon configured (foreground + background)
- [x] Splash screen configured
- [x] Portrait orientation locked

### Permissions (Minimal Set)
- [x] `CAMERA` — Object recognition for AAC scene mode
- [x] `RECORD_AUDIO` — Future audio-based communication features
- [x] `INTERNET` — Firebase sync (optional, not required for core use)
- [x] `VIBRATE` — Haptic feedback for button presses
- [x] `READ_EXTERNAL_STORAGE` (maxSdkVersion=32) — Legacy image picker support
- [x] `SYSTEM_ALERT_WINDOW` removed from release builds (dev-only)
- [x] `WRITE_EXTERNAL_STORAGE` removed (unnecessary)
- [x] Duplicate permissions removed from app.json

### Content & Assets
- [ ] Feature graphic (1024x500 PNG)
- [ ] App icon (512x512 PNG)
- [ ] Screenshots: Phone (min 2, 16:9 or 9:16, 320px-3840px each side)
- [ ] Screenshots: Tablet (if supporting tablets)
- [ ] Short description (max 80 chars)
- [ ] Full description (max 4000 chars)
- [ ] Release notes

### Privacy & Compliance
- [ ] Privacy policy URL hosted
- [ ] Data safety form completed
- [ ] Age rating questionnaire completed
- [ ] Content rating (likely "Everyone")
- [ ] Accessibility features declared
- [ ] Target audience declared

### Technical Quality
- [x] ProGuard rules configured for TensorFlow, Firebase, Expo, Hermes
- [x] Hermes engine enabled
- [x] New Architecture enabled
- [x] Offline-first — core communication works without internet
- [x] Error boundary wraps entire app
- [x] No crash on first launch (onboarding handles fresh state)
- [x] 32 tests passing
- [x] AI model loads non-blocking

## Post-submission
- [ ] Monitor crash reports in Play Console
- [ ] Set up staged rollout (start at 10%)
- [ ] Monitor ANR rate (target < 0.47%)
- [ ] Monitor crash rate (target < 1.09%)
- [ ] Respond to user reviews within 48 hours
