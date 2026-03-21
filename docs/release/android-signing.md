# Android Release Signing Guide

## Overview

CommAI uses two signing configurations:
- **Debug:** Built-in `debug.keystore` for development (committed to repo)
- **Release:** Production keystore loaded from environment/gradle properties (never committed)

## EAS Build (Recommended)

EAS handles signing automatically. When you run your first production build, EAS will prompt you to generate or upload a keystore.

```bash
# Production build via EAS (signing handled automatically)
npm run eas:build:android:production

# Submit to Play Store
npm run eas:submit:android
```

EAS stores your signing credentials securely in the cloud. You can manage them with:
```bash
npx eas credentials
```

## Local Release Build

For local release builds without EAS:

### 1. Generate a Production Keystore

```bash
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore release.keystore \
  -alias commai-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**IMPORTANT:** Store the keystore and passwords securely. If you lose them, you cannot update your app on the Play Store.

### 2. Configure Signing

Create `android/keystore.properties` (this file is .gitignored):

```properties
RELEASE_STORE_FILE=../release.keystore
RELEASE_STORE_PASSWORD=your_store_password
RELEASE_KEY_ALIAS=commai-release
RELEASE_KEY_PASSWORD=your_key_password
```

Or pass via gradle properties:

```bash
cd android && ./gradlew assembleRelease \
  -PRELEASE_STORE_FILE=../release.keystore \
  -PRELEASE_STORE_PASSWORD=your_store_password \
  -PRELEASE_KEY_ALIAS=commai-release \
  -PRELEASE_KEY_PASSWORD=your_key_password
```

### 3. Build Configuration

`android/app/build.gradle` is configured to:
- Use `signingConfigs.release` when `RELEASE_STORE_FILE` property is set
- Fall back to `signingConfigs.debug` when no release keystore is configured
- This means dev builds work without any extra config

### 4. Verify the Signed APK

```bash
# Check signing info
jarsigner -verify -verbose -certs android/app/build/outputs/apk/release/app-release.apk

# Or for AAB
jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab
```

## Security Checklist

- [ ] Production keystore is NOT in the git repository
- [ ] `*.keystore` (except debug) is in `.gitignore`
- [ ] `keystore.properties` is in `.gitignore`
- [ ] Keystore passwords are not hardcoded in build.gradle
- [ ] Keystore file is backed up securely (outside the repository)
- [ ] Play App Signing is enabled in Google Play Console (recommended)

## Play App Signing

Google recommends using Play App Signing, which stores your upload key separately from the app signing key. If you use EAS Build, this is set up automatically.

## Version Management

- `app.json` → `version` (display version, e.g., "1.1.0")
- `app.json` → `android.versionCode` (integer, incremented for each upload)
- `android/app/build.gradle` → `versionCode` and `versionName` (for local builds)
- `eas.json` → `"autoIncrement": true` (auto-increments versionCode on EAS builds)
