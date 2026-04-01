# Release Build Verification

## Quick Verification Steps

### 1. Verify release builds FAIL without production signing

```bash
cd android && ./gradlew assembleRelease 2>&1
```

**Expected:** Build fails with an error about missing signing configuration. If it succeeds, the signing guard is broken.

### 2. Verify debug-signed release works with explicit flag

```bash
cd android && ./gradlew assembleRelease -PALLOW_DEBUG_SIGNING=true
```

**Expected:** Build succeeds. Output at `app/build/outputs/apk/release/app-release.apk`.

Check the signer:
```bash
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
```
**Expected:** Shows `CN=Android Debug` — confirms it's debug-signed (not for Play Store).

### 3. Verify production-signed release works with real keystore

```bash
cd android && ./gradlew bundleRelease \
  -PRELEASE_STORE_FILE=../release.keystore \
  -PRELEASE_STORE_PASSWORD=<password> \
  -PRELEASE_KEY_ALIAS=commai-release \
  -PRELEASE_KEY_PASSWORD=<password>
```

**Expected:** Build succeeds. Output at `app/build/outputs/bundle/release/app-release.aab`.

Check the signer:
```bash
jarsigner -verify -verbose app/build/outputs/bundle/release/app-release.aab
```
**Expected:** Shows your production certificate CN, NOT `CN=Android Debug`.

### 4. Verify EAS production build

```bash
npm run eas:build:android:production
```

**Expected:** EAS prompts for credentials (first time) or uses stored credentials. Build completes and produces an AAB.

### 5. Verify no secrets in repository

```bash
git ls-files | grep -iE '\.keystore$|\.jks$|service-account|\.pem$|\.p12$'
```

**Expected:** Only `android/app/debug.keystore` should appear.

```bash
grep -r 'RELEASE_STORE_PASSWORD\|RELEASE_KEY_PASSWORD' --include='*.gradle' --include='*.properties'
```

**Expected:** Only references in build.gradle that read from properties — no actual password values.

## Pre-Upload Checklist

- [ ] `jarsigner -verify` on the AAB shows production certificate
- [ ] APK/AAB installs and launches correctly on a physical device
- [ ] App name shows "CommAI" in launcher
- [ ] Onboarding appears on fresh install
- [ ] Core AAC board works (tap word → speech output)
- [ ] Settings screen loads without crash
- [ ] AI suggestions appear after typing a few words
- [ ] Offline banner appears when network is disabled
- [ ] Theme switching works (light/dark/high-contrast)
