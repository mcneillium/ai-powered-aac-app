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
8. Residual: tile height ignores system font size, so at 2x a two-line label plus picture can be clipped (needs a height budget; not reproduced here).
7. Residual: "bathroom" still wraps at 320 dp with 4 per row and largest text; suggest fewer per row.

### NOT TESTED in this run
- Emulator (no `/dev/kvm`), S24 / any physical device (no adb device), iOS.
- Human checks: TalkBack, switch scanning, real speech output, picture-symbol readability, checklist §H rows H1–H25.

### Next
Owner: install the test APK on the S24 and run checklist §H plus TalkBack/switch checks; decide the owner items above. Team: start a fresh session in a checkout of this branch to confirm the agents and `/voice-team` load.
