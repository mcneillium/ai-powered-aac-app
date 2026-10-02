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
