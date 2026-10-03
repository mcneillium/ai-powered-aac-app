# AAC Usability & Reliability Pass — October 2026

Scope: the mobile app (`ai-powered-aac-app`). The caregiver dashboard was not changed.

## Prioritised plan (from the code as it stood)

1. **Speech reliability.** Settings speed/pitch were ignored on the AAC Board, because voice presets overwrote them. `stop()` depended on `onStart` firing. There was no long-text limit and no fallback for a missing voice. There was also no pronunciation control.
2. **Motor-plan stability and screen-reader access.**
   - The grid moved about 50px when the first word was added, when the sentence wrapped, when suggestions appeared, and between Home and other pages.
   - The whole sentence bar was one `accessible` element, which hid Speak/Delete/Clear from VoiceOver and Switch Control.
   - The floating Quick Phrases button covered the "yes" button.
3. **Editing and data safety.**
   - There was no undo.
   - Only 8 favourites or history items could be reached.
   - The 51st favourite silently deleted the oldest one.
   - Corrupt storage was overwritten by the next save.
   - Rapid settings updates could drop earlier changes.
4. **User control.** Optional settings for word suggestions, speaking each word on tap, text size, and hiding the voice-style and scanning bars. The defaults keep the existing layout.
5. **Find a word** across all pages, showing where the word lives.
6. **Contrast.**
   - Light theme action buttons were 2.2–3.3:1 and Dark theme ones under 3:1.
   - Quick Phrases tiles were as low as 2.2:1.
   - The High Contrast scan ring was orange on yellow borders.

All six are implemented.

## What changed

| Area | Change | Files |
|------|--------|-------|
| Speech | Presets now scale the user's own rate/pitch. All screens use `buildSpeechOptions()`. `stop()` always calls the native stop. Text is split under the Android limit of about 4000 characters. A voice missing on this device falls back to the default voice, and an engine error retries once with the default voice. | `services/speechService.js`, all screens |
| Pronunciation | User dictionary that substitutes whole words, case-insensitively, in spoken text only. Edited in Settings with "Save and Listen". | `services/pronunciationStore.js`, `SettingsScreen.js` |
| Layout stability | The message area is a fixed-height scrolling box. The action row has a fixed set of buttons, with unavailable ones dimmed and marked disabled. The suggestion strip has a fixed height. The page bar shows on every page. | `AACBoardScreen.js` |
| Quick Phrases | On the board it opens from the action row instead of the floating button. Other screens keep the floating button. Tile colours meet AA. | `QuickRepairOverlay.js` |
| Editing | Undo after Clear, Delete, or replacing the sentence from history/favourites; it is also reachable by scanning. Favourites and history lists scroll through every entry. Favourites can be removed, with a confirmation. | `AACBoardScreen.js` |
| Data safety | Unreadable stored JSON is copied to `<key>__corrupt` before falling back. Favourites are capped at 200 and new ones are refused when full, with a message, instead of evicting old ones. Settings updates build on the latest state. | `utils/safeStorage.js`, stores, `SettingsContext.js` |
| Find a word | Searches every page and custom words. Each result can be added, or the user can jump to the page where it lives. On-device AI personalisation counts unmatched searches so they can surface vocabulary gaps. | `components/WordFinder.js`, `data/coreVocabulary.js` |
| Contrast | AA palettes for Light and Dark, and a per-theme `focusRing` token, both enforced by `theme.test.js`. | `theme.js` |
| Attribution | ARASAAC credit (CC BY-NC-SA) added to Settings → About. | `SettingsScreen.js` |
| Web robustness | Native-only global shims and React-Native-only Firebase persistence are guarded, so the app can be rendered in a browser. | `index.js`, `firebaseConfig.js` |

AI suggestions are still only added when the user taps one. Nothing is spoken, sent or replaced automatically.

## Verification (commands actually run)

- `CI=1 npx jest`: 21 suites, 156 tests, all passing. The baseline was 19 suites and 126 tests. New tests cover speech reliability, the pronunciation store, preset scaling, WCAG contrast and vocabulary search.
- `npx eslint . --ext .js,.jsx`: 0 errors and 14 warnings, the same as the baseline.
- `npx expo export --platform android`: the Hermes bundle builds.
- **Rendered UI.** The app was rendered with react-native-web in Chromium, using a temporary `--no-save` install and placeholder Firebase config:
  - Screen sizes: 320×640, 390×844 and 820×1180.
  - Themes: Light, Dark and High Contrast.
  - Layouts: large text, and the reduced board with bars hidden.
  - Screens: Find, Quick Phrases and Settings.
  - The grid's top edge was measured at the same y position when empty, with one word, with a multi-line sentence, after Clear, and on the Food page.
- **Speech end to end (web).** Calls to `speechSynthesis.speak` were intercepted:
  - Speed 0.5x is applied on the board.
  - The Calm preset gives 0.4x.
  - Pronunciation substitution happens in speech only.
  - With "speak each word" off, only the sentence is spoken.

## Not verified / remaining

- **Not tested on physical Android or iOS devices.** That covers TalkBack, VoiceOver, Android Switch Access, real TTS engines and the voice-fallback path on a device.
- **Hardware switch and keyboard keys are not bound globally.** The recommended library is `expo-key-event` (MIT, Expo SDK 52+, needs a dev build), wired to `handleScanKeyEvent`. It was not added because it can't be tested here. On-screen scan controls work, and OS Switch Access / Switch Control work with the labelled controls.
- ~~The app crashes at startup if the `EXPO_PUBLIC_FIREBASE_*` variables are missing from a build.~~ **Resolved in phase 2:** Firebase is now optional and missing or invalid configuration no longer crashes the app (see Phase 2 §1).
- **On small phones (320×640) the default board chrome leaves about 1.5 rows of grid visible.** The voice-style and scanning bars can be hidden in Settings → Board & Communication. The defaults were not changed, so existing users' button positions stay where they are.
- **The page bar now also shows on Home.** This moves the Home grid down once, by about 50px, so that it starts at the same place as every other page.
- **The bundled prediction model fails to load on web.** It was already non-blocking, and the board keeps working without it.
- **Symbol licensing.** ARASAAC is NonCommercial. If the app adds ads, in-app purchases or a paid tier, switch the offline symbols to Mulberry (CC BY-SA 4.0) or OpenMoji (CC BY-SA 4.0).
- **No backup export or import yet.** Open Board Format (OBF/OBZ) is the de-facto open format for boards and the recommended next step.

---

# Phase 2 — Reliability and release readiness (October 2026)

Evidence levels in this section:
- **[auto]** automated tests;
- **[browser]** the real app rendered by react-native-web in headless Chromium;
- **[native-build]** compiled with the Android SDK/Gradle in this environment;
- **[emulator]** Android emulator;
- **[device]** a physical device.

No [device] checks were possible here. See `docs/release/device-test-checklist.md`.

## 1. Startup without Firebase
- **Before.** With no `EXPO_PUBLIC_FIREBASE_*` variables the app showed a blank screen. The browser console showed a fatal error from `getDatabase()`.
- **Now.** `firebaseConfig.js` validates the config and initialises inside `try/catch`. It exports a nullable `db`/`auth` and `firebaseStatus`, and never throws. Consumers no longer call `getAuth()` or `getDatabase()`, both of which throw when no Firebase app exists.
- **Where the notice appears.** The "cloud unavailable" notice appears only on Login, Sign up, Profile and Online suggestions.
- **[browser]** A build with no Firebase variables behaves as follows:
  - the board renders;
  - word and sentence speech, voice styles and the pronunciation override work;
  - Profile shows the notice.
- **Settings data-loss race.** A cloud snapshot arriving before local settings loaded was saved over them. It is fixed: sync starts only after the local load, and updates wait for it.
- **Merge rules.** Null or partial cloud values never erase local ones. `speechVoice` and `compactLayout` are device-only and never synced.
- **[auto]** `firebaseConfig.test.js` covers missing, malformed, throwing and valid configuration. `settingsMerge.test.js` and `offlineStartup.test.js` cover the merge rules and the offline start.

## 2. Speech failure handling

Defects were found by reading the native `expo-speech` sources (Android `SpeechModule.kt`, iOS `SpeechModule.swift`) and the phase-1 code:

| Defect | Fix |
|---|---|
| Two rapid taps could both play, because `speak()` awaited before calling the engine | Each `speak()` claims a generation before any `await`. Stale generations never reach the engine |
| The "retry with default voice" path reacted to the error browsers fire on cancel, so speech could restart after Stop | Stale callbacks are ignored. A retry happens only before anything has been heard |
| Android with no TTS engine: `getVoices` never resolves, so with a saved voice `speak()` hung | Voice lookup times out after 1.5 s |
| iOS rejects an unknown voice without any error event | No start within 5 s with a custom voice → retry with the default voice |
| An error mid-queue let the later chunks keep playing | A final error cancels the queue |
| Speaking state could stay stuck | It clears on done, stopped, error, or a synchronous throw. A watchdog queries `isSpeakingAsync`. A late start restores the state |

- **[auto]** 21 speech-reliability tests. Nine of them fail against the phase-1 implementation.
- **[browser]**
  - 6 rapid word taps produced 6 single utterances.
  - 5 rapid taps on Speak produced 5 restarts with no overlap.
  - The no-voice notice appears in headless Chromium, which has no voices.

**When no usable offline voice is installed:**
- **Android.** If no engine initialises, nothing is spoken. After 5 s the board shows a notice, announced to assistive tech, saying no voice responded. The message stays on screen and Show on screen still works. Settings explains how to install a voice. If an engine exists but lacks data for the language, Android falls back to the device locale.
- **iOS.** Built-in voices are always present, so speech normally works offline. The documented exception is silent mode: expo-speech is silent while the ringer switch is off.
- **Stop.** Clear stops speech immediately, and Undo restores the sentence. Speak deliberately stays Speak: AAC users often tap it repeatedly to repeat, and a Speak/Stop toggle could get stuck.

## 3. Small screens: opt-in compact layout

**Investigation [browser], 320×640, defaults:**

| Element | Height |
|---|---|
| Header | 64px |
| Message | 64px |
| Two rows of actions | ~100px |
| Voice styles | 48px |
| Scan bar | 48px |
| Suggestions | 56px |
| Page row | 56px |
| Tab bar | 60px |

That left **2 full rows** of words, which confirms the report.

**Compact layout** is set in Settings › Board & Communication. It is off by default and never turned on automatically. Settings mentions it only on screens shorter than 700pt.
- One fixed row: Speak, Delete, Clear, Undo, Quick phrases, More.
- The More menu holds favourites, history, add favourite, show on screen, camera and voice style. Its items keep a fixed order and are disabled, never hidden.
- The header is hidden. The page row has icon buttons for Home, Back, Find, Scan and Settings.
- The message area is exactly one line.
- Scanning: Next and Select appear in a strip overlaid at the bottom.
- Scan mode and speed are also in Settings.

Results [browser], measured from the DOM:

| Viewport | Insets (top/bottom) | Text | Full rows | Grid top stable across empty / words / long sentence / clear / scanning | Controls < 44px |
|---|---|---|---|---|---|
| 320×640 standard | 0/0 | 1× | 2 | yes (395px, same as phase 1) | none |
| 320×640 compact | 0/0 | 1× | **5** | yes | none |
| 375×667 compact | 20/0 | 1.5× | 4 | yes | none |
| 390×844 compact | 47/34 | 1× | 7 | yes | none |
| 820×1180 standard | 24/20 | 1× | 9 | yes | none |

- **Grid shift fixed.** The suggestion row now has a fixed height. Previously it grew when a chip had a reason line, which moved the grid. The standard layout stays exactly 56px tall, so existing users' layout is unchanged.
- **Simulated insets.** These were produced by overriding the `env(safe-area-inset-*)` measurement in the test harness. They are not real device insets.

## 4. Accessibility checks (browser level only)
- **[browser]** Speak, Delete, Clear and Undo are each separate named `role=button` elements in both layouts. The sentence element contains no buttons.
- **[browser]** Keyboard Tab order follows the visual order:
  - standard: Speak → Delete → Clear → Favourites → History → Camera → Add favourite → Show on screen → Quick phrases → voice styles;
  - compact: Speak → Delete → Clear → Quick → More → Find → Scan → Settings → words.
  - Disabled controls are skipped by keyboard focus.
- **Not claimed:** TalkBack, VoiceOver, Android Switch Access and iOS Switch Control. These need device testing (checklist sections C and D).

## 5. Licensing
See `docs/legal/licensing-review.md`. Its key claims were re-checked against the primary sources.
- **Added:** a Credits & open-source licences screen. It covers the ARASAAC credit and terms link, a CHILDES/TalkBank citation, the icon fonts, and licence texts for the 96 packages in the shipped bundle.
- **Added:** a generator script and a guard test.
- **Not changed:** no symbol set was replaced.

## 6. Code review
An independent review of this phase found five issues, all fixed with regression tests (commit `bb3f59b`):
- the speech queue after a final error;
- the iOS silent voice failure;
- the late-start state;
- iOS modal-after-modal in the More menu;
- device-only settings syncing.

## 7. Native build [native-build]
- **Toolchain.** Android SDK (platform 36, build-tools 36, NDK 27.1, CMake 3.22) and Java 21 / Gradle 8.14 were installed in this environment.
- **Build steps.** `expo prebuild` and `./gradlew assembleRelease` were run in a separate copy of the repo. `android/` stays git-ignored (CNG).
- **Build result.** `app-release.apk` built successfully: 69 MB, arm64-v8a + x86_64, targetSdk 36.
  - It was built with **no `EXPO_PUBLIC_FIREBASE_*` variables**.
  - It is signed with the template debug key; it is not a store artefact.
- **Bundle contents.** The Hermes bundle in the APK contains this phase's code (string checks for the Firebase status, compact layout, licences screen and speech notice).
- **Environment note.** Maven Central rate-limited this container (HTTP 429). The build used Google's Maven Central mirror through a local Gradle init script; the repo is unchanged.
- **Release-readiness finding.** The merged release manifest requests `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE`, none of which `app.json` declares; they come from dependencies. `RECORD_AUDIO` is declared but unused.
  - Consider blocking them with `android.blockedPermissions` in `app.json`, after confirming nothing needs them.
  - Left unchanged here because it can affect development builds.
  - **Resolved in Phase 3.** The permissions were attributed from the Gradle merger
    reports and blocked; the release and debug APKs were checked separately (see Phase 3,
    Permissions).
- **Emulator [emulator]: not achieved.** The container has no `/dev/kvm` and no `vmx`/`svm` CPU flags; `emulator -accel-check` reports "KVM requires a CPU that supports vmx or svm".
  - An Android 34 x86_64 image started with `-accel off`, but after about 40 minutes adb still reported the device `offline` and boot never completed.
  - So no on-emulator run or speech check was possible. All runtime behaviour on Android is still unverified natively and is a device task.
- **iOS.** It cannot be built or simulated here: this environment is Linux, with no Xcode or macOS. Every iOS item is a device/simulator task in the checklist.

---

# Phase 3 — Native Android testing (02/10/2026)

Evidence levels follow Phase 2:
- **[emulator]** checks ran on a real Android system image, with real native code, the
  real TTS engine and the real permission dialogs;
- **[auto]** checks are Jest tests;
- **[device]** would mean a physical phone. **No [device] check was possible in this
  phase.** The S24 Ultra was never connected over USB: Windows saw it only over
  Bluetooth, and `adb devices` stayed empty for the whole session.

## Environment
- **Host and toolchain.** Windows 11 on an Intel Core Ultra 9 285K, with WHPX
  acceleration (`emulator -accel-check`: "WHPX(10.0.26200) is installed and usable").
  Temurin JDK 17.0.20.1, Android SDK platform 36, build-tools 36.0.0, NDK 27.1.12297006,
  Gradle 8.14.3, emulator 37.2.12.0. All were installed per-user from Google and Adoptium,
  with checksums verified.
- **Emulator A.** Android 15 (API 35), `google_apis_playstore` x86_64, Pixel 7 profile
  (1080×2400, 420 dpi, status bar 136 px). TTS: Google Speech Services
  `googletts.google-speech-apk_20240319.00`; it dispatched to `en-us-x-iog-lstm-embedded`.
- **Emulator B.** Android 11 (API 30), `google_apis` x86_64, Pixel 4 profile
  (1080×2280). TTS: Google Speech Services 22.10.313224691.
- **App under test.** The separate test app "Voice PR7 Test"
  (`com.elpabloawakens.aipoweredaacapp.prtest`). It was built from a clone with no `.env`,
  so it has no Firebase and no API keys. It is signed with a new local test key: SHA-256
  of the certificate `4d:a3:19:45:…:3f:1d`; the key lives outside the repo.
- **Builds.** Baseline = PR head `5179896`, APK SHA-256 `1a6453a8…71b0`. Fixed = the
  same commit plus this phase's changes (source files byte-identical to this commit),
  APK SHA-256 `73911ca0…09ee`.
- **Offline.** Every UI run happened in airplane mode.
- **Automation.** `scripts/native-ui/` (adb, UiAutomator dumps, `input`). Each check
  records PASS/FAIL with the measured value. Screenshots and permission dumps:
  `docs/audit/native-android-2026-10/`.

## How speech was measured
- **API call reached the engine:** Google TTS logs `Synthesis request` per utterance
  or chunk.
- **Engine produced audio:** an `AudioTrack` in the TTS process goes `state:started` in
  `dumpsys audio` and logs `N frames delivered`.
- **Not measured:** whether a person heard it, or how it sounded. That is listed for the
  device test below.

## Defects found natively, fixed, each with a regression test

| # | Reproduced [emulator] on the baseline | Fix | Test |
|---|---|---|---|
| D1 | Every camera **and** gallery photo ended in "Could not process this image". Logcat: `[Camera] base64 read failed: Cannot read property 'Base64' of undefined`. In expo-file-system 19 (SDK 54), `readAsStringAsync` and `EncodingType` are stubs on the main export | `src/services/imageFile.js` reads through `expo-file-system/legacy` | `imageFile.test.js`: the read, a failure, a timeout, and a guard that no app file uses legacy-only APIs from the main entry. The guard fails on the old `CameraScreen.js` |
| D2 | The grid kept the previous page's scroll offset. After scrolling Home and opening People, People's first row was at y=1379 instead of 1393, and Home stayed shifted after the round trip. Button positions depended on earlier scrolling | `useScrollToTopOnChange`: the grid returns to the top on every page change | `useScrollToTopOnChange.test.js` (4 tests) |
| D3 | Offline banner drawn under the Android 15 edge-to-edge status bar: banner 0–68 px, status bar 0–136 px, over the clock and icons. White on `#E8A070` measured 2.17:1 | The banner takes the status-bar inset and screens below receive top 0, so the offline layout shift stays the same as before. The children stay in one provider, so connectivity changes never remount navigation or lose the sentence. Colour `#9C4A12` gives 6.17:1 | `offlineBanner.test.js` (inset, online, no remount, contrast). All 4 fail on the old component |
| D4 | At system font scale 2.0 the suggestion chips' second line ("used often") was cut off by the fixed-height strip | The strip height is unchanged, so nothing moves. The reason line is dropped when it can't fit (it stays in the accessibility label), and the word's own scaling is capped to what fits. Default sizes are unchanged | `suggestionChipFit.test.js` (10 tests, including every text-size × font-scale combination fits) |

Verified after the fix [emulator, Android 15]:
- **D1:** camera capture and gallery pick both logged `has base64: true`. The offline
  build then showed "Could not describe this image — check your connection", the
  expected offline result.
- **D2:** Food page grid top y=1393, the same as empty, words, long sentence and cleared.
- **D3:** banner text at y=146–193, below the 136 px status bar. The grid top stayed at
  y=1393, the same as the baseline offline, so no button moved.
- **D4:** at font 2.0, 0 reason lines rendered and chips show whole words. At font 1.0,
  all 5 reason lines are still shown.

## Permissions (merged manifests and APKs, measured)

| Permission | Who adds it (Gradle merger report) | Release before → after | Debug before → after |
|---|---|---|---|
| `SYSTEM_ALERT_WINDOW` | Expo's prebuild template, in the main manifest **and** in `android/app/src/debug` + `src/debugOptimized`; also `react-android` (debug variant). Correction: earlier notes put it in React Native's debug manifest only | present → **removed** | present → **kept** (the template's debug manifest outranks the block, so dev overlays still work) |
| `READ_EXTERNAL_STORAGE` | Expo template (main manifest), `expo-file-system` 19.0.21, `expo-image-picker` 17.0.10 | present → **removed** | present → removed |
| `WRITE_EXTERNAL_STORAGE` | as above | present → **removed** | present → removed |
| `RECORD_AUDIO` | `app.json` `android.permissions`, the `expo-camera` plugin, and the `expo-camera` 17.0.10 library manifest | present → **removed** | present → removed |

- **What changed.** `app.json` now has:
  - `android.permissions: ["CAMERA"]`;
  - the `expo-camera` plugin with `recordAudioAndroid: false`;
  - `android.blockedPermissions` for the four permissions above.

  `CameraScreen.js` no longer calls `requestMediaLibraryPermissionsAsync()` on mount. The
  result was never used, and `launchImageLibraryAsync` checks no permission on Android in
  expo-image-picker 17.
- **Release APK now requests:** `CAMERA`, `INTERNET`, `VIBRATE`,
  `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, plus the package's own receiver permission.
- **Debug APK:** the same set plus `SYSTEM_ALERT_WINDOW`.
- **Before the fix [emulator, Android 11]:** opening Camera asked "Allow Voice PR7 Test
  to access photos and media on your device?".
- **After the fix, Android 11 and Android 15:**
  - no storage prompt;
  - camera prompt → deny → the in-app explanation "Camera permission needed";
  - grant from the system prompt → preview → capture → photo read;
  - gallery → photo returned and read. On Android 11 this went through the system
    document picker, selected with the keyboard, because that picker ignored injected
    taps.
- **iOS.** `NSMicrophoneUsageDescription` was left in `app.json`; it can't be tested here.

## Native results, fixed build [emulator]
All recorded checks below **passed** on Android 15 unless noted; per-check values are in
each run's `steps.log`.
- **A. Offline:**
  - offline start with no crash-buffer entries;
  - banner below the status bar.
- **Editing:**
  - build "I want help";
  - Delete → "I want";
  - Undo → "I want help";
  - a 15-word sentence;
  - Clear → empty;
  - Undo → the whole sentence restored.
  - Starters such as "I want" add two words, so Delete removes one word. That's by
    design (`handleButtonPress` splits `multiWord`).
- **Grid position:** first row at y=1393 for empty, one word, long sentence, cleared and
  another page.
- **F. History and favourites:**
  - the spoken sentence appears in history, and tapping it replaces the sentence;
  - the favourite is listed;
  - both survived a restart.
- **Upgrade in place** (baseline → fixed, same test key, `adb install -r`):
  - onboarding not shown again;
  - favourite, history, speech speed (1×, the last value set) and pronunciation all kept;
  - compact layout still off.
- **B. Settings and speech:**
  - B1: speed 0.5× selected.
  - B5: pronunciation "help" → "help me please" saved; the screen still shows "help";
    the engine received the request.
  - Restart: 0.75× and the pronunciation were kept, and the pronunciation still applies.
  - Engine audio for "help me please": 0.5× = 37,440 frames, 1× = 27,480 frames, a ratio
    of 1.36. This shows a longer utterance, not that it sounds noticeably slower.
- **B8:** 6 word taps in 86 ms → all 6 added, never more than 1 TTS player at once.
- **B9:** 5 rapid Speak taps → never 2 players at once, and no player stuck afterwards.
- **B7:** Clear while speaking → the engine's player had already stopped by the first
  sample (about 0.2 s after the tap) and stayed stopped for 1.8 s; Undo restored the
  message.
- **B6:** about 5,000 characters → 2 synthesis requests (chunked), about 334 s of
  continuous engine audio, no silent sample inside playback. Note that the
  pronunciation field holds at most 5,000 characters.
- **B10:** Google TTS disabled (emulator only) → "No speech voice responded…" appeared
  6.9 s after the tap, including UI polling time. The message stayed on screen, the app
  stayed responsive, and a tap passed through the notice (`pointerEvents="none"`, hides
  after 8 s).
- **E. Layout:**
  - standard layout: 3 full word rows above the tab bar;
  - compact: 7, with Settings reachable from the page row and the grid top stable at
    y=748 while typing and clearing;
  - font scale 2.0: no overlapping tappable controls.
  - Tab labels truncate with "…" at 2.0.
- **Camera (Android 15 and 11):** all the camera checks above.
- **Android 11:** board sections were not run (the shorter screen hides row 4 behind
  the tab bar); camera and permission checks were run there.

## Corrections to the test harness during this phase
These failures were in the test harness, not the app. Each was investigated, and the
run repeated or re-evaluated:
- taps on buttons hidden behind the tab bar;
- text typed while the on-screen keyboard covered the second field;
- a persistence check expecting a speed the run never set;
- a "small control" that was a chip clipped at the strip edge;
- `pm revoke` killing the app.

## Not verified natively (still needs the phone or a person)
- Anything on the S24 Ultra or any physical device: real One UI, Samsung TTS, gesture
  insets, real camera image quality.
- Audible speech: speed perception, pronunciation sound, voice choice, volume and the
  output route.
- TalkBack, VoiceOver, Android Switch Access and iOS Switch Control. UiAutomator labels
  were read, but **no screen reader or switch was used**.
- **Online behaviour of the test build.** It has no keys, and turning the network on
  would have sent requests to the production AI endpoints.
- **A system font size change while the app is running.** On Android 15 the layout
  stayed sized for the old scale until the app restarted; text was clipped until then.
  Fixed in Phase 4, below.
- iOS: no macOS here.

---

# Phase 4 — Live system font size change; reproducible build (03/10/2026)

All results in this phase are **[emulator]**: Android 15 / API 35 (Pixel 7 profile,
maximum system font scale 2.0) and Android 11 / API 30 (Pixel 4 profile, maximum 1.3).
**These are not S24 Ultra results.** No screen reader, switch or human listener was
involved.

## Defect D5: changing the system font size while Voice is open
**Reproduced on the Phase 3 build** (Android 15, sentence "I want help" on screen):
- **The sentence was erased.** It was lost both from 1.0 to 1.3 and from 2.0 to 1.0.
  Android relaunched the activity (Expo's `configChanges` lacks `fontScale`), and React
  Native re-ran the app, logging `Running "main"`.
- **Text was cut off until the app was restarted** ("Communi…", "Tap words to build a",
  "Sca", and "h…" on the suggestion chips). React Native lays text out with display
  metrics read at start-up, and Android then draws it at the new size.

**Approaches tried and measured before the fix:**

| Approach | Sentence | Layout after live change |
|---|---|---|
| `fontScale` in `configChanges` only | kept | still the old layout (identical bounds) |
| + React Native 0.81 `enableFontScaleChangesUpdatingLayout` flag | kept | still the old layout, with more text cut off. The flag is off in every React Native channel, can only be set with `dangerouslyForceOverride` (`override()` crashed at launch: "Feature flags cannot be overridden more than once"), and forcing a re-measure or a resize did not apply it. **Rejected.** |
| + refresh the display metrics and `ReactHost.reload()` | lost, unless restored | **identical to a fresh start** |

**Fix:**
- **Config plugin** `plugins/withFontScaleConfigChange.js`, applied from `app.json`:
  - it adds `fontScale` to the main activity's `configChanges`;
  - `MainActivity` records the font scale at start-up;
  - only on a real font-scale change, it calls
    `DisplayMetricsHolder.initDisplayMetrics(this)` and then
    `reactHost.reload("system font size changed")`.
- **Board draft** (`src/services/sentenceDraft.js`): the board keeps the sentence and the
  current page as a short-lived draft and restores them after the reload. A draft is
  restored only when the font scale differs from when it was saved and it is under 2
  minutes old, so an ordinary launch still starts empty.

**Verified [emulator]:**
- **Android 15.** A sentence was built, then the font scale changed live
  1.0 → 1.3 → 2.0 → 1.0 (`scripts/native-ui/fontscale-compare.js`):
  - the sentence was kept at every step;
  - the bounds matched a fresh start at the same scale for the header, sentence, Speak,
    Delete, the first suggestion chip, the "I want" and "like" grid buttons, Home and
    Find. The comparison script's own result was "all key bounds identical";
  - no crash;
  - one reload per change.
- **Android 11** (1.0 → 1.3 → 1.0): the same result.
- **State checks, Android 15** (`fontscale-state.js`):
  - "I want she" on the People page at 1.0 → 1.5: sentence and page restored, exactly
    one reload;
  - dark mode on: no reload, sentence kept;
  - an ordinary restart at the same font size starts with an empty sentence.
- **Automated tests:**
  - `sentenceDraft.test.js` (6): restore, same-scale start, stale draft, consumed once,
    corrupt input, storage failure;
  - `fontScalePlugin.test.js` (5): app.json applies it, `configChanges`, the generated
    activity code, idempotence, no feature-flag overrides.
- **Not verified:** the reload with TalkBack running (focus and announcements after a
  reload need a person); compact layout during a live change; Samsung's own font-size
  and font-style settings on the S24.

## Permissions from the committed configuration
- **Reproducible build.** A clean `git clone` of `1d84543` (no `.env`), then
  `npm ci --legacy-peer-deps`, `expo prebuild --clean`, the test identity, and
  `assembleRelease assembleDebug`.
- **Release APK requests:** `CAMERA`, `INTERNET`, `VIBRATE`, `ACCESS_NETWORK_STATE`,
  `ACCESS_WIFI_STATE`.
- **Debug APK:** the same plus `SYSTEM_ALERT_WINDOW`.
- **Both APKs:** `configChanges` `0x400007b0`, which includes `fontScale`.
- Files: `committed-release-apk-permissions.txt` and `committed-debug-apk-permissions.txt`.

**Development overlays still work in debug [emulator]:**
- **Setup.** The debug build was installed as a separate `….prtest.debug` app and loaded
  its JS from Metro (1,229 modules).
- **Prompt.** Expo's developer menu › Performance monitor opened Android's "Display over
  other apps" settings. Only **one** "Voice PR7 Test" was listed: the debug build. The
  release build declares no overlay permission, so it is absent.
- **Result.** After allowing it, React Native's performance monitor ("UI: 60.0 fps")
  appeared as an `APPLICATION_OVERLAY` window owned by the debug package.

## Checks on the committed tree (clean clone of `1d84543`)
- `npm run lint`: 0 errors, 15 warnings, the same set as before this PR's phases.
- `npx jest --no-coverage --forceExit`: **31 suites, 224 tests, all passing**.
- `npx expo config --type public`: OK.
- `npx expo export --platform android`: OK.
