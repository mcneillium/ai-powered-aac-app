# Prioritised backlog — 2026-08-08

Scored per OVERNIGHT-RUN.md §4. Impact is weighted by the §0.3 priority order,
so an accessibility fix outranks a performance win at the same severity.

Score = Impact × Confidence ÷ Effort, rounded. Effort is 1 (trivial) to 5 (days).
Full evidence for every item is in `FINDINGS.md`; IDs cross-reference it.

**One thing dominates this list.** Two independent audits concluded, and 67
emulator-backed tests then *proved*, that the caregiver dashboard cannot read
any data at all under `database.rules.json` as written — and separately that it
reads `userLogs` at a path shape the app stopped writing on 2026-03-29. The
morning handover as it previously stood told Paul to deploy those rules first
thing. That is item B-1 and it is why nothing in Tier A touches the rules file.

---

## TIER A — done tonight

| # | Item | Findings | Impact | Conf | Effort | Blast | Revert | Commit |
|---|---|---|---|---|---|---|---|---|
| A-1 | Root-cause + permanently gate the versionCode 19 bundling failure | — | 5 | 5 | 2 | isolated | clean | `b2052f8` |
| A-2 | Speech rate/pitch no longer discarded; TTS reliably stoppable | A11Y-08, A11Y-09 | 5 | 5 | 1 | module | clean | `31ff21c` |
| A-3 | Scan items keyed by content; cursor follows its item; always emits | A11Y-04, A11Y-05, AI-F11 | 5 | 5 | 2 | module | clean | `5d8db1c` |
| A-4 | Quick Repair scan controls render on first open | A11Y-17 | 5 | 5 | 1 | isolated | clean | `fdca526` |
| A-5 | CHILDES markers (`xxx`) filtered out of suggestions | AI-F20 | 4 | 5 | 1 | isolated | clean | `4c8f09f` |
| A-6 | Context provider values memoised | PERF-11 | 3 | 5 | 1 | module | clean | `b8a9684` |
| A-7 | Logger: bounded queue, no double-write, backoff, `initLogger` wired | PERF-17, TC-08, §2.A | 4 | 5 | 2 | module | clean | `e7cdf6a` |
| A-8 | Firebase rules test suite (67 cases) + static checks + gate | DC-F25, SEC-H18 | 5 | 5 | 3 | isolated | clean | `1e5231b` |
| A-9 | Board no longer shifts ~110dp when a prediction arrives | A11Y-01 | 5 | 4 | 2 | module | clean | `1cc1bd2` |
| A-10 | Computed WCAG contrast fixes, both palettes + scan ring, with a test | A11Y-13/14/15 | 5 | 5 | 2 | module | clean | `30bc067` |
| A-11 | Account deletion: honest consent, `feedback` included, safe on failure | A11Y-24, SEC-H11, DC-F13 | 5 | 5 | 2 | module | clean | `53e842a` |

Not pulled from Tier A, and why:

- **History/Favourites panels shift the board ~275dp** (A11Y-03). The fix is to
  render them as absolutely-positioned overlays instead of in flow. That is a
  layout change I cannot visually verify from here, and getting it wrong breaks
  the primary communication surface. Moved to B-6 with the exact plan.
- **Touch targets under 44dp** (A11Y-26/27/28). Mechanical, but spread across
  five files and each one needs a look at the rendered result. B-7.

---

## TIER B — prepared, not applied

Each of these has the thinking done. None is applied, because each is
cross-repo, data-contract-touching, or needs a device.

### B-1 — DO NOT DEPLOY `database.rules.json` UNTIL THE DASHBOARD IS FIXED
**Impact 5 · Confidence 5 (verified by execution) · Effort 4 · cross-repo · one-way in effect**

`npm run test:rules` proves, against the emulator, that the rules file in this
repo denies:
- a **linked** caregiver every read of their user's data (there is no caregiver
  rule at all — every `.read` is `auth.uid === $uid`);
- all six top-level paths the dashboard uses that have no rule (`alerts`,
  `favorites`, `customBoards`, `systemConfig`, `fineTuneMetrics`, `sessions`);
- `role: 'admin'`, which both `schema.js` files export and the dashboard writes
  during its first-user bootstrap.

Deploying it takes the caregiver dashboard offline. Not degrades — offline.
Every dashboard call site swallows the failure into an empty state, so it will
look like a data problem rather than a rules problem.

**The order matters and two steps are dangerous if swapped:**
1. Rules tests first — done, `test/rules/`. Requires JDK 21+.
2. Fix the dashboard's `userLogs` read shape (B-2) **and** add `.indexOn`
   (B-3) — *before* opening any read. Opening reads while the queries are still
   unindexed and root-scoped converts a permission error into a multi-gigabyte
   transfer per page load (DC-F05: 262 MB at 50 heavy users on a 30-day window).
3. Then the rules rewrite: caregiver/admin read tier driven by an **Auth custom
   claim**, not a `root.child('users')` lookup (which fans out a read per rule
   evaluation). Move `role` out of the self-writable `users/$uid` node at the
   same time (SEC-H6) — a user can currently promote themselves to caregiver
   with one authorised write.
4. Add `targetUserId: {".validate": "newData.val() === $uid"}` (SEC-H9).

**Test plan:** every case above already exists in `test/rules/` as an
`assertFails` that must flip to `assertSucceeds` for the linked caregiver and
must stay failing for the unlinked one. That pair is the whole boundary.
**Rollback:** the rules file is one `firebase deploy --only database` away in
either direction; keep the current published rules text before deploying.

### B-2 — Dashboard reads `userLogs` at a shape the app stopped writing
**Impact 5 · Conf 5 · Effort 2 · cross-repo · clean-revert**
`Logs.js:64`, `Notifications.js:59`, `AdminDashboard.js:84`,
`CaregiverDashboard.js:175`, `UserActions.js:36` all treat `userLogs` as a flat
map. The app writes `userLogs/{uid}/{pushId}` (commit `ed2d27f`, 2026-03-29).
Every log row renders `undefined`; `CaregiverDashboard`'s "active today" is
permanently 0, so a caregiver checking whether a non-speaking person has
communicated today is told *no* regardless of the truth.
Fix: `query(ref(db, \`${DB_PATHS.USER_LOGS}/${uid}\`), orderByChild('timestamp'), limitToLast(200))`,
fanned out over assigned uids. Correct the `userLogs/{pushId}` comment in both
`schema.js` files in the same commit.

### B-3 — No `.indexOn` anywhere
**Impact 4 · Conf 5 · Effort 1 · data-contract · clean-revert**
Add `"userLogs": {"$uid": {".indexOn": ["timestamp"]}}`. Must land with B-2.

### B-4 — `pruneUserLogs` OOMs at roughly 24 heavy users and then fails silently
**Impact 4 · Conf 4 · Effort 2 · module · clean-revert**
`functions/index.js:454` loads the whole log tree into a 512 MB function; the
OOM kills the process before the `try/catch`, so the scheduler records success
and retention stops forever with no alert. Iterate users one at a time with
`orderByChild('timestamp').endAt(cutoff)`, batch deletes via one multi-path
`update()` per user, `maxInstances: 1`, and rethrow so a failure is visible.

### B-5 — Two function codebases both named `default` on one project
**Impact 4 · Conf 5 · Effort 1 · cross-repo · clean-revert**
A `firebase deploy` from the dashboard repo deletes all five of the app's Cloud
Functions, including `pruneUserLogs`. Give the dashboard `"codebase": "dashboard"`.
The checklist already records this being offered and deferred once.

### B-6 — History and Favourites panels move the board ~275dp
**Impact 5 · Conf 4 · Effort 2 · module · clean-revert**
`AACBoardScreen.js:696,723` render in flow. Make `historyPanel`
`position: 'absolute'` anchored below the sentence bar with `zIndex`, a
`maxHeight`, and internal scroll. Needs a device to verify, which is why it did
not land tonight.

### B-7 — Touch targets below the floor on core paths
**Impact 4 · Conf 5 · Effort 2 · module · clean-revert**
`VoicePresetPicker.js:78` 36dp (on the primary board); `SettingsScreen.js:394`
39×46dp rate/pitch; `LoginScreen.js:177` and `SignupScreen.js:196` **18dp** with
no padding and no hitSlop — below even the 24dp AA minimum, and one of them is
"Forgot password?"; `CameraScreen.js:410` 24dp. Add `minHeight: 48` and
`hitSlop`.

### B-8 — Utterance cannot be edited word-by-word on the primary board
**Impact 4 · Conf 5 · Effort 2 · module · clean-revert**
`AACBoardScreen.js:484` renders sentence words as plain `<Text>`. To fix word 2
of 7 the user must delete five correct words.
`EasySentenceBuilderScreen.js:185` already implements per-word removal — the
capability exists and is simply absent from the surface that matters.

### B-9 — Prediction acceptance rate is broken and shown to clinicians
**Impact 4 · Conf 4 · Effort 2 · module · clean-revert**
`suggestionsAccepted` counts every accepted word; `suggestionsShown` increments
only in the neural branch, which never fires (AI-F1/F4). The ratio can exceed
100% and `InsightsScreen.js:111` renders it as "Suggestion acceptance" to SLTs
making vocabulary decisions. Also: every Vertex acceptance goes through the
multi-word branch of `handleSuggestionPress`, which never records anything — so
the only paid tier is the only unmeasurable one.

### B-10 — Tier 1 on-device prediction contributes nothing at runtime
**Impact 3 · Conf 5 · Effort 5 · module · messy**
Measured by the AI auditor: the model never loads (`json` is in `assetExts`, so
`require('model.json')` returns an asset id, not an object — AI-F1); if it
loaded it would decode through the wrong index space (1 of 21 classes agrees
with `vocab.js` — AI-F3); and the weights are near-uniform anyway (83.5% of
maximum entropy; 79% of contexts produce the same five pronouns — AI-F5). Every
failure is silent, masked by the bigram fallback, which is why nobody noticed.
**Decide before fixing:** retrain with a matched tokenizer, or delete tier 1 and
give its eight `@tensorflow/*` packages' bundle weight back. Do not "fix" AI-F1
alone — that ships AI-F6, a 100–400ms JS-thread stall on every 4th tap.

### B-11 — Instrument the pipeline before touching the model
**Impact 4 · Conf 5 · Effort 2 · module · clean-revert**
~20 lines: stamp `performance.now()` at the suggestion-effect entry and at each
of the four `setSuggestions` calls, tagged by tier; emit p50/p95 as counts and
milliseconds only, never words. Every finding in B-9/B-10 is a hypothesis about
behaviour nobody is watching.

---

## TIER C — needs Paul

- **C-1 · Revoke the leaked service-account keys.** Two blobs remain in the
  dashboard's git history (`cdf18ec`, `8f9aa1e`). An Admin SDK key bypasses
  every rule in this report unconditionally, and `git rm` does not remove a blob.
  GCP Console → IAM → Service Accounts → delete the key ids. **This is the only
  step that actually revokes access, and nothing else in this document matters
  while those keys are valid.** History rewriting is a separate decision and was
  deliberately not attempted (§0.2).
- **C-2 · `setUserPassword` is a public unauthenticated account-takeover
  endpoint** (`dashboard/functions/index.js:17`). No auth, no role check, no
  rate limit, `cors({origin:true})`. The "locked" replacement lives in the CRA
  source tree, is imported by nothing, and does not parse. Remove the export and
  redeploy.
- **C-3 · Anyone can appoint themselves caregiver of any AAC user.**
  Public `/signup` → pick "Caregiver" → `/connect-user` lists every user in the
  system → claim a child. Under a minute, no insider access. Needs a product
  decision about how linking should work (invitation code entered by the user or
  guardian is the normal answer).
- **C-4 · `customVocab` vs `customBoards`.** A caregiver builds a board, gets a
  success toast, and it never reaches the device. Which node is canonical is a
  product decision, and several other items depend on the answer. Until it is
  made, disable the page rather than leave it silently failing.
- **C-5 · Expo SDK 54 patch drift** — 8 packages behind their SDK pins
  (`npx expo install --check`). Deliberately not applied: §0.2 forbids
  unsupervised SDK movement and `expo` itself is one of the eight.
- **C-6 · App Check.** Absent everywhere, though `functions/index.js:53` relies
  on it in a comment. Anonymous auth is enabled, so the per-user rate limit is
  ornamental — anyone can mint unlimited uids, and `rateBuckets.clear()` at
  10,000 entries lets them wipe everyone's counters.
- **C-7 · Cloud Functions run in us-central1** while RTDB and Vertex are
  europe-west1. The function receiving the plaintext utterance and the 5 MB
  photo is the one in the US. Adding `.region('europe-west1')` creates new
  functions and requires deleting the old ones — a supervised change.
- **C-8 · TypeScript.** `tsconfig.json` exists, the gate passes, and there are
  zero `.ts` files. Either adopt it starting at the Firebase data layer, or
  delete the config so the green gate stops implying type safety.
