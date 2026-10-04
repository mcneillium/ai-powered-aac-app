# Voice agent team — run status

## Run 1 (2026-10-04)
**Goal (owner):** set up the agent team from PR #10, inspect the latest merged app, run automated checks, fix reproduced defects, produce an updated test APK, independent review before delivery. Draft PR only; no merge or release.

**Source:** `master` `1d92dcc` (merge of PR #8 incl. PR #9) + PR #10 branch `codex/voice-agent-team` `28bf33c`. Work branch `claude/voice-team-run` (stacked on PR #10).

### Setup findings
- **Static check:** six agent definitions parse. `name` matches the file name; each has a description; tools are `Read, Glob, Grep[, Edit, Write, Bash]`. Reviewer and privacy are read-only. `/voice-team` command file present (`$ARGUMENTS`).
- **Runtime discovery (this session): NOT loaded.**
  - `Agent(subagent_type: "voice-reviewer")` returned "Agent type 'voice-reviewer' not found".
  - `/voice-team` is not registered.
  - Cause: the session started before these files existed, outside a checkout containing them. Project agents are discovered at session start.
  - Following PLAYBOOK §Start fallback, the coordinator ran each role as a subagent briefed with the definition text verbatim. Reviewer/privacy run in a read-only agent type (no Edit/Write).
  - **Runtime discovery still needs a check in a fresh session started in a checkout of this branch.**
- **Hardware:**
  - `adb devices -l`: no devices.
  - `/dev/kvm`: absent (no emulator acceleration).
  - The S24 is not reachable from this cloud container.
  - Emulator and physical-device checks: **NOT TESTED** in this run.

### Baseline (unit/integration + bundle), on `28bf33c`
| Check | Command | Exit | Result |
|---|---|---|---|
| Lint | `npm run lint` | 0 | 0 errors, 15 warnings (pre-existing) |
| Jest | `CI=1 npx jest` | 0 | 42 suites, 358 tests |
| Android export | `npx expo export --platform android` | 0 | OK |

### Work allocation
| Role | Worktree | Owns |
|---|---|---|
| voice-engineer | `/home/user/vt-eng` | board/settings/storage behaviour; `eng-*` tests |
| voice-prediction | `/home/user/vt-pred` | `src/services/prediction/**`, `suggestionEngine.js`, eval; `pred-*` tests |
| voice-design | `/home/user/vt-design` | `src/design/**`, `src/components/studio/**`, styling; `design-*` tests |
| voice-native-qa | coordinator (serialised builds) | full gate, release APK |
| voice-reviewer, voice-privacy | read-only, after integration | — |

### Defects fixed (each reproduced by a test that fails on the unfixed code, unless noted)
| Commit | Role | Fix | Evidence level |
|---|---|---|---|
| `e2a5445` | prediction | Learning carried over from the old app was lost or over-counted (`legacyPhraseUses`); forget/undismiss while paused not saved; corrupt or other-version personal data overwritten without backup; reset before load finished was undone | unit (`pred-audit`, 11 tests) |
| `e2e1e22` | engineer | Settings could reset to defaults at startup (load race); board kept showing deleted history/favourites; second Clear lost Undo; deleted tile photos left on disk | unit/integration (`eng-*`) |
| `2d29475` | coordinator | "Delete what Voice has learned" cleared only one of two stores; "Delete my data" left `__corrupt` backups; unreadable settings treated as a new user | unit (`coord-dataControls`) |
| `4cc1926` | privacy → coordinator | In-memory profile could be flushed back during deletion; legacy learned keys not removed; consent/deletion copy overstated what was deleted | unit; copy is static |
| `30da7ea` | design | Tile labels broke inside words or were cut off; failed pictures left a gap; black pictures invisible in dark/high contrast; chips under 48 dp; outlines under 3:1 | unit (`design-tileFit`) + browser screenshots (`docs/design/screens/teamrun-*`) |
| `4c64e1a` | reviewer → coordinator | Tile fitting ignored the system font size (reviewer B1, blocking); label jumped after first layout (N1); "kept" copy shown with learning off | unit (2 tests fail on previous component) |

### Gate on final source (unit/integration + bundle)
| Check | Exit | Result |
|---|---|---|
| `npm run lint` | 0 | 0 errors, 15 warnings (pre-existing) |
| `CI=1 npx jest` | 0 | 48 suites, 405 tests |
| `npx expo export --platform android` | 0 | on `30da7ea`; the release bundle was rebuilt by Gradle for the APK below (BUILD_OK) |
| `node scripts/eval/evaluate.js` | 0 | synthetic only; metrics unchanged from committed `results.json` apart from latency (not committed) |

### Test APK (build only, not installed anywhere)
- Source: clean `git archive` of `ad3a35d` (no local changes); `expo prebuild --clean`; `assembleRelease`, arm64-v8a.
- Package `com.elpabloawakens.aipoweredaacapp.prtestv2`, label "Voice 2 Test", versionName 1.2.0, versionCode 2. Separate test identity, so it installs beside the store app. It updates an earlier "Voice 2 Test" signed with the same key.
- Signing: test key held outside Git. Certificate SHA-256 `63bc733cf7c902117b0936e5ac96387d70692e398a4a6892711856c1e42080f8` (`apksigner verify` passes).
- APK SHA-256 `9490f431f6a6a3d7a53dc67a28915cd94e7b9a3c9497c2b74f03f1ac3514411e`, 30,959,206 bytes.
- Firebase env vars unset at build time: cloud features off in this build.

### Reviews
- **Reviewer (static, read-only):** 1 blocking finding (B1 font scale), now fixed; non-blocking N1, N4–N7 fixed or covered by tests. Follow-up review of `4c64e1a`: APPROVE (static); grid width made authoritative and 2x cap documented in the next commit.
- **Privacy (static, read-only):** deletion race, legacy keys and copy fixed in `4cc1926`.

### Owner decisions needed (not changed by the team)
1. Android `allowBackup` (learned data and settings in Google backup).
2. Learning consent per device or per account.
3. Keep or delete `feedback/{uid}` when an account is deleted.
4. Signed-in delete re-syncing own words from the cloud.
5. After account deletion, `hasLaunched` keeps new-board users on Classic at relaunch.
6. ARASAAC (CC BY-NC-SA) and emoji pictures in store screenshots / commercial use.
7. Residual (run 2): long words ("Overwhelmed", "Appointments") and 13 labels at 5 per row on 320 dp still cannot fit even at 11 px; going smaller or limiting words per row is a product decision.

## Run 2 (2026-10-04)
**Goal (owner):** continue the agent-team workflow: report PR #11, verify the EAS Update diagnosis, complete unblocked implementation/review/testing, build a test APK of the latest changes, list human checks.

**Source:** `claude/voice-team-run` from `a59c5d3`; final app source `2fe281e`.

### Runtime discovery (fixed since run 1)
A fresh cloud session started on `a59c5d3` (Claude Code 2.1.289) listed all six `voice-*` agent types and registered `/voice-team`. A real `Agent(subagent_type: "voice-reviewer")` call ran with only Read/Glob/Grep, as defined. Run 2 workers were still briefed manually in this older session.

### EAS Update status (diagnosis, no change made)
- The status is posted by the Expo GitHub app (`expo[bot]`), not by a workflow in this repo. There is no `.eas/workflows`, no `expo-updates` dependency and no update channel in `eas.json`.
- It errors with "This Expo account doesn't have a member with a linked github.com user that has access to this repository" on every one of the last 8 `master` commits and on PR #10 and #11. The repo's own CI ("Lint, Test & Build") is green on all of them.
- There are no job logs because the job never starts.
- The fix is the account owner's (see the PR #11 comment). The check was not disabled.

### Defects fixed (reproduced first)
| Commit | Role | Fix | Evidence level |
|---|---|---|---|
| `a1d725f` | design | At system font size up to 2x, two-line labels plus picture overflowed and were clipped; "bathroom" broke mid-word at 320 dp / 4 per row | unit (`design2-tileHeight`: 38/198 fail on previous code) |
| `618b941` | engineer | Tile photos saved by the first Voice 2 build (absolute paths) were lost after an iOS update/restore, and replacing one deleted the wrong path | unit (`eng2-tilePhotoUpgrade`: 2 fail on previous code) |
| `618b941` | coordinator | "Open camera" left an unhandled rejection when the permission request failed; long Show-screen messages could be cut off on Android | unit (`coord2-cameraShow`: 2 fail on previous code) |
| `4aa0f30` | privacy → coordinator | A stored `tiles/..` value could resolve to the documents folder (hardening) | unit (1 fails on previous code) |
| `2fe281e` | reviewer → coordinator | Persistent scroll bar on the Show screen | static |

New coverage without a defect: upgrade fixtures for oldest settings/history/favourites/words shapes, photo permission denial/cancel/throw, 12,000-character speech, long DisplayMode text.

### Gate on `2fe281e`
| Check | Exit | Result |
|---|---|---|
| `CI=1 npx jest` | 0 | 54 suites, 618 tests |
| `npm run lint` | 0 | 0 errors, 15 warnings (pre-existing) |
| `npx expo export --platform android` | 0 | on `618b941` (later commits: hardening and one prop) |
| Release build | 0 | BUILD SUCCESSFUL (Gradle) |

### Reviews (static, read-only)
- **voice-reviewer:** APPROVE. Not changed:
  - Wide labels may draw 1.5–4 px over the Adult category stripe when focused. An edge-safe padding would make "bathroom" break again at 320 dp, so this needs a device check.
  - Very long words can still break.
  - Switch-scan users cannot scroll a long Show message.
- **voice-privacy:** OK. Hardening applied in `4aa0f30`. Fixtures are artificial; no secrets.

### Test APK (built, not installed anywhere)
- Source: clean `git archive` of `2fe281e`; `expo prebuild --clean`; `assembleRelease`, arm64-v8a; Firebase env unset (cloud features off).
- Package `com.elpabloawakens.aipoweredaacapp.prtestv2`, "Voice 2 Test", versionName 1.2.0, versionCode 2.
- Certificate SHA-256 `63bc733cf7c902117b0936e5ac96387d70692e398a4a6892711856c1e42080f8`, same test key as run 1, so it updates in place.
- APK SHA-256 `8d7506a69839542a2f5449b3a26db5b9f837173eae8ee782d3b62c0c29d9c7da`, 30,960,850 bytes.
- Local copy: `native-ui-evidence/Voice2Test-2fe281e.apk` (ignored by Git).

### NOT TESTED (runs 1 and 2)
- Emulator (no `/dev/kvm`), S24 and any physical device (no adb device), iOS.
- Human and device checks: checklist §H (H1–H25), TalkBack, switch scanning, real speech, picture readability, real permission dialogs, airplane-mode start, Android font size at maximum, long Show message flipped, iOS photo after update.

### Next
Owner: link a GitHub user in Expo (or turn off that integration); install the APK and run the device checks above; decide the owner items.

## Run 3 (2026-10-04): validation
**Goal (owner):** validate PR #11 on its exact head; make CI run for the stacked PR; investigate emulators; native automation; fix text over the category stripe; owner-decision table. No merge, retarget or release.

### Results per commit (local, clean tree; CI = GitHub Actions "Lint, Test & Build")
| Commit | Lint | Jest | Android export | GitHub CI |
|---|---|---|---|---|
| `ffcb0d5` | exit 0 (0 errors, 15 warnings) | exit 0, 618 tests | exit 0 | success (first run on this PR) |
| `b43b8a9` | not run separately | 817 tests (before commit) | not run | success |
| `23d9940` | exit 0 | exit 0, 820 tests | exit 0 | success |
| `f74dd96` (final app source) | exit 0 (0 errors, 15 warnings) | exit 0, 56 suites / 820 tests | exit 0 | success |

### CI for the stacked PR
- `ci.yml` `pull_request.branches` now includes `codex/**` and `claude/**` as well as main/master. The PR base stays `codex/voice-agent-team`.
- PR #10's own CI on `28bf33c` was already green.

### Emulators (environment limitation)
- The emulators used before (API 35 and 30, WHPX) are on the owner's Windows PC (`docs/audit/aac-usability-improvements-2026-10.md`, Phase 3).
- This cloud container has an AVD (`aac34`, x86_64) and emulator 37.2.12, but no `/dev/kvm`. The CPU exposes no vmx/svm, and `emulator -accel-check` reports "KVM requires a CPU that supports vmx or svm".
- An earlier unaccelerated boot here never completed (about 40 minutes, adb offline), so it was not retried.
- No adb device is attached; the S24 cannot connect to a cloud container.
- **Native automation was not run in this run.**

### Fixes (reproduced first)
| Commit | Fix | Evidence |
|---|---|---|
| `ffcb0d5` | Native suite: two checks filtered on `endsWith('prtest')`, which matched nothing for `.prtestv2`, so the touch-target check passed vacuously. It now uses the driven package and fails when no app controls are found | static; `node --check`, eslint |
| `b43b8a9` | Text no longer drawn over the category stripe (up to 5 px before). Minimum is now 12 px (was 11). Words too wide wrap with a visible hyphen (bath-room); up to 3 lines when height allows. Grid, words per row and positions are unchanged | unit (`design3-stripe` fails 167/199 on previous code); computed-layout drawings, not app screenshots |
| `23d9940` | Android ignores `minimumFontScale`, so platform shrink-to-fit could go towards 4 px. It is now iOS only. Fit is memoised; hyphenation check made robust | unit (`design3-review` fails 2/3 on previous code) |

### Reviews (static, read-only)
- Reviewer on `b43b8a9`: CHANGES NEEDED (Android shrink floor), fixed in `23d9940`.
- Re-check of `23d9940`: APPROVE.
- Pre-existing items not changed (follow-up): ActionButton (`minimumFontScale 0.8`) and Classic board tile labels (`AACBoardScreen.js:135`, no floor) can shrink below readable sizes on Android.

### Test APK (built, not installed)
- Source: clean `git archive` of `f74dd96`; `expo prebuild --clean`; `assembleRelease`; ABIs **arm64-v8a + x86_64** (phone and emulators); Firebase env unset.
- Package `com.elpabloawakens.aipoweredaacapp.prtestv2`, "Voice 2 Test", 1.2.0 (versionCode 2).
- Certificate SHA-256 `63bc733cf7c902117b0936e5ac96387d70692e398a4a6892711856c1e42080f8`.
- APK SHA-256 `685b50b8c82026326e70f1ff95b9622543a65c1645716657ef84303adb21dc7d`, 38,535,051 bytes.
- Local copy: `native-ui-evidence/Voice2Test-f74dd96.apk` (ignored by Git).
- Phone-only build, same source and key, arm64-v8a: APK SHA-256 `8ba821ebd93b695d87ff755557f246c08c4267b705edcbc7e4a64298969ef1fb`, 30,964,690 bytes (`native-ui-evidence/Voice2Test-f74dd96-arm64.apk`). The dual-ABI file is over the 30 MiB chat upload limit.

### Owner decisions
**Release blockers**
| Decision | Current behaviour | Recommended | Consequence |
|---|---|---|---|
| Account deletion and `feedback/{uid}` | Deletes users, settings, logs, sync, words and requests, but not `feedback/{uid}` (may hold name and email). Says "all associated data permanently deleted" even if a cloud removal failed | Also remove `feedback/{uid}` (rules already allow it). Only report success when every removal succeeded | Feedback history for deleted users is lost. The deletion claim becomes true |
| ARASAAC licence | Pictograms fetched at runtime; CC BY-NC-SA; API "only for non-commercial applications" | Get written confirmation from ARASAAC before any store release; keep the credit | Without confirmation, ship without ARASAAC (built-in pictures only) |
| Learning consent scope | `personalLearning` syncs with account settings, but learned data stays on each device. Turning it on on one phone turns it on on another signed-in phone without its consent screen | Per device: add it to `LOCAL_ONLY_KEYS` | One opt-in per device; a one-line change plus a test |
| Android backup | `android:allowBackup="true"` (Expo default). Settings, history, own words and learned data go to Google Auto Backup | Keep it on (losing vocabulary on a phone change is severe), and disclose it in the privacy policy and Play Data safety | Disclosure needed. Turning it off means guests lose everything on a new phone |

**Optional improvements**
| Decision | Current behaviour | Recommended | Consequence |
|---|---|---|---|
| Signed-in "Delete my data" | Removes local data; own words sync back from the account (copy says so) | Keep; later add "also delete from my account" | None now |
| Relaunch after account deletion | `hasLaunched` kept, so the user is treated as existing and gets the Classic board | Clear `hasLaunched` on account deletion | The welcome screen shows again |
| Emoji in store screenshots | Built-in pictures are OS vendor emoji | Use text-only or licensed pictures in store assets | Avoids a vendor artwork question |
| Very long words, 5 per row, 320 dp | "Overwhelmed" and "Appointments" render as 4 hyphenated lines at 12 px | Keep; the words-per-row setting is the remedy | Poor breaks in that one case |
| EAS Update status | Expo GitHub app job never starts (account not linked); app has no `expo-updates` | Disconnect it, or link a GitHub user in Expo | Removes a red status unrelated to code |
| Android shrink in ActionButton and Classic tiles | Can go below readable sizes on Android (pre-existing) | Fix in a follow-up PR with a device check | — |

### NOT TESTED
- Emulator, S24 and iOS.
- Native suite.
- Device-level text rendering of hyphenated labels.
- TalkBack, switch scanning, real speech, permission dialogs, airplane mode, checklist §H.

### After owner merge of PR #12 (head `cdf9cd9`, 2026-10-04)
- **Change:** the owner merged master (PR #12: database/storage rules, log whitelist, axios 1.19.0) into `codex/voice-agent-team` and then into this branch. There were no conflicts. The `feedback/{uid}` rules are unchanged, so the owner-decision table still stands.
- **Fresh `npm ci` from a clean archive of `cdf9cd9`** (axios 1.19.0):
  - lint exit 0 (0 errors, 15 warnings);
  - jest exit 0, 56 suites / 824 tests;
  - Android export exit 0;
  - GitHub CI "Lint, Test & Build": success.
- **APKs** from the same archive, same test key (cert `63bc733c…e42080f8`), package `…prtestv2`, 1.2.0 (2):
  - arm64-v8a: SHA-256 `66d7102e5a2b4cc7b5f8048339a70e3fddea2159aee8379da79959841dce62af`, 30,964,674 bytes (`native-ui-evidence/Voice2Test-cdf9cd9-arm64.apk`).
  - arm64-v8a + x86_64: SHA-256 `f6b0f306f65f44dc0dc75a845e961716216f1b4766b2c84cc405a77c210d42e3`, 38,535,035 bytes (`native-ui-evidence/Voice2Test-cdf9cd9.apk`).
  - These supersede the `f74dd96` APKs.

## 2026-10-04 — visual communication expansion

Branch `codex/voice-visual-communication`, based on PR #11 head `ae665d696911efc9e97f21adbf6bd28ac5473276`. Initial worktree clean. PR #11 remains the stack base; this work does not merge or release earlier PRs.

Implemented picture-supported Studio messages/predictions/phrases/saved choices, offline related-word finder, honest local-learning diagnostics with isolated synthetic demo, photo scenes/repair/scales/drawing, parked message workspace and optional English forms, portable vocabulary/scene JSON and PDFs. Details and limits: `docs/features/visual-communication.md`. Device checks added as section I. Existing board positions, optional learning and explicit speech control retained.

Independent code/privacy review found and resolved: receiver export-file lifetime, delayed import/deletion races, mounted-screen stale scene/preview resurrection, unsafe picker-directory cleanup, scene edit-lock/in-app scanning, native-stack unsaved exit, and return navigation duplicating the App tree. Final static reviewer found no remaining blockers; this is not native/accessibility certification.

Validation (cloud source checkout, no physical/emulator claim):
- `npx jest --runInBand --no-coverage`: 66 suites, 879 tests pass. Added tests use synthetic data only.
- `npm run lint`: exit 0, no errors, existing 15 warnings.
- `npx expo config --type public`: exit 0.
- `npx expo export --platform android`: exit 0.
- Dependency notices regenerated for SDK-matched expo-sharing, expo-document-picker and expo-print; notices gate passes.
- `git diff --check`: pass.
- Independent static/code/privacy review: no remaining blocking findings.

No live Firebase changes, merges, releases, phone installs or CI subscriptions. Java exists but Android SDK/adb/Gradle are unavailable here, so no APK was built or tested and no copy to the Windows OneDrive folder can be claimed. New native modules require a new APK, not merely a JS update. Keep the existing test signing identity when available; save extracted builds/checksums/notes to `C:\Users\McNei\OneDrive\AAC\Builds\YYYY-MM-DD_<commit>\` and only update `Latest` after verification.

Remaining gates: section I native checks, Samsung large-font/speech/back navigation, TalkBack and switch usability, native file sharing/PDF/photo picker, iOS testing, and user/partner evaluation of picture comprehension and communication benefit. Synthetic adaptation is not a market or clinical benchmark. Vocabulary export is Voice-specific, not OBF/full account backup. No general multilingual model, eye-gaze or voice-cloning feature is claimed.

## 2026-10-04 — release preparation (PR #15 stack)

Branch `codex/voice-release-readiness` starts at published PR #15 commit
`8a04b4c8181883970b629b1935e96281fe5a8284`. PR #15's Actions run passed.

Concrete fixes: device-only learning/online consent; no anonymous guest identity
on startup; authenticated explicitly requested AI calls only; photo upload
confirmation and no automatic generated speech; ARASAAC searches only after an
informed request, with offline words retained. Initial Auth observations no
longer invalidate local settings loading. Workspace scanning reaches its input
and scrolls focused controls into view.

Account deletion pauses writers, drains earlier operations and removes all
seven app database roots before Auth. Failures retain an authenticated retry
and report partial removal. Settings, diagnostics, vocabulary, feedback,
history/favourites/pronunciations, learned profiles, photos, scene/draft/export
operations are guarded against stale or fresh writes during deletion. Tests
use synthetic fixtures with Firebase/FS/network mocked; they are not live
cloud-deletion evidence.

A clean Expo prebuild revealed release builds defaulted to the public debug
key despite historical signing documentation. A config plugin now guards the
actual release task graph; the signing guide describes current wiring instead
of unsupported `RELEASE_STORE_*` properties. Native verification is in progress.

Current gates: `docs/release/current-release-gates.md`; Data Safety draft updated
against actual off-device flows. Configured privacy URL returned HTTP 404.
Public pages, age groups/parental policy, symbol/artwork rights, provider/rules
operations, production signing, store configuration and physical/human checks
remain release gates. No production deployment, merge, submission or phone
installation has occurred. Windows OneDrive is inaccessible from this cloud
checkout; do not claim an APK copy or successful sync there.

Integrated source checks after the release fixes: full Jest 77 suites / 945
passing tests, lint exit 0 (15 existing warnings), Expo public config and
Android export exit 0; diff check passes. Independent read-only review verified
consent, startup and deletion fixes; additional sharing caller regressions
passed with 25 targeted tests. Final native build results will be recorded
separately with their exact source SHA. SDK 36/NDK and checksum-verified JDK 17
are installed here; no connected adb device or KVM-backed emulator is available.

Native runner evidence: commit `859acd25879889e13bd1f9f50cc6b7fd07cc332a`
assembled successfully in Actions run `37223574218`, but artifact verification
refused unexpected `ACCESS_WIFI_STATE`. NetInfo's source guards Wi-Fi detail
reads when that permission is absent; Voice's NetworkContext uses only
`isConnected`/`isInternetReachable`. The unnecessary Wi-Fi-state permission is
now blocked in Expo config. Rebuild/actual manifest verification remains
required; the refused APK was not delivered. A native negative signing-guard
check was added to the runner. No device checks or production actions occurred.
