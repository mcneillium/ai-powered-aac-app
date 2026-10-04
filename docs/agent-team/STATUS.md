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
