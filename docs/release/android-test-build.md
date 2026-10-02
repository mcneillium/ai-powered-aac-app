# Voice PR #7 — test on Samsung Galaxy S24 Ultra

**Download:** `Voice-PR7-test-35914e5.zip` (28 MB), containing
`Voice-PR7-test-35914e5.apk` (32 MB, arm64 for the S24 Ultra), built from PR #7 head `35914e5`.
APK SHA-256: `920a6aa743b5a75d23d3277770a131a1b0550e74f7907bf5a53e394c5c404b36`
(It is zipped only because the APK is just over the file-sharing size limit; the app is unchanged.)

## Already installed the earlier "Voice PR7 Test"?
This build uses the same test key, so just install it over the top: it
updates the test app and keeps anything you saved in it.

## Will it affect my installed Voice app?
No. This is a **separate test app** called **"Voice PR7 Test"** (package
`com.elpabloawakens.aipoweredaacapp.prtest`). It installs *next to* your
existing Voice app and cannot overwrite it:
- Your installed app is signed with your release key; this APK uses a
  separate test key, so it could never update your real app in place.
- It has its own storage: your real app's favourites, history, custom words
  and settings are untouched, and the test app starts empty.
- Cloud is switched off in this build (no Firebase config), so it cannot
  sign in or sync, and cannot write to your account's cloud data. That also
  lets you test checklist section A (startup without cloud).

Keep using your existing Voice app normally. Remove "Voice PR7 Test" whenever
you like (Settings › Apps › Voice PR7 Test › Uninstall) — that removes only
the test app.

## Install (about 2 minutes)
1. Get `Voice-PR7-test-35914e5.zip` onto the phone (download it on the phone, or USB/Quick Share).
2. Open **My Files › Downloads**, tap the zip, choose **Extract**, then open the
   extracted folder and tap `Voice-PR7-test-35914e5.apk`.
3. If asked, allow installing unknown apps for that app (My Files or your
   browser): tap **Settings › Allow from this source**, then go back.
4. Tap **Install**. If **Auto Blocker** is on (Settings › Security and privacy
   › Auto Blocker), it blocks sideloading — turn it off for the install and
   back on afterwards.
5. If Google Play Protect warns about an unknown app, tap **More details ›
   Install anyway** (it is unsigned by Play because it is a local test build).
6. Open **Voice PR7 Test** from the app drawer.

## What to test first (15 minutes)
| # | Do this | Expect |
|---|---|---|
| 1 | Open the app (cloud is off in this build) | Board appears; no crash |
| 2 | Tap *I want* › *more* › Speak | Words appear and are spoken |
| 3 | Settings › Speech Speed 0.5× › back › tap a word | Clearly slower speech |
| 4 | Settings › Pronunciation: "more" → "moor please" › Save; tap *more* | Hears "moor please"; screen shows "more" |
| 5 | Build a long sentence, Speak, then tap Clear mid-speech | Stops instantly, doesn't restart; Undo brings it back |
| 6 | Tap 6 words very fast | Each word once, never two voices at once |
| 7 | Turn on TalkBack (Settings › Accessibility › TalkBack); swipe right through the board | Sentence text, then Speak, Delete, Clear… each read separately |
| 8 | Settings › Board & Communication › Compact layout ON | More rows of words; the top row never moves while typing/clearing |
| 9 | Settings › Display › Font size max; revisit board | Text readable, nothing overlapping |
| 10 | Close and reopen the app | Favourites/history/settings still there |

Full checklist with every scenario and expected result:
`docs/release/device-test-checklist.md` in the repo (sections A–F).
Not testable with this build: A5 (cloud sync between devices) and F1/F1b/F2
(upgrade-in-place from the store build — needs a release-key build).

Please note for each item: pass/fail, plus the TTS engine
(Settings › General management › Text-to-speech, usually Samsung or Google).

---

## How this test build was made (to reproduce it locally)

The test APK is built from a copy of the repo. Nothing below is committed
(`android/` is generated and git-ignored).

```bash
npx expo prebuild --platform android --no-install --clean
cd android
# 1. Separate test app, so it never touches the installed store app:
#    app/build.gradle  -> applicationId 'com.elpabloawakens.aipoweredaacapp.prtest'
#    app/src/main/res/values/strings.xml -> <string name="app_name">Voice PR7 Test</string>
# 2. Sign with your own test key (not the shared debug key):
keytool -genkeypair -keystore app/prtest.keystore -alias prtest -keyalg RSA -keysize 2048 -validity 3650
#    add a signingConfigs.prtest block and use it for buildTypes.release
# 3. Smaller APK for one phone (arm64 only, compressed native libs):
#    gradle.properties -> reactNativeArchitectures=arm64-v8a
#    gradle.properties -> expo.useLegacyPackaging=true
./gradlew assembleRelease
```

- Leave the `EXPO_PUBLIC_FIREBASE_*` variables unset. The test app then
  stays off your production cloud data.
- **Keep the same `prtest.keystore`** for future test builds, so each one
  installs as an update to "Voice PR7 Test". The key used for the APKs sent so
  far lived in a temporary cloud build environment and won't be available
  later. If you build with a new key, uninstall only "Voice PR7 Test" first.
  Never uninstall your real Voice app.
- **To update your real installed app** (keeping its data), build with your
  release credentials via EAS (`eas build --profile production`) and publish
  to a Play **internal testing** track, after bumping
  `android.versionCode` in `app.json`.
