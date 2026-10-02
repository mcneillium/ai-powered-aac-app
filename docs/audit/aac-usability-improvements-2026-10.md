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
- **The app crashes at startup if the `EXPO_PUBLIC_FIREBASE_*` variables are missing from a build,** and that includes the offline board. EAS builds must always set them. Making Firebase fully optional would touch about 14 modules.
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
- **Emulator [emulator]: not achieved.** The container has no `/dev/kvm` and no `vmx`/`svm` CPU flags; `emulator -accel-check` reports "KVM requires a CPU that supports vmx or svm".
  - An Android 34 x86_64 image started with `-accel off`, but after about 40 minutes adb still reported the device `offline` and boot never completed.
  - So no on-emulator run or speech check was possible. All runtime behaviour on Android is still unverified natively and is a device task.
- **iOS.** It cannot be built or simulated here: this environment is Linux, with no Xcode or macOS. Every iOS item is a device/simulator task in the checklist.
