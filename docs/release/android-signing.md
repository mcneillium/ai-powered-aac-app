# Android Release Signing Guide

## Signing Behaviour Summary

| Build type | Signing source | Behaviour when missing |
|---|---|---|
| `debug` | `debug.keystore` (committed) | Always available |
| `release` with `RELEASE_STORE_FILE` | Production keystore | Builds normally |
| `release` without `RELEASE_STORE_FILE` | **None** | **Build fails** (no signing config) |
| `release` with `ALLOW_DEBUG_SIGNING` | `debug.keystore` | Debug-signed release for local testing only |

**Production release builds will not silently fall back to debug signing.** If `RELEASE_STORE_FILE` is not set, Gradle will refuse to produce a signed APK/AAB.

---

## Recommended: EAS Build (Cloud)

EAS Build manages Android signing credentials in the cloud. On the first production build, EAS prompts you to generate or upload a keystore. This is the simplest and safest path.

```bash
# First time: EAS will prompt for credentials
npm run eas:build:android:production

# Manage credentials later
npx eas credentials

# Submit to Play Store
npm run eas:submit:android
```

**EAS config (`eas.json`):**
- `credentialsSource: "remote"` — EAS stores credentials securely
- `buildType: "app-bundle"` — produces AAB for Play Store
- `autoIncrement: true` — bumps versionCode automatically
- `submit.production.android.track: "internal"` — submits to internal test track

**Required for submission via EAS:**
- A Google Play service account JSON key (for `eas submit`)
- Place it at `./google-play-service-account.json` (gitignored)
- Or configure it interactively: `npx eas submit --platform android`

---

## Alternative: Local Release Build

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

Store the keystore file and passwords somewhere secure and backed up. If lost, you cannot update the app on the Play Store.

### 2. Build with Production Signing

Pass the keystore details as Gradle properties:

```bash
cd android && ./gradlew bundleRelease \
  -PRELEASE_STORE_FILE=../release.keystore \
  -PRELEASE_STORE_PASSWORD=your_store_password \
  -PRELEASE_KEY_ALIAS=commai-release \
  -PRELEASE_KEY_PASSWORD=your_key_password
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### 3. Local Debug-Signed Release (Testing Only)

For testing a release build locally without a production keystore:

```bash
cd android && ./gradlew assembleRelease -PALLOW_DEBUG_SIGNING=true
```

This produces a debug-signed APK that **cannot** be uploaded to the Play Store. It is only for local testing of minification, ProGuard, and release-mode behaviour.

### 4. Verify the Signed Bundle

```bash
jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab
```

---

## How build.gradle Works

```groovy
signingConfigs {
    debug { /* debug.keystore — always available */ }
    if (project.hasProperty('RELEASE_STORE_FILE')) {
        release { /* production keystore from properties */ }
    }
}
buildTypes {
    release {
        if (hasProperty('RELEASE_STORE_FILE'))    → signingConfig = release
        else if (hasProperty('ALLOW_DEBUG_SIGNING')) → signingConfig = debug
        else                                        → signingConfig = null → BUILD FAILS
    }
}
```

---

## Security Checklist

- [ ] Production keystore is NOT in the git repository
- [ ] `*.keystore` (except debug) is in `.gitignore`
- [ ] `keystore.properties` is in `.gitignore`
- [ ] `google-play-service-account.json` is in `.gitignore`
- [ ] Keystore passwords are not hardcoded in build.gradle
- [ ] Keystore file is backed up securely (outside the repository)
- [ ] Play App Signing is enabled in Google Play Console

## Version Management

| Source | Field | Purpose |
|--------|-------|---------|
| `app.json` | `version` | Display version (1.1.0) |
| `app.json` | `android.versionCode` | Upload integer (2) |
| `android/app/build.gradle` | `versionCode` / `versionName` | Local builds |
| `eas.json` | `autoIncrement: true` | Auto-bumps versionCode on EAS builds |
