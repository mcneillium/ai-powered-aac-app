# Decision ledger — overnight run 2026-08-08

Append-only. Every non-trivial choice, with the reasoning and the alternatives
rejected. Format per OVERNIGHT-RUN.md §0.6.

---

### D-001 — [Phase 0] Preserved both dirty working trees on a WIP branch before branching
- **Decision:** Committed the uncommitted state of both repos onto
  `overnight/2026-08-08/pre-existing-wip` (app `7415345`, dashboard `a7bec76`),
  then created `overnight/2026-08-08/improvements` from that commit in each, so
  the pre-existing work carries forward rather than being stranded.
- **Why:** §0.A.1 requires nothing of Paul's is lost. The app tree had a
  `functions/package-lock.json` edit and two untracked docs; the dashboard had a
  modified hosting cache. All trivial, but "trivial" is a judgement I do not get
  to make about someone else's uncommitted work at 22:34 with nobody to ask.
- **Alternatives rejected:** (a) `git stash` — invisible, easy to lose, and does
  not survive a branch mistake. (b) Branch `improvements` from `master` and leave
  the WIP only on the side branch — safe for the WIP but silently drops the
  `path-to-regexp` lockfile reconciliation from everything built tonight.
- **Blast radius:** Repository state only. `master`/`main` untouched in both.
- **Reversible:** Yes. `git reset --hard 7079c09` (app) / `18967d3` (dashboard).
- **Confidence:** High.

### D-002 — [Phase 0] Created the `commai-aac` skill rather than referencing a skill that does not exist
- **Decision:** `.claude/skills/` did not exist in either repo, so the
  `skills: [commai-aac]` preload that §0.C requires of every agent had nothing to
  resolve to. Wrote `.claude/skills/commai-aac/SKILL.md` — the two repos, the
  three-tier pipeline, the shared data contract, the AAC non-negotiables, and the
  build gotchas — and kept the frontmatter reference as specified.
- **Why:** §0.C says to verify the name and note the correction. The correction
  here is that the skill was missing entirely. Writing it is strictly better than
  dropping the preload: it is the mechanism by which §9's "leave the fleet
  smarter than you found it" actually works.
- **Alternatives rejected:** (a) Omit `skills:` from every agent — loses the
  shared context that stops eleven agents each rediscovering the same facts.
  (b) Point at a different existing skill — none exists.
- **Blast radius:** Isolated. New files under `.claude/`; no runtime code.
- **Reversible:** Yes, delete the directory.
- **Confidence:** High.

### D-003 — [Phase 1] Root-caused the versionCode 19 Metro failure to a missing module, not environment drift
- **Decision:** Recorded the release blocker as **already fixed at HEAD** by
  commit `194a416`, with the root cause being unresolvable relative imports in
  the production module graph — specifically `src/screens/LoginScreen.js`
  importing `../utils/logger`, a file that never existed on that branch (the real
  module is `../utils/enhancedLogger`). `src/hooks/useOnDevicePrediction.js`
  carried a second instance, importing `../../assets/tf_model/model.json` and
  `…/group1-shard1of1.bin` when the real paths are under
  `assets/tf_model/word_prediction_tfjs/`.
- **Why:** Evidence, in order of strength. (1) A worktree at `b8e817f` — the last
  commit before the August work, i.e. the tree versionCode 19 was built from —
  fails a production Metro bundle in 7.5s with
  `Unable to resolve module ../utils/logger from …\src\screens\LoginScreen.js`.
  (2) That bundle ran against the **current, healthy, reconciled** `node_modules`
  via a filesystem junction, which is what disproves the previous session's
  drift hypothesis: the drift is gone and the April tree still fails. (3)
  `App.js:37` imports `LoginScreen`, so it is in the production graph — not dead
  code Metro could skip. (4) HEAD bundles clean at 7.15 MB. (5) The config diff
  across the same range is empty, so Babel/Metro/Expo config cannot be
  implicated. (6) `npm ci --dry-run` is clean, so a failed container install
  cannot be implicated.
- **Alternatives rejected:** (a) The previous session's `node_modules`
  reconciliation hypothesis — actively disproven, see (2); leaving it standing
  would send the next investigator down a dead end. (b) Case sensitivity — the
  sweep is clean at HEAD and the April failure is a missing file, not a mis-cased
  one. (c) Lockfile/transitive drift — no config change, lockfile in sync.
  (d) `git bisect` — unnecessary once a 7-second static check localises it.
- **Blast radius:** None. No code change; the fix already shipped in `194a416`.
  What changes is the *documentation* and the addition of a permanent gate.
- **Reversible:** N/A (analysis).
- **Confidence:** High for the root cause of the April tree's failure. **Medium**
  for "this is precisely what versionCode 19 hit" — no one captured the original
  EAS error text, so the identification rests on the tree being the same one and
  the failure being deterministic and at the right stage. Nothing else in that
  tree can fail a Metro bundle before this does.

### D-004 — [Phase 0] Accepted that the safety hook is inert this session and compensated manually
- **Decision:** Wrote `.claude/hooks/guard.mjs`, registered it as a `PreToolUse`
  hook for `Bash` in `.claude/settings.json`, unit-tested all ten rules against
  fifteen commands (every block and every allow correct) — then confirmed by live
  test that it does **not** intercept commands in the already-running session.
  Recorded in `RISKS.md`; proceeding with the guardrails enforced by discipline
  rather than by machine for the rest of tonight.
- **Why:** Claude Code captures hook configuration at session start, so a hook
  registered mid-session cannot take effect until restart. §0.D anticipates this
  exact outcome and says to log it loudly and proceed with heightened care rather
  than abort. Restarting the session to activate it would cost the entire run.
- **Alternatives rejected:** (a) Claim the hook is protecting the run — false,
  and a false safety claim is worse than a documented absence of one. (b) Abandon
  the hook — it is still the right artefact; it protects every future session
  including Paul's own.
- **Blast radius:** Isolated (new files under `.claude/`). It will start
  enforcing on Paul's next Claude Code start, which he should know about; noted
  in `HANDOVER.md`.
- **Reversible:** Yes — delete `.claude/settings.json` and `.claude/hooks/`.
- **Confidence:** High.

### D-005 — [Phase 0] Gated the pre-existing failures on "not worse", and pinned `CI=1` for expo-doctor
- **Decision:** `scripts/gates.mjs` compares lint warnings, test count,
  expo-doctor failures and `npm ls` invalid resolutions against
  `scripts/gates.baseline.json` rather than against zero. Bundle success and
  import-case cleanliness are absolute. Bundle *size* is reported, never enforced.
- **Why:** §0.8 asks for exactly this for lint. Extending it to the dependency
  tree is the same argument: `.npmrc` sets `legacy-peer-deps=true` and
  `@tensorflow/tfjs-react-native` declares peers it cannot satisfy on Expo 54, so
  four invalid resolutions are the *correct* steady state and gating on zero
  would mean gating on a TF.js major bump that §0.2 forbids. Bundle size is left
  unenforced deliberately: an accessibility affordance that costs 6% of the
  bundle is a trade Paul should make, not one a gate should silently veto (§0.3).
- **Subtlety worth recording:** `npx expo-doctor` reports *1 check failed* (eight
  packages drifted from the SDK 54 pins) but `CI=1 npx expo-doctor` reports
  *18/18 passed*. Same tree, same command, different answer. The gate pins
  `CI=1` for determinism and takes the stricter baseline of **0** under those
  conditions, so any new failure trips it. The version drift itself is a real
  finding and goes to the backlog rather than being lost inside a green gate.
- **Alternatives rejected:** (a) Gate everything on zero — turns the suite red on
  arrival, which trains everyone to ignore it. (b) Drop the failing gates — loses
  the regression signal, which is the entire value. (c) Enforce a bundle-size
  ceiling — would let a byte count veto an accessibility fix.
- **Blast radius:** Isolated; tooling only.
- **Reversible:** Yes.
- **Confidence:** High.

### D-006 — [Phase 5] Presets multiply the user's speech settings instead of replacing them
- **Decision:** `applyPreset` returns `clamp(base.rate * preset.rate)` rather than `preset.rate`. `stop()` gained a synchronous `speakRequested` flag and defaults to `force: true`.
- **Why:** `voicePresets.normal` is `{1.0, 1.0}` and is the default, so overwriting meant a user who set 0.5x in Settings was spoken at 1.0x on every board utterance. Two paths bypassed `applyPreset` and did honour the setting, so the same word spoke at different speeds depending on route.
- **Alternatives rejected:** (a) Stop passing `settings.speechRate` at the call sites — hides the bug and breaks the two honest paths. (b) Drop presets — they are a real feature; multiplication preserves both intents.
- **Blast radius:** Module. Every speech path on the board. No contract change.
- **Reversible:** Yes — `31ff21c`. **Confidence:** High. Seven new tests.

### D-007 — [Phase 5] Scan items keyed by content; the cursor follows its item
- **Decision:** `identityOf()` combines id and label; `setScanItems` follows the focused item to its new index rather than resetting, and always calls `emitChange()`. Suggestions keyed `sug-${word}`.
- **Why:** With positional ids a new prediction batch of the same length compared equal, so the highlight stayed put while the word changed — and `getBigramPredictions` always returns 4, so this was the normal case. On an auto-scan device that means speaking a word the user did not choose. The silent `currentIndex = -1` also desynchronised the highlight from the service, so presses were discarded by the `currentIndex < 0` guard.
- **Alternatives rejected:** (a) Reset to 0 on any change — the existing 60-second-recovery behaviour that makes the second half of the board unreachable. (b) Deep-equal the whole item — same effect, more cost, and `button` objects defeat it.
- **Blast radius:** Module. Switch scanning on the board and in QuickRepair.
- **Reversible:** Yes — `5d8db1c`. **Confidence:** High. Six new tests, one of which fails against the old behaviour.

### D-008 — [Phase 5] QuickRepair scan gate moved from ref to state
- **Decision:** `wasScanningBefore` is `useState`.
- **Why:** A ref assigned in an effect after render never re-renders, so Next/Select were absent on first open. With no external switch input there was no way to reach Close either — a step-scan user was trapped on the urgent-repair surface.
- **Alternatives rejected:** Forcing a re-render another way — same effect, less honest about what the value is.
- **Blast radius:** Isolated. **Reversible:** Yes — `fdca526`. **Confidence:** High.

### D-009 — [Phase 5] Non-lexical token filter, in a TF-free module
- **Decision:** `src/utils/suggestionFilter.js` exports `isSpeakableSuggestion`, used by `improvedModelLoader`.
- **Why:** `xxx` is CHILDES for unintelligible speech and one of the model's highest-probability classes, so it was a tappable, speakable suggestion. The filter it replaces tested `!== '[UNKNOWN]'`, absent from the tokenizer. Kept out of `improvedModelLoader` because that file imports ESM-only `@tensorflow/tfjs-react-native`, which cannot load under jest.
- **Alternatives rejected:** Mocking TF.js in the test — tests a mock, not the filter.
- **Blast radius:** Isolated. **Reversible:** Yes — `4c8f09f`. **Confidence:** High.

### D-010 — [Phase 5] Context provider values memoised
- **Decision:** `useMemo` on the value objects in `AuthContext` and `SettingsContext`.
- **Why:** An inline literal is a new identity every render, so every screen re-rendered whenever a provider's Firebase listener fired, even with unchanged content.
- **Alternatives rejected:** Splitting into separate contexts — larger diff; identity is what the problem actually is.
- **Blast radius:** Module (the bug's blast radius was the whole app).
- **Reversible:** Yes — `b8a9684`. **Confidence:** High.

### D-011 — [Phase 5] Logger: queue after the fast path, bound it, back off
- **Decision:** `logEvent` enqueues only when the direct write fails. `enqueueLog` caps at 500 with FIFO eviction and a `console.warn`. `syncLogsToFirebase` respects exponential backoff with full jitter (5s base, 5min ceiling). `initLogger()` called from `App.js`.
- **Why:** The entry was queued *before* the fast path, which returned early without draining — so every successful online log was written twice once connectivity flapped, and the queue grew without bound on a healthy session. Drops go to `console.warn` and deliberately not through `logEvent`: a logger reporting its own failures through itself is a recursion trap. `initLogger` had zero call sites, so `isOnline` was permanently `true`.
- **Alternatives rejected:** (a) Dedupe on the way out — treats the symptom, costs a scan per sync. (b) Route drop notices through `logEvent` — the recursion trap the file's own comments already warn about.
- **Blast radius:** Module. Behaviour changes on the success path; both paths tested.
- **Reversible:** Yes — `e7cdf6a`. **Confidence:** High for the double-write and the bound; medium for the backoff constants, which are a judgement call with no measurement behind them.

### D-012 — [Phase 2] Rules tests written against the emulator, using a portable JDK
- **Decision:** 67 emulator cases in `test/rules/` plus 7 emulator-free structural checks. Downloaded a portable Temurin JDK 21 into the session scratchpad to execute them; the machine has no Java.
- **Why:** §2.B.4 requires automated rules tests and §2.B.2 requires an ALLOW control first — a DENY that passes proves nothing until something is shown to be allowed, because a syntax error also denies everything. Writing tests I could not run would have left the central finding at "high-confidence inference"; running them made it "verified by execution", which is the difference between a claim Paul must evaluate and one he can act on.
- **Alternatives rejected:** (a) `winget install` a system-wide JDK — modifies Paul's machine outside the repo, unattended. The scratchpad copy was contained and is gone. (b) Ship the tests unrun — the emulator revealed nothing surprising, but that could not be known in advance.
- **Blast radius:** Isolated; new test directory, no runtime code.
- **Reversible:** Yes — `1e5231b`. **Confidence:** High.

### D-013 — [Phase 2] `@firebase/rules-unit-testing` pinned to 4.0.1; the rules gate skips rather than fails
- **Decision:** 4.0.1, not 5.0.1. The gate reports `skip` on exit code 2 (emulator unavailable) and `fail` on anything else.
- **Why:** 5.x peers on `firebase ^12`; the app is on `^11` and §0.2 forbids a Firebase major. The tree gate caught it within a minute — exactly the §2.C hazard. On the skip: "could not run" and "failed" are different facts, and collapsing them lets a missing JDK read as either a passing suite or a broken one.
- **Alternatives rejected:** (a) Bump firebase to 12 — forbidden, and not for a devDependency. (b) An isolated `test/rules/package.json` — defensible, but adds a second CI install for no benefit once 4.0.1 works.
- **Blast radius:** Isolated. **Reversible:** Yes. **Confidence:** High.

### D-014 — [Phase 5] Permanent vertical space reserved for the prediction strip
- **Decision:** `SUGGESTION_BAR_HEIGHT = 66`, always rendered; the favourite and display-mode buttons always rendered, disabled when there is no sentence.
- **Why:** Computed from the stylesheet: the strip cost ~61dp and the action-row wrap ~49dp, against a button pitch of 78dp. The board moved 1.4 rows on the first tap, landing each button almost where a different one had been. AAC users build muscle memory for positions; that is the worst possible displacement.
- **Alternatives rejected:** (a) Animate the shift — a slower wrong answer. (b) Overlay the strip on the grid — occludes the top row, where core vocabulary lives. (c) Leave it — the finding is `critical` and the fix is arithmetic.
- **Blast radius:** Module, on the primary communication surface. Costs ~66dp when idle.
- **Reversible:** Yes — `1cc1bd2`.
- **Confidence:** Medium-high. The arithmetic is sound; **not verified on a device**, which is why the handover asks Paul to open the board before merging.

### D-015 — [Phase 5] Palette solved numerically; scan ring made theme-aware
- **Decision:** Six accents darkened in each of light and dark, borders raised, ring changed from `#FF6600` to black (white in high contrast). Every value produced by a solver, then pinned by `themeContrast.test.js`.
- **Why:** Twelve filled-button pairings were below 4.5:1, worst 1.97:1, dark consistently worse than light. Borders were 1.35–1.50:1. The ring was 2.09:1 on the "important" fill and collapses under protanopia — and switch users disproportionately have co-occurring visual impairment.
- **Alternatives rejected:** (a) Flip `buttonText` to dark ink in dark mode — fewer colour changes but redefines a token used at 68 sites, several on dark surfaces. Darkening the accents keeps `#FFFFFF` correct everywhere. (b) A single ring colour — no hue clears 3:1 against both the pastel fills and the near-black high-contrast button; computed, not assumed. (c) Pick by eye — how the current values got here.
- **Blast radius:** Module. Visual across every screen; no layout or behaviour change.
- **Reversible:** Yes — `30bc067`. **Confidence:** High on the arithmetic, medium on aesthetics — the palette is duller and Paul may want to re-tune within the constraint.

### D-016 — [Phase 5] A partial deletion failure aborts instead of completing
- **Decision:** `Promise.allSettled` with results checked; on any rejection the Auth account is left intact and the user is told. `feedback/{uid}` added. Consent copy itemises what is destroyed. The success message no longer claims local data was cleared when it was not.
- **Why:** The old flow swallowed the failure and continued to `deleteUser`, after which every surviving node is protected by `auth.uid === $uid` for a uid that can never authenticate again — unreachable, undeletable, permanent. A user on a flaky connection got a success message and an orphaned copy of their data forever. UK GDPR Art. 17 failure with no recovery path.
- **Alternatives rejected:** (a) Retry in a loop — unbounded retry on a destructive action, unattended, on a possibly-offline device. (b) Delete Auth first — makes the orphaning certain rather than occasional. (c) Warn and continue — the honest version of the same bug.
- **Blast radius:** Module. Some deletions that previously "succeeded" will now correctly refuse.
- **Reversible:** Yes — `53e842a`. **Confidence:** High.

### D-017 — [Phase 7] CI on both repos; no secrets, no deploy
- **Decision:** `.github/workflows/ci.yml` in each. Node pinned to 22.12.0 to match `eas.json`. Import-case is a separate early step. Rules run in their own job with a JDK.
- **Why:** The release blocker was only discoverable on Linux, in a clean install, in a production bundle. CI is that environment for free on every PR. Import-case is separated because it is the cheapest gate and the one that would have caught it; rules are separated so a missing JDK cannot read as a rules failure.
- **Alternatives rejected:** (a) A deploy job — §0.2. (b) Real secrets — §0.2. (c) `CI=true` on the dashboard build — CRA turns warnings into errors and the tree has pre-existing ones; a workflow red on arrival trains everyone to ignore it.
- **Blast radius:** Isolated. **Reversible:** Yes. **Confidence:** High for the app; medium for the dashboard, which has never run in CI.

### D-018 — [Phase 6] Three prototypes built, none wired in
- **Decision:** `featureFlags.js` plus `utteranceRecovery`, `rateMetrics`, `activationGuard`. All flags default false; no module has a call site.
- **Why:** Each targets a finding from tonight's audits rather than a hypothetical. Not wiring them is the point: each touches the communication surface and needs a device test I could not do. A flag that is off but wired still changes the code path the user runs.
- **Alternatives rejected:** (a) Wire them behind the flags — an off flag is not the same as no call site when the surface is somebody's voice. (b) Remote config — a flag that changes underneath the user is a liability on a device they speak with. (c) Fewer, deeper prototypes — three one-day wiring jobs suit a Saturday better than one large one.
- **Blast radius:** Isolated. +0.31% bundle, dead code until wired.
- **Reversible:** Yes — `7aad9c6`. **Confidence:** High on the modules, medium on whether they are the right three — a product judgement, with criteria in `IDEAS.md`.

### D-019 — [Phase 9] The dashboard gets the findings, not the fixes
- **Decision:** Two dashboard commits: CI, and copies of `DATA-CONTRACT.md`, the backlog and the findings, plus a README naming the four things to read first. No code touched.
- **Why:** Every dashboard defect found is cross-repo or data-contract-touching, which §0.2 and §4 both route to Tier B. Applying one side of a two-sided change is how outages happen. But leaving the findings only in the app repo means the person fixing the dashboard never sees them.
- **Alternatives rejected:** (a) Fix the `userLogs` read path — tempting, small and correct, but only safe *after* `.indexOn` exists; getting that order wrong turns a permission error into a multi-gigabyte transfer per page load. (b) Delete the non-parsing `src/functions/index.js` — a real build hazard, but also the only written record of the intended hardened `setUserPassword`, and deleting it unattended could lose that intent.
- **Blast radius:** Isolated; docs and CI only.
- **Reversible:** Yes — `84239ef`, `6bbc0a1`. **Confidence:** High.

### D-020 — [Phase 8] Accepted a `block` verdict on my own work and fixed the regression
- **Decision:** The cumulative-diff review returned `block`. Fixed the scan focus ring by moving the id convention into one exported `suggestionScanId()` used by both the scan-item builder and the chip renderer; stripped a NUL byte from `identityOf`; added `src/__tests__/sourceHygiene.test.js`; stopped `actionDisabled` opacity applying while a control holds the scan ring.
- **Why:** D-007 changed the scan item id to `sug-${word}` and left the renderer asking for `sug-${index}`, so `isScanFocused` could never match — a switch user got no visible focus across the entire suggestion block. The commit whose purpose was preventing a switch user activating something they had not seen selected shipped with the indicator for those exact items dead. Every gate stayed green: nothing tests that a rendered element's id matches its scan item's id. The NUL byte is the same category — invisible to jest, eslint and Metro alike, and it would have shipped.
- **Alternatives rejected:** (a) Fix the literal at the call site and move on — leaves the convention duplicated across a boundary, which is the actual defect. (b) A source-grep test asserting no positional `sug-` id — pins the symptom, not the coupling. (c) Skip the source-hygiene test as paranoia — I could not identify which edit introduced the NUL, and an unattributable defect that survives every gate is exactly what deserves one.
- **Blast radius:** Module. Restores intended behaviour; no new surface.
- **Reversible:** Yes — `2cc68f8`. **Confidence:** High.

### D-021 — [Phase 8] Credential freshness checked before anything is destroyed
- **Decision:** `handleDeleteAccount` reads `currentUser.metadata.lastSignInTime` and bails with a re-authentication prompt if it is older than four minutes, before the first `remove()`. Delete order changed to least-precious-first. The abort message states how much was already removed.
- **Why:** Firebase requires a recent sign-in for `deleteUser`. On an AAC device signed in for weeks, `auth/requires-recent-login` is the *normal* path — and the deletes ran first, so the most probable outcome of tapping "Delete Everything" was every cloud node gone, local vocabulary, favourites, history and AI profile cleared, the account still present, and a message inviting a retry. D-016 added an abort for the failure mode that was already recoverable and left this one, which is not.
- **Alternatives rejected:** (a) Call `reauthenticateWithCredential` inline — needs a password prompt this screen does not have, and building one unattended on a destructive flow is not a 3am change. (b) Move deletion server-side to a callable — the right long-term answer (SEC-H11) and far beyond tonight's blast-radius budget. (c) Catch `auth/requires-recent-login` and restore — you cannot restore a delete.
- **Blast radius:** Module. Some deletions now refuse earlier and more usefully.
- **Reversible:** Yes — `8d796ed`. **Confidence:** High on the ordering; medium on the four-minute window, which is a guess at Firebase's undocumented threshold with headroom.

### D-022 — [Phase 8] Three narrower windows closed
- **Decision:** Logger queues before the direct write and splices on confirmation; a `SyntaxError` from a corrupt log store no longer extends the sync backoff; utterances carry a monotonic id so a superseded one cannot clear the current one's flags; tab bar colours joined the contrast pass and the test.
- **Why:** Each is a case where the earlier fix narrowed a window rather than closing it, and the review found all three. The logger one matters most: `push()` can stay pending indefinitely when NetInfo still reports online but the link is gone, so queue-after-await loses entries on a process kill. Queue-then-splice is the only ordering where an entry is either queued or confirmed at every instant.
- **Alternatives rejected:** (a) Race `push()` against a timeout — adds a tunable with no measurement behind it. (b) Leave the tab bar as pre-existing — true, but `30bc067`'s message claimed "across both palettes", and a commit message that overstates is worse than one that omits.
- **Blast radius:** Module.
- **Reversible:** Yes — `ae9d70b`. **Confidence:** High.
