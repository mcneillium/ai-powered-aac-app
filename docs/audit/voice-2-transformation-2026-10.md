# Voice 2 transformation — October 2026

Branch `voice2-transformation`, stacked on `ccr-b284f3d1-fhs62c` (draft PR #7, reliability work).
This file is the single running record for the transformation: state, decisions, evidence, gaps, next steps.

**Proposition:** "Voice helps me express myself more easily, learns my language with my permission, and keeps me in control."
No claim of clinical benefit, market leadership or improved language development is made anywhere in the app or docs.

## 1. Starting point (verified 2026-10-03, not assumed)
- PR #7 head `1d02930` was already pushed (the "unpushed" report was out of date); CI "Lint, Test & Build" green on it.
- `CI=1 npx jest` at `1d02930`: 31 suites, 224 tests passing (matches the checkpoint).
- The Windows path `C:\Users\McNei\…` and the emulators/APK under `C:\vb\out` are on the owner's PC. This work was done in a cloud container on a fresh clone; no Windows files were touched.

## 2. What was built

| Area | What | Where |
|---|---|---|
| Design system | "Paper & Ink" tokens (light/dark/high contrast, category colours, type, spacing, touch, motion) and components; AA enforced by tests | `src/design/*`, `docs/design/voice-2-design.md` |
| Modes | Explicit Child/Adult choice; per-mode presentation settings; shared data | `src/contexts/experience.js`, `SettingsContext.js`, `components/studio/ModeSheet.js` |
| Migration | Existing installs → Classic board until they opt in; new installs → new board; no setting changed or removed | `migrateExperience` |
| New board | Message stage, Speak↔Stop, Delete, Clear, Undo, tool row, fixed suggestion row, page row, grid; tablet two-pane; one-handed option | `src/screens/StudioBoardScreen.js` |
| Shared behaviour | Board logic extracted so Classic and new board behave identically | `src/screens/useBoardController.js` |
| Prediction | On-device n-gram + opt-in personal layer + small reranker; TF removed from the board path | `src/services/prediction/*`, `suggestionEngine.js`, `docs/ai/prediction-evaluation.md` |
| Help me explain | Repair phrases; rule-based rewordings, preview, confirm, Undo | `services/explain.js`, `components/studio/ExplainSheet.js` |
| Context panels | Explicitly chosen situation; phrases in a sheet; board never rearranged; University, Work, Appointments, Social added | `data/contextPacks.js`, `PhrasesSheet.js` |
| Personalise | Look per mode, layout, symbols download, custom tiles with device-only photo + preview, learning consent/reset, edit lock | `src/screens/StudioScreen.js` |
| Show my message | Large text, flip for partner, returns to same message, works without speech | `ShowMessage.js` |
| Modelling | Supporter demonstration; nothing saved to history or learned | `MoreSheet.js`, controller `modelling` |
| Symbols | ARASAAC ids mapped (reviewed by eye), images downloaded on device only on request | `symbolStore.js`, `data/symbolMap.json`, `scripts/build-symbol-map.js` |

## 3. Decisions and reasons
- **Design direction A (Paper & Ink)** over B (Soft Shapes, too juvenile for adults) and C (Night Signal, weak category salience). Child mode borrows B's warmth inside A's rules. See `docs/design/`.
- **Learning off by default, for everyone.** Previously usage learning was on by default. Now nothing is learned until "Learn from my messages" is on. Existing learned data is kept (not deleted) and can be deleted from Personalise or Settings.
- **Learn from spoken messages, not taps.** A tapped-then-deleted word is never a training example. Accepted suggestions and dismissals are recorded separately.
- **TensorFlow removed from the suggestion path.** Measured: the bundled LSTM threw on 86% of inputs (embedding covers 21 ids, tokenizer has ~5,000) and could suggest `.`, `?`, `xxx`. The new engine beats the old pipeline on every synthetic test (below). TF packages remain in `package.json` (still imported by an old unused loader and its tests); removing them is a follow-up.
- **Online suggestions default to off** for new installs (they send sentence text). Existing users' saved choice is kept. They also now require learning to be on.
- **Symbols downloaded, not bundled.** ARASAAC is CC BY-NC-SA and its API terms describe non-commercial use; keeping images out of the binary isolates the question to an optional feature. Wrong best-search matches overridden (tin can for "Can I", bus stop for "stop").
- **No haptics dependency** (`expo-haptics` would need a native rebuild and VIBRATE permission); press feedback is visual.
- **System fonts only** (no download, licence or startup cost).
- **Rule-based "Help me explain"** (no generative AI): deterministic, offline, cannot add meaning. A test caught and fixed a rule that turned "I need" into "I would like" (meaning change).

## 4. Evidence

### Automated [auto]
- `CI=1 npx jest`: 38 suites, 317 tests (see §7). New suites: design tokens (AA in all three schemes incl. every Child fill), experience/modes, settings upgrade (rendered provider), explain, suggestion engine bridge, prediction engine + store (agent-written, verified by rerun).
- `npx eslint . --ext .js,.jsx`: 0 errors.

### Prediction (synthetic data only — not evidence of real-world benefit)
`node scripts/eval/evaluate.js` (rerun independently; numbers reproduced):

| System | Top-1 | Top-3 | OOV | Selections saved |
|---|---|---|---|---|
| Existing pipeline, cold start (held-out seed) | 0.000 | 0.002 | 65% | 0% |
| New base n-gram, cold start | 0.380 | 0.515 | 7.3% | 16.0% |
| Existing pipeline, personas (adapted) | 0.348 | 0.543 | 19% | 34.4% |
| New base + personal + ranker, personas | 0.479 | 0.690 | 7.1% | 42.4% |

Latency p50/p95 0.08/0.18 ms (Node, desktop). Base model 33.8 KB. Personal store capped at 5,000 n-grams (~166 KB worst case). Reset returns exactly to base. Learning off stores nothing.

### Browser rendering [browser] (react-native-web, headless Chromium; not native)
Screens inspected: new board (Adult/Child × light/dark/high contrast), small phone 320×640, tablet 1024×768, Explain, Phrases, Saved, Mode, Welcome, Personalise, Find, Classic board (unchanged). Before/after images: `docs/design/screens/`.
Defects found by inspection and fixed: Phrases sheet rendered empty; "Phrases" label truncated; "Describe" label truncated; wrong pictograms; symbols not re-rendering after download.

### Performance [browser, indicative only]
Same harness, median of 7 runs, 390×844, Chromium; a Gradle build was running concurrently.

| | Before (`1d02930`) | After, Classic | After, new board |
|---|---|---|---|
| JS bundle (web) | 4.96 MB | 2.36 MB | 2.36 MB |
| Board ready | 653 ms | 557 ms | 639 ms |
| Tap → message updated | 16.0 ms | 15.2 ms | 17.5 ms |
| JS heap after load | 25.5 MB | 16.4 MB | 19.0 MB |

The bundle and heap drop come from TF no longer being bundled/loaded at startup. Native cold-start, frame timing and memory were not measured (no device/emulator here).

### Native [native-build]
See §6.

## 5. Not verified — needs devices or people
- **No emulator or device** in this environment (no KVM, no macOS). Nothing here proves TalkBack, VoiceOver, Switch Access, physical switches, real TTS engines or human usability. Checklist: `docs/release/device-test-checklist.md` §G (new) plus A–F.
- iOS: not built.
- Native file paths for symbol download and tile photos (`expo-file-system/legacy`) are exercised only by code review and web fallbacks.
- Human listening and accessibility evaluation; AAC-user and SLP feedback on both modes.

## 6. Native build and test APK [native-build]
- `expo prebuild --clean` + `./gradlew assembleRelease` (Android SDK 36, JDK 21) built from `a362ead` with no Firebase variables: **BUILD SUCCESSFUL**. The earlier commit `330925b` also built.
- Test identity applied with the repo's own `scripts/native-ui/make-test-identity.js` (`PRTEST_ID=prtestv2 PRTEST_NAME="Voice 2 Test"`), arm64 only. The signing key file stays outside the repository.
- `Voice-2-Test-a362ead.apk`: 31,191,787 bytes (29.75 MiB). SHA-256 `109ba1df7514f51ef838df039d737a12c055e5e90fb2a6b49702903e82fbd0a1`.
  - Package `com.elpabloawakens.aipoweredaacapp.prtestv2`, label "Voice 2 Test", targetSdk 36.
  - Signer certificate SHA-256 `63bc733c…42080f8`.
- **Contents (checked with aapt2 and unzip):**
  - The bundle contains the new board strings.
  - `word_prediction_tfjs` is no longer packaged.
  - Permissions: CAMERA, INTERNET, VIBRATE, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE. That is the same set as the PR #7 build: no storage or overlay permission.
- APK size: the PR #7 arm64 build `35914e5` was 31.7 MiB; this build is 29.75 MiB.
- **Not run:** native UI automation (`scripts/native-ui/suite.js`) needs the owner's emulators. This container has no KVM.

## 7. Final validation (on `a362ead`)
- `CI=1 npx jest`: **38 suites, 317 tests, all passing** (baseline 31 / 224).
- `npx eslint . --ext .js,.jsx`: 0 errors, 15 warnings. All 15 were already present before these changes.
- `npx expo export --platform android`: OK. The Hermes bundle is **4.08 MB, down from 7.29 MB** at `1d02930`.
- Release APK built and inspected (§6).
- **Browser:** the screens in §4 were re-rendered after the review fixes. Small-phone Speak truncation and large-text chip clipping were found this way and fixed.
- **Demo recording (browser):** `docs/design/screens/voice2-demo.webm`. It shows the Welcome sheet, Child mode, a suggestion, Speak→Stop, Help me explain, switching to Adult, Work phrases and Show.
- **Independent review:** 13 findings, all addressed in `a362ead`:
  - Speak turned into Stop on every word tap.
  - A mode profile could change the Classic board.
  - Online suggestions were silently gated.
  - Board choice on a new device for an existing account.
  - Learning race at startup.
  - Android ≤12 photo picker permission.
  - iOS photo paths.
  - TalkBack double speech.
  - Modelling wrote to history.
  - Cloud patches replaced whole per-mode nodes.
  - Emotion screen learned without opt-in.
  - The suggestion menu was not modal.
  - The tool row could not be reached by in-app scanning.

## 7b. Follow-up round (after PR #7 was merged)
PR #7 was merged into `master` (`0b18c0d`) at the owner's request. PR #8 was retargeted to `master`. It was **not merged**: the session's permission guard blocked merging without a review, so that decision stays with the owner.

| Commit | Change | Evidence |
|---|---|---|
| `acbb3b9` | TensorFlow removed from the app: loader, hook, `expo-gl`, `tfjs-react-native`. `@tensorflow/tfjs` is a dev dependency only, for the eval baseline. Credits now describe the real prediction source. Notices regenerated (82 packages, was 96) | Jest, lint, export; eval baseline still reproduces |
| `413298a` | New-design **Phrases** and **Me** tabs. Adds **Delete my words and messages**. `localData.js` lists every personal store, including learned prediction data and tile photos. Account deletion uses that list too. The delete-account warning wrongly said device data was kept and has been corrected | `localData.test.js` |
| `d2f3537` | Secondary screens (Settings, Find, Insights, Login, Camera…) take the Voice 2 palette on the new board; Classic keeps its colours | AA tests for every filled button in all three themes |
| `d765d9a` | **Type** tool: keyboard input with on-device word completion (prefix) | `typing.test.js`; browser render |
| `c57fb1f` | **Switch scanning inside every sheet** (`useOverlayScan`), Select/Next bar in sheets, Select on the board's auto-scan strip | `overlayScan.test.js`; browser render |

**Updated test APK** `Voice-2-Test-c57fb1f.apk`:
- 30,941,998 bytes. SHA-256 `1976e3c1f6d39a5471fbd2ed12e66fdd58e94d1522b6a863fc19f6e439368aa2`.
- Same package and test key as `a362ead`, so it installs over "Voice 2 Test" and keeps its test data.
- Same permissions. No `expo-gl` or TF assets.

**CI.** "Lint, Test & Build" passed on PR #8 at `3bd4b16` (run 37107844998). Earlier heads showed no check runs while the PR was being retargeted from the #7 branch to `master`.

## 7c. Integration with PR #9 and first native run (04/10/2026)
The owner chose this PR as the base, with the strongest parts of PR #9 (Soft Studio, branch
`voice-transformation`) ported in. PR #9 was then closed unmerged.

| Change | Why | Evidence |
|---|---|---|
| Words per row and text size are **shared by both modes**; tile height no longer depends on mode or picture style (`TILE_HEIGHT`); grid or text size left in a mode profile by earlier test builds is ignored | Child was 3 columns and Adult 4, so switching mode moved every word (measured natively: 9/9 visible tiles moved). A learned motor plan must survive a mode switch | `experience.test.js`; emulator: identical bounds for every tile in Adult and Child |
| **Built-in pictures** (system emoji, `src/data/symbols.js`) show offline when no ARASAAC symbol is downloaded; downloaded symbols still take priority | Pictures without a download or the ARASAAC non-commercial question; nothing bundled or licensed | `symbols.test.js`; emulator screenshots |
| **Learning carried over** for existing learners: someone with earlier on-device learning who never turned it off keeps "Learn from my messages" on, and their repeated phrases (used ≥2 times) seed the personal layer once, only into an empty store (`legacyImport.js`, `migrateLearning`) | Existing users' suggestions should not get worse on upgrade. New installs and anyone who opted out stay off | `learnedControl.test.js`; emulator upgrade below |
| **What Voice has learned** screen (Personalise › Learning): every learned word with *Forget* (removes it from counts, pairs, phrases and feedback, saved immediately even with learning paused), hidden suggestions with *Undo*, and delete-all | User control over each piece of what is learned | `learnedControl.test.js`; emulator screenshot |
| Native suite (`suite.js`, font-scale scripts) works on both boards ("Sentence"/"Message" labels, Saved sheet, settings below the fold) | Run the existing regression suite on the new board | Results below |

**Native results (Android 15 emulator, offline, real Google TTS):**
- **Upgrade from PR #7.** A PR #7 install with real use (3 messages spoken repeatedly, a
  favourite, speech 0.5×) was upgraded in place. It stayed on Classic with no welcome
  sheet, and the favourite, history and speed were kept. Learning stayed on, and after
  "I want" it suggested "more please" ("a sentence you have said before") and "more"
  ("you often say this next").
- **Regression suite on the upgraded Classic board:** 48/48 pass (board, history,
  settings, compact, fonts, speech, camera, persistence).
- **Regression suite on the new board:** 31/31 pass (board, history, settings, speech,
  persistence). Words per row was set to 4 for this run so the test words are visible
  without scrolling.
- **Live font-size scripts:** 13/13 pass on each board.
- **Fresh install:** welcome sheet, new board, learning off.
- **Not tested:** TalkBack, physical switches and a physical phone.

## 8. Known issues and next tasks (priority order)
1. Run checklist §H (Voice 2; formerly a second "§G") on the S24 Ultra and the Android 11 emulator; the Android 15 emulator runs are recorded in §7c. Have a person check TalkBack and switch access.
2. ~~Remove TensorFlow~~ (done in `acbb3b9`).
3. ~~Restyle remaining screens~~ (done by palette mapping; Phrases and Me rebuilt). Settings could still be reorganised into Personalise-style cards.
4. Owner decisions before release: ARASAAC non-commercial terms (symbols + API), tokenizer/model provenance (now unused by the board), "VOICE" icon artwork rights, native-only licence notices (`docs/legal/asset-inventory.md`).
5. Photo-assisted label suggestions (only a vocabulary-based category suggestion exists); per-profile learning when multiple profiles exist (store already supports `profileId`).
6. Evaluate prediction with consented real logs (none used); the synthetic personas were written by the same author as the seed corpus, so results are optimistic.
