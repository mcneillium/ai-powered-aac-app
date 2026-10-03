# Native Android UI tests (adb + UiAutomator)

Drives the separate **"Voice PR7 Test"** app (`com.elpabloawakens.aipoweredaacapp.prtest`)
on an emulator or phone through `adb`, `uiautomator dump` and `input`. Nothing is
installed on the device. The driver refuses any package that does not end in `.prtest`,
so it can never touch the real Voice app or its data.

Results are recorded per check as PASS/FAIL with the measured value, plus screenshots,
UI dumps and logcat, in `native-ui-evidence/<RUN>/` (git-ignored; set `EVIDENCE_DIR`
to change it).

## Build the test app
```powershell
npx expo prebuild --platform android --no-install --clean
node scripts/native-ui/make-test-identity.js "arm64-v8a,x86_64"
cd android
.\gradlew.bat assembleRelease
```
`make-test-identity.js` changes only the generated `android/` folder: the application ID
becomes `...prtest`, the name becomes "Voice PR7 Test", and release builds are signed
with a local test key. It reads `%LOCALAPPDATA%\VoiceTest\prtest.keystore` and
`prtest.properties`, which are kept outside the repo. Build without the
`EXPO_PUBLIC_FIREBASE_*` variables (for example from a clone with no `.env`), so the test
app cannot reach production cloud data.

## Run
```powershell
$env:SERIAL = "emulator-5554"   # or the phone's serial from `adb devices`
$env:RUN = "my-run"
node scripts/native-ui/suite.js board,history,settings,compact,fonts,speech,camera,persist
```
Sections: `board`, `history`, `settings`, `compact`, `fonts`, `speech`, `camera`,
`longtext` (about 6 minutes of speech), `ttserror` and `persist`.

- `ttserror` disables the Google TTS engine and then re-enables it. It runs only when
  `ALLOW_TTS_DISABLE=1` is set. **Use it only on an emulator, never on a personal phone.**
- `camera` revokes the test app's camera permission so that the prompt is shown again.
  Android kills the app process when a permission is revoked, so the suite relaunches it.
- `fonts` sets `font_scale` to 2.0 and restores the previous value afterwards.
- The suite turns no network on or off. For the offline checks, enable airplane mode
  first: `adb shell cmd connectivity airplane-mode enable`.

### System font size changed while the app is open
- `node scripts/native-ui/fontscale-compare.js 1.3,2.0,1.0` builds a sentence, then
  changes `font_scale` live. It checks that the sentence is kept, and that the bounds of
  the header, sentence, Speak, Delete, the first suggestion chip, grid buttons and page
  row match a fresh start at the same scale.
- `node scripts/native-ui/fontscale-state.js` checks that:
  - the sentence and current page survive a font change;
  - there is exactly one reload per change;
  - dark mode does not reload;
  - an ordinary restart starts empty.

Both scripts change system settings on the device and restore `font_scale` to 1.0.

## What the speech checks can and cannot show
- **API call reached the engine:** Google TTS logs `Synthesis request` once per
  utterance or chunk.
- **Engine produced audio:** an `AudioTrack` in the TTS process reaches `state:started`
  in `dumpsys audio`, and logs `stop(...): called with N frames delivered`.
- **Not shown:** that a person heard it, or how it sounded. Volume, the output route and
  intelligibility need a human listener. Likewise, nothing here verifies TalkBack,
  VoiceOver or switch access.
