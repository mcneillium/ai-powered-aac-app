# Raw audit findings — overnight run 2026-08-08

Grouped by domain. This is the auditors' output, condensed to the load-bearing
parts (ID, severity, file:line, evidence, fix). Scoring and de-duplication
happen in `BACKLOG.md`, not here.

**Read the headline first:** two of tonight's audits independently concluded that
the **caregiver dashboard cannot read any data at all** under the rules file in
this repo, and separately that it **reads `userLogs` at a path shape the app
stopped writing on 2026-03-29**. Those two facts, together, mean the dashboard is
not a partially-working product — it is a shell rendering empty states. See
DC-F01 and DC-F02.

---

## A. Data contract (`data-contract-guardian`) — VETO issued

Verdict: **veto** on deploying `database.rules.json` as it stands. Not because
the rules are wrong in themselves, but because nothing has ever verified them
against the dashboard, and they deny it everything.

### DC-F01 — `userLogs` shape mismatch — CRITICAL, confidence certain
App writes `userLogs/{uid}/{pushId}` (`src/utils/enhancedLogger.js:202,292,347`);
rules enforce that nesting (`database.rules.json:55-81`); `pruneUserLogs`
iterates it (`functions/index.js:458`). **The dashboard reads `userLogs` as a
flat map** — `Logs.js:64`, `Notifications.js:59`, `AdminDashboard.js:84`,
`CaregiverDashboard.js:175`, `UserActions.js:36`.

`Logs.js:72` spreads `([id, log]) => ({id, ...log})`, so against real data each
`log` is a *map of pushId→entry*: `log.action` is `undefined`, `log.timestamp` is
`undefined`. `orderByChild('timestamp')` sorts on a key that does not exist at
that depth, so `limitToLast(500)` picks 500 arbitrary **users**, not 500 logs.
`CaregiverDashboard.js:197` computes `new Date(undefined).toDateString()`, so
"active today" is permanently 0 — a caregiver checking whether a non-speaking
user has communicated today is told *no* regardless of the truth.

Datable: app commit `ed2d27f` (2026-03-29) moved the path; the dashboard's last
schema alignment was `b383ccd`, ten days earlier. Broken for four months.

Fix (dashboard side — the app and rules are correct):
`query(ref(db, \`${DB_PATHS.USER_LOGS}/${uid}\`), orderByChild('timestamp'), limitToLast(200))`,
fanned out over assigned uids for cross-user views.

### DC-F02 — No rule grants a caregiver or admin read access to anything — CRITICAL, certain
Every `.read` in `database.rules.json` is `auth != null && auth.uid === $uid`
(`:5,15,21,41,50,57`), `feedback` is `".read": false` (`:84`), everything else is
denied at `:97-100`. RTDB read rules cascade **downward only** — a rule at
`users/$uid` does not authorise reading `users`.

Denied today: `AdminDashboard.js:72,84,109`, `CaregiverDashboard.js:150,175`,
`Logs.js:29,37,65`, `Notifications.js:59`, `Alerts.js:35,49`, `Layout.js:88`,
`MyUsers.js:22`, `Favorites.js:23,39`, `CustomBoards.js:36,52`,
`ConnectUser.js:20`, `UserActions.js:21,27,36`, `UserManagement.js:26`,
`UserSettings.js:20,26`, `SyncStatusCard.js:35`, `Feedback.js:24`,
`FeedbackAdmin.js:24`, `FineTuneMetrics.js:31`, `SystemSettings.js:39`,
`TestSystem.js:27,35-37`.

Why nobody noticed: every call site swallows the failure into an empty state
(`Logs.js:83`, `Favorites.js:47`, `Alerts.js:74`, `Layout.js:105` `() => {}`).
The dashboard renders as a healthy, empty product.

Fix: a role-aware read tier driven by an Auth **custom claim**
(`auth.token.caregiver`, `auth.token.admin`) set by a Cloud Function, not by a
`root.child('users')` lookup (which fans out a read per rule evaluation).
**Sequence matters** — see DC-F05 before opening any read.

### DC-F03 — Dashboard log writes are all rejected; no server-side audit trail — CRITICAL, certain
`dashboard/src/utils/logger.js:24` pushes to `userLogs/{pushId}` — matches
`userLogs/$uid` with `$uid` = a push key, so `auth.uid === $uid` is never true.
Compounding: `:19` sets `source: 'dashboard'`, rejected independently by
`$other: false` (`database.rules.json:78`). `:25-27` is a bare `catch {}`
falling back to 200 entries in localStorage. **Every caregiver and admin action
on a vulnerable user's configuration is unaudited server-side.**

### DC-F04 — `role` validator rejects `'admin'` — HIGH, certain
`database.rules.json:9` permits only `'user'|'caregiver'`. Both `schema.js`
files export `ROLES.ADMIN='admin'`; `Login.js:47,52` writes it for the bootstrap
first user; `UserManagement.js:68` writes arbitrary roles. The dashboard cannot
bootstrap its own privileged user. Fix must gate admin promotion behind a claim
or Cloud Function — `users/{uid}` is client-writable at `:6`, so simply adding
`'admin'` to the validator lets **any user self-promote**.

### DC-F05 — Unbounded `userLogs` growth, with arithmetic — HIGH, high
~350 B/entry on the wire. Heavy user at 500 events/day: 30 days = 5.25 MB;
1 year = 63.9 MB; **2 years unpruned = 127.8 MB**.

**There is no `.indexOn` anywhere in `database.rules.json`.** An unindexed
`orderByChild` makes RTDB ship the entire node and sort client-side, with
`limitToLast` applied *after* download. One dashboard page load therefore
transfers the whole corpus for every user: 50 heavy users at steady state =
**262 MB per page load**; unpruned at 2 years = **6.4 GB**.
`Notifications.js:62` uses `onValue` on a top-level route — that is a
re-download on every change.

Fix, all three parts: per-user query (DC-F01); add
`"userLogs": {"$uid": {".indexOn": ["timestamp"]}}`; `limitToLast` at the user
node so the limit is server-side.

### DC-F06 — `pruneUserLogs` OOMs at ~24 heavy users, and retention then stops silently — HIGH, high
`functions/index.js:454` — `db.ref('userLogs').once('value')` loads the entire
log tree for every user into a 512 MB function (`:445`). At 5.25 MB/heavy user
and ~4× parse overhead the ceiling is ~24 users. An OOM kills the process before
the `try/catch` at `:452` runs, so it fails with no application error — only a
crash metric nobody watches. `:468` also fires every delete concurrently.
Fix: iterate users one at a time, `orderByChild('timestamp').endAt(cutoff)`
server-side, batch deletes via one multi-path `update()` per user.

### DC-F07 — Deploying from the dashboard repo deletes all five app Cloud Functions — HIGH, high
Both repos target `commai-b98fe`. App `firebase.json` has
`functions.source: "functions"` with no `codebase` → codebase `"default"`.
Dashboard `firebase.json` declares `"codebase": "default"` explicitly. A
`firebase deploy` from the dashboard replaces that codebase, deleting
`imageCaptionProxy`, `aacPhraseSuggestions`, `imageToAACPhrases`,
`ocrToAACPhrases`, `pruneUserLogs`. Kills tier-3 AI **and** log retention.
Fix: give the dashboard `"codebase": "dashboard"`.

### DC-F08 — `logs_synced.count`: the semantics did change, and there is no consumer — MEDIUM, certain
`enhancedLogger.js:346-355` writes `count: syncedCount`, incremented only on
`fulfilled` (`:314`). After the `allSettled` change `count` means **written**;
under `Promise.all` the natural value was **attempted**. So yes, the meaning
moved.

But an exhaustive grep of the dashboard finds **zero** reads of `count` on a log
object — the three hits are unrelated locals (`Layout.js:92`,
`AdminDashboard.js:356`, `UserActions.js:110`). `logs_synced` appears once, at
`Notifications.js:30`, only to choose an icon, and that branch is already
matched by `action.includes('sync')` before the `||`.

So `count` is a **dead write** with no written definition anywhere: it is
validated in the rules (`:70`) and whitelisted in `enhancedLogger.js:31` but
absent from **both** repos' `LOG_FIELDS`. The next person who builds a "logs
synced today" tile has even odds of guessing "attempted".

The real loss: `rejectedCount` is `console.warn`-ed at `:334` and then
discarded, so permanently dropped entries leave no durable trace. For an AAC
product, "logs the user generated that were destroyed" is exactly the number a
clinician auditing communication frequency needs.
Fix: keep `count` = succeeded, add `attempted` and `dropped`, add all three to
`ALLOWED_LOG_FIELDS`, to the rules `$logId` block, and to `LOG_FIELDS` in both
schemas with the definition written down.

### DC-F09 — `customVocab` vs `customBoards`: two vocabulary systems that never talk — HIGH, certain
App's real vocabulary is `customVocab/{uid}` (`customVocabStore.js:92,286`), the
only vocabulary node with validation. The dashboard never touches it. The
dashboard's CustomBoards page reads/writes `customBoards/{uid}/{boardId}`
(`CustomBoards.js:52,118,123,138`); the app never reads it and it has no rules.

**A caregiver builds a communication board for a non-speaking user, gets a
success toast, and the board never reaches the device.** Worse than a dead
write — it is a false assurance to the person responsible for someone's ability
to communicate. Product decision required: which node is canonical. Until then
the page should be disabled, not silently failing.

### DC-F10 — Read but never written: `alerts`, `favorites`, `fineTuneMetrics` — MEDIUM, certain
No producer exists for any of them. `dashboard/src/shared/schema.js:117` claims
alerts are "written by the mobile app when a trigger condition is met" — grep
the app: nothing. **A distress alert can never reach a caregiver**;
`Layout.js:102` shows a permanent zero badge. `favouritesStore.js:3` says
"optionally synced to Firebase" but the file imports no Firebase module.
`FineTuneMetrics.js:46` divides by `metrics[0].loss` with no zero guard.

### DC-F11 — `archivedFeedback` is a write-only PII accumulator — MEDIUM, certain
`FeedbackAdmin.js:82` copies name, email and free-text feedback into
`archivedFeedback/{uid}/{id}`, then deletes the original at `:85`. Nothing ever
reads it. No rule, no reader, no retention. `systemConfig` is likewise written
and read only by the page that wrote it — a caregiver toggling a system setting
changes nothing on the device.

### DC-F12 — `sessions/{uid}/{id}` is a phantom path in both schemas — LOW, certain
Declared in both `schema.js`, asserted by `src/__tests__/schema.test.js:11`,
never read, never written, no rules. The test locks in a path that does not
exist and gives false confidence that the schema file is validated.

### DC-F13 — Account deletion does not remove `feedback` — HIGH, certain
`ProfileScreen.js:55-62` removes six nodes but not `feedback/{uid}`, which holds
name, email and free text. The user *has* write access there (`:85`) — the delete
is simply absent. `archivedFeedback/{uid}` is unreachable to them entirely.
UK GDPR Art. 17 exposure for a product used by children and vulnerable adults.
Also: that `Promise.all` should be `allSettled` — one rejected delete currently
abandons the rest.

### DC-F14 — Same function name, inverted trust model — MEDIUM, certain
App `enhancedLogger.js:184-193` spreads filtered metadata **first**, so the
logger's own fields always win — deliberate, per the comment at `:181`.
Dashboard `logger.js:13-21` spreads `...metadata` **last**, so a caller can
replace `action`, `timestamp`, `targetUserId`, `carerId`, `level`.
`logEvent('x', {action:'y'})` records `x` on the app and `y` on the dashboard.
Never throws; just makes two devices' logs mean different things.

### DC-F15 — Two hand-duplicated schema files, already 5 paths and 4 field-groups apart — HIGH, certain
App `DB_PATHS` has 7 entries, dashboard has 12. Neither mentions `customVocab`
or `vocabRequests` — two of the four paths the app actually writes — which is
*why* they are hardcoded at `customVocabStore.js:92,232,260,264,286`,
`AuthContext.js:30`, `SignupScreen.js:64`, `ProfileScreen.js:56-61`,
`enhancedLogger.js:202,292,347`, `FeedbackScreen.js:19`. Both files' header
comments still say `userLogs/{pushId}`, which DC-F01 shows is false.
Fix: add the missing constants, correct both comments, and add
`scripts/check-schema-parity.mjs` as a **gate** — parity deserves a machine, not
a convention.

### DC-F16 — The `users` write rule blocks every caregiver-assignment workflow — HIGH, certain
`database.rules.json:6` allows a user to write only their own record.
`ConnectUser.js:42` (caregiver sets `caregiverId` on another user),
`UserManagement.js:57` (admin assigns caregiver), `:68` (admin changes role) are
all denied. `caregiverId` is the linchpin of the caregiver model and can never
be set by the party that owns the workflow. Fix via Cloud Function + Admin SDK
or a claim-based admin branch — **not** by widening the client write rule.

### DC-F17 — `feedback` `".read": false` blocks the two pages built to read it — MEDIUM, certain
Unconditional, not owner-scoped. `Feedback.js:24` and `FeedbackAdmin.js:24` are
denied at root and at every child. Feedback is being collected, stored, and is
unreadable by anyone. `FeedbackAdmin.js:64-74` builds a `mailto:` reply flow for
data it can never load. The `false` was defending utterance-adjacent content,
which is the right instinct — the fix is a narrow admin grant, not removing it.

### DC-F18 — `dashboard/src/functions/index.js` does not parse — MEDIUM, certain
Typographic quotes (`‘…’`) at `:10,11,15,16,18,19,26,27,33,35`. It sits under
`src/` so CRA's module-graph-scoped compilation misses it; one `import` away
from a build failure. It also encodes a harmful design: `:40-56` is an
`auth.user().onCreate` doing `.set()` on `users/{uid}` **without `role`**, which
would race signup and clobber the role — an intermittent "logged in with no
role" bug reproducible only under timing. Delete it.

### DC-F19 — `pruneUserLogs` cannot delete entries with a missing `timestamp` — LOW, high
`functions/index.js:460` requires `typeof ts === 'number'`. Entries predating the
validation rules, or written by an Admin SDK path that bypasses rules (including
the pruner's own writes), are permanently unprunable.

### DC-F20 — `userSync.lastActivity` is the only ISO-8601 string in a system of epoch numbers — LOW, certain
Consistent end to end today (`syncStatus.js:16` → rules `:52` →
`SyncStatusCard.js:41`) — one of the few paths that genuinely works. The hazard
is a well-meaning normalisation: `syncStatus.js:25-28` swallows a write error
into a `console.warn`, so the sync indicator would freeze at its last value
while showing a caregiver a stale "online" chip.

### DC-F21 — `customVocab.deletedIds` tombstones are never compacted — LOW, high
`customVocabStore.js:286` rewrites the **entire** node — all items plus all
tombstones — on every single vocabulary change. 500 words + 2,000 tombstones
re-uploaded per edit, on a metered mobile connection, on a device that must work
in the field.

### DC-F22 — `userSettings` has no field validation — LOW, certain
`database.rules.json:13-18` grants owner R/W with no `.validate` on any child.
`SettingsContext.js:101` replaces the node wholesale from client state. Nothing
stops `gridSize: "large"` — and `gridSize` drives board layout, so an unexpected
value there is a motor-planning hazard, not a cosmetic one.

### DC-F23 — `TestSystem.js:61` writes operator-authored strings into production logs — LOW, certain
Rejected today by DC-F03, but the moment that is fixed, test strings enter the
collection clinical analytics read, and `Logs.js:55` builds its filter list from
observed values, so they become permanent filter options.

### DC-F24 — Every dashboard `onValue` teardown calls `off(ref)` — LOW, high
`off(ref)` with no callback detaches **all** listeners at that path.
`Layout.js:88` (persistent chrome) and `Alerts.js:49` (a route) subscribe to the
same `alerts` path; navigating away from Alerts kills Layout's unread badge
until a reload. `useFirebaseList.js:37` gets it right and is the pattern to copy.
Occurrences: `Notifications.js:76`, `Favorites.js:34,48`, `Alerts.js:76`,
`Layout.js:106`, `CustomBoards.js:47,57`, `FeedbackAdmin.js:47`,
`UserActions.js:54`, `UserSettings.js:39`, `SyncStatusCard.js:52`,
`CaregiverDashboard.js:169`, `AdminDashboard.js:126`.

### DC-F25 — No rules tests exist — MEDIUM, high
Every one of DC-F02/03/04/16/17 is a rules failure a five-line
`@firebase/rules-unit-testing` case would have caught at commit time. The absence
of that gate is why a contract break survived four months.

### Recommended sequencing (from the guardian, and it is right)
1. Rules tests **first** — otherwise the DC-F02 rewrite is unverifiable.
2. DC-F01 + DC-F15 — log path and schema comments, one commit across both repos.
3. `.indexOn` + server-side limits — **before** DC-F02. Opening reads while
   queries are unindexed and root-scoped turns a permission error into a
   multi-gigabyte transfer per page load.
4. DC-F02/04/16/17 — the rules rewrite, one reviewed change, with tests.
5. DC-F03 + DC-F14 — dashboard logger, so an audit trail exists *before*
   privileged workflows start succeeding.
6. DC-F06, DC-F07 — retention durability. 7. DC-F13 — erasure.
8. Decide DC-F09 (product decision) before anything that depends on it.

---

## B. Test coverage shape

| Subsystem | Coverage | Risk | Effort |
|---|---|---|---|
| Utterance builder (`AACBoardScreen`, `EasySentenceBuilderScreen`) | **ZERO** | critical | 12–16 h |
| Prediction pipeline end-to-end fallback | **ZERO** (leaf modules tested, the wired path is not) | critical | 8–10 h |
| `customVocabStore.mergeRemote` (tombstones, delete-wins, 30-day prune) | **ZERO** | high | 6–8 h |
| Security rules | **ZERO** | high | 8–12 h |
| Auth / caregiver linking, both repos | **ZERO** | high | 6–8 h |
| Logger offline transition + bounds | partial — drop/retry tested, offline never exercised | medium | 3–4 h |
| Offline transitions (`NetworkContext`, `OfflineBanner`) | **ZERO** | medium | 2–3 h |
| Switch scanning | real and good (auto-scan timer untested) | low | 1 h |
| Speech output | real but narrow (interruption asserted by comment, not test) | low-medium | 2 h |

### TC-01 — utterance builder untested — CRITICAL
`AACBoardScreen.js:309-408` (`addWord`, `handleButtonPress`, `speakSentence`,
`removeLastWord`, `clearSentence`) and `EasySentenceBuilderScreen.js:109-137`.
No `@testing-library/react-native` in `package.json` at all.

### TC-02 — the two utterance builders are independent implementations — CRITICAL
Already diverged: `AACBoardScreen.js:373` calls `stop()` on clear;
`EasySentenceBuilderScreen.js:124` does not.

### TC-03 — the AI tier-fallback chain is untested end-to-end — CRITICAL
Wired inline at `AACBoardScreen.js:230-289`. Nothing proves that with TF.js
failed, network down and Vertex timed out, the user still has a working board.
That is non-negotiable #3.

### TC-04 — `useOnDevicePrediction.js` and `getAISuggestions.js` have zero tests
The paths actually wired into the screens. A separately-tested parallel
implementation (`improvedModelLoader`) covers similar maths but is not what runs.
`MODEL_VOCAB_SIZE = 21` clamping (`:46-53`) is never exercised.

### TC-08 — logger: offline branch never taken in any test
`isOnline` is only ever set by the untested `initLogger()` NetInfo callback, so
every existing test runs online. `MAX_CACHED_LOGS` (50) auto-sync and
`MAX_LOCAL_LOGS` (500) eviction are unexercised. Also flags the `logQueue` leak
on the direct-Firebase success path (`:196` vs `:208`).

### Shallow tests that inflate the count
- `src/__tests__/sanity.test.js:1-3` — literally `expect(1+1).toBe(2)`.
- `src/__tests__/auth.test.js:5-27` — re-implements `friendlyLoginError`,
  `friendlySignupError` and `EMAIL_REGEX` **inside the test** rather than
  importing them, so it can never catch a regression in `LoginScreen.js:21-27`.
  It proves the copy equals itself.
- dashboard `__tests__/Login.test.js:6-23` — asserts only that a controlled
  input updates its own value.
- dashboard `src/App.test.js:34-46` — `onAuthStateChanged` hardcoded to fire with
  `null` (`:21`), so no role branch is ever reached anywhere in the suite.

### Coverage instrumentation
**None, either repo.** No `collectCoverage`, no `coverageThreshold`, no
`jest.config.js`; the gate runs `npx jest --ci --silent` with no `--coverage`.
One-line fix: add `--coverage` to the gate's jest invocation.

---

## C. Structure (`repo-cartographer`)

Treat the line numbers in this section as approximate — this auditor ran on the
cheap model and several of its claims (notably a "flat `userLogs/{pushId}`"
reading and some file lengths) are contradicted by the data-contract audit, which
verified them. Where they disagree, the data-contract audit is correct.

- **Dead files:** `src/mocks/idb-mock.js`, `src/styles/commonStyles.js` — imported
  by nothing.
- **God files:** `AACBoardScreen.js` ~920 lines with 9 distinct responsibilities
  (grid, utterance bar, history, favourites, suggestions strip, scan
  orchestration, display/listener modals, voice picker, breadcrumbs);
  `aiProfileStore.js` ~500; `enhancedLogger.js` 418; dashboard
  `AdminDashboard.js` ~592 with 9 responsibilities.
- **Hardcoded RTDB paths** (should be `dbPath(DB_PATHS.X, …)`):
  `src/contexts/AuthContext.js:30`, `src/screens/ProfileScreen.js:56,57,58`,
  `src/screens/SignupScreen.js:64`, `src/screens/FeedbackScreen.js:19`,
  `src/utils/enhancedLogger.js:202,292,347`, dashboard
  `src/functions/index.js:15,52`.
- Cloud Functions rate limiting is an in-memory `Map` (`functions/index.js:55-69`)
  — per-instance, resets on cold start, does not survive horizontal scaling.
  Best-effort only.
- `VERTEX_MODEL` and `VERTEX_LOCATION` hardcoded (`functions/index.js:23,24`).
- No cache invalidation across screens when custom vocab changes
  (`customVocabStore.js`).

---

## D. Accessibility (`aac-accessibility-auditor`) — the most important audit here

All contrast ratios below were **computed arithmetically** from the literal hex
values in `src/theme.js` using the WCAG 2.2 relative-luminance formula, not
eyeballed. All touch-target sizes were computed from `StyleSheet` values at a
360dp reference width and 1× font scale.

**Headline:** the core board's *data* is motor-plan stable — vocabulary genuinely
never reorders by prediction (verified, see "good" list). But the board's
*pixels* are not: asynchronous prediction arrival physically pushes every
vocabulary button down the screen. Same injury, different mechanism.

### CRITICAL

**A11Y-01 — prediction arrival shifts every core button down ~110dp.**
`AACBoardScreen.js:720` renders the suggestion strip **in normal flow** above the
grid; `:550,:560` add two more action buttons once a word exists, wrapping the
action row. Computed: strip ≈61dp + wrapped action row ≈49dp = **≈110dp**.
Vocabulary button pitch is `minHeight:72 + margin:3×2` = **78dp**. So the board
moves **1.4 button rows** on the first tap — landing each button almost exactly
where a *different* button was. Worst possible displacement. WCAG 3.2.5.
Fix: reserve fixed heights for the strip and the action row (render an
equal-height placeholder when empty) so the grid origin never moves.

**A11Y-02 — the board shifts again as the utterance grows.** `:800-807` — the
sentence bar has `minHeight:32` and no ceiling; each wrap adds ~24dp. The board
drifts *continuously while composing*, penalising the most capable communicators.
Fix: fixed-height bar with internal scroll.

**A11Y-03 — opening History or Favourites moves the board ~275dp** (≈3.5 rows).
`:661-685`, `:688-717` render in flow, not as overlays. Fix: absolute overlay.

**A11Y-04 — switch scanning can speak a word the user did not select.**
`AACBoardScreen.js:122` keys suggestion scan items `sug-${i}` — **array index,
not word identity**. `switchScanService.js:33-39` `sameIds` therefore returns
true whenever a new prediction batch has the same *count* (routine —
`getBigramPredictions(lastWord, 4)` always returns 4), so `currentIndex` is kept
while every word underneath changes. An auto-scan user commits to a press when
they *see* the word; during their motor latency the word is swapped. **On a
communication device this is a safety defect, not a UX defect.**
Fix: key by content (`sug-${word}`) and reset on payload change, not just id
change.

**A11Y-05 — scan position resets to 0 on every async AI tier.** Suggestion count
grows 4 → 6 → 8 as tiers resolve; each change makes `sameIds` false →
`currentIndex = -1` → next advance lands on item 0. Home board is ~43 scan items;
at the 1500 ms default, returning to item 40 costs **60 seconds**, and
suggestions refresh after every word — so a switch user can realistically never
reach the second half of the board. Compounding: `setScanItems` resets
`currentIndex` **without `emitChange()`**, so the highlight lies about position
and a press in that window is silently discarded by the `currentIndex < 0` guard.

**A11Y-06 — there is no external switch input at all.**
`switchScanService.js:149-173` defines `handleScanKeyEvent`; it is imported
**only by its own test**. No global key listener anywhere. Every scan control is
an on-screen `TouchableOpacity`. *A user who can reliably tap a 44dp on-screen
"Select" does not need scanning; a user who needs scanning cannot press it.* The
feature as shipped serves no one while the UI advertises it.

### HIGH (selected)

**A11Y-08 — the user's speech rate and pitch are discarded on the core board.**
`speechService.js:25-33` — `applyPreset` returns `{...baseOptions, rate:
preset.rate, pitch: preset.pitch}`, **overwriting** the caller's values. Every
board speech path (`:320,:334,:347,:356`) passes `settings.speechRate` in and has
it thrown away; `voicePresets.normal` is `{rate:1.0,pitch:1.0}` and is the
default. A user who sets 0.5× gets 1.0×. Inconsistently, `repeatFromHistory:388`
and `speakFavourite:413` bypass `applyPreset` and *do* honour the setting — so
the same word speaks at different rates depending on route. Plain code defect.
Fix: treat presets as multipliers.

**A11Y-09 — TTS is not reliably interruptible and there is no stop control.**
`speechService.js:47-83` — `stop()` is gated on `isSpeaking`, which is only set
true inside the async `onStart` callback, so rapid taps skip the stop and
expo-speech **queues**. The only route to silence is `clearSentence`, which
destroys the utterance. A user who mis-speaks must delete their sentence to stop
it.

**A11Y-10 — a partial utterance cannot be edited, only backspaced or destroyed.**
`:484-488` renders sentence words as plain `<Text>`. To fix word 2 of 7 you must
delete five correct words. `EasySentenceBuilderScreen.js:185` already implements
per-word removal — the capability exists and is simply absent from the primary
surface.

**A11Y-11 — Clear is one tap, adjacent to Backspace, same colour, no undo.**
`:508-525` — both `palette.danger`, both 44×44, `gap: 5`, distinguished only by a
20px glyph. Destroys minutes of composition.

**A11Y-12 — OS font scaling has almost no effect on the board.** `:452-457`
`adjustsFontSizeToFit` + `numberOfLines={2}` inside a `minHeight:72` box shrinks
text *back down* to fit. A user at 200% system font gets labels auto-shrunk to
roughly their original size. Same at `QuickRepairOverlay.js:190`,
`ContextPackScreen.js:85`, `DisplayMode.js:77`. (Mitigating: no
`allowFontScaling={false}` anywhere — the intent is right, the mechanism defeats
it.)

**A11Y-13 — the scan highlight is invisible against the buttons it highlights.**
`:205` `#FF6600` 4px ring, sole indicator. vs noun `#FFE0B2` **2.31:1**; vs
pronoun `#FFF9C4` **2.74:1**; vs important `#FFCDD2` **2.09:1**; vs verb
`#C8E6C9` **2.18:1**; vs background `#FAFAFA` **2.81:1**; vs high-contrast border
`#FFD600` **2.08:1**. All fail 3:1. Orange-on-pastel-orange also collapses under
protanopia/deuteranopia — and switch users frequently have co-occurring visual
impairment.

**A11Y-14 — systemic contrast failure on every filled button, both themes.**
`theme.js:51-96`, `buttonText` is `#FFFFFF` in both. Light: primary `#2979FF`
**3.98**, info `#448AFF` **3.32**, danger `#D97575` **3.11**, accent `#7C8FCC`
**3.15**, success `#6BBF90` **2.22**, warning `#E8A070` **2.17**. Dark is
consistently *worse*: primary `#5C9AFF` **2.79**, danger `#E08080` **2.77**, info
`#6EAAFF` **2.37**, success `#7CC99A` **1.97**, warning `#EBAA7A` **1.99**,
accent `#8E9ED4` **2.63**. The dark accents were lightened for dark backgrounds
without re-checking the white foreground. `theme.test.js` asserts token
*presence* only, so this can never regress-fail.

**A11Y-15 — non-text contrast fails for every border/outline/chip, both themes.**
light `border #DDD9D4` vs `background #FAFAFA` **1.35:1**; `inputBorder` vs
`inputBg` **1.40:1**; `chipBg #EBF0F7` vs `surface #F2F4F7` **1.04:1**. dark
**1.41 / 1.50 / 1.27**. Also `AACBoardScreen.js:433` hardcodes `#DDD`: **1.27:1**
vs pronoun yellow. Button boundaries are effectively invisible — which matters
more here than usual, because boundary perception is how a low-vision user aims
at a grid cell.

**A11Y-16 — high-contrast mode destroys the Fitzgerald Key colour coding.**
`:423-424` flattens every button to `cardBg`/`#FFD600`. Text contrast becomes
excellent (12.48:1) but *all* part-of-speech differentiation is gone. The user
who most needs high contrast is the user who most depends on colour-block
wayfinding to find a word in a 36-cell grid.

**A11Y-17 — Quick Repair Overlay is unusable by a step-scan user on first open.**
`QuickRepairOverlay.js:150` gates the Next/Select controls on a **`useRef`**
assigned in an effect *after* render, which never triggers a re-render. First
open renders no scan controls; with no external switch (A11Y-06) there is no way
to reach Close either. This is the urgent-repair surface. One-word fix: `useState`.

**A11Y-18 — linear-only scanning, no row/column mode.**
`switchScanService.js:136-140` is a flat modulo advance. Last core word on the
home board = **36 steps × 1500 ms = 54 s**. Row/column would make it ~12 steps.
Single largest determinant of communication rate for a switch user.

**A11Y-19 — the utterance bar is never announced on iOS.** `:476`
`accessibilityLiveRegion="polite"` is Android-only and is the only live region in
`src/`; `AccessibilityInfo` is imported nowhere.

**A11Y-20 — EmotionScreen relocates the "I need…" grid on emotion select.**
`:248`, `:273` insert two whole sections above the NEEDS grid, which contains
`Help`, `Toilet`, `Stop`, `Medicine` — the highest-urgency items on the screen.
Their absolute position is unlearnable.

**A11Y-22/23/25 — urgent-phrase buttons fail contrast.** QuickRepairOverlay
(13px bold, so 4.5:1 applies): Wait `#FF9800` **2.16**, Yes `#4CAF50` **2.78**,
No/I-need-help `#F44336` **3.68**, Not-that `#FF5722` **3.16**, Say-that-again
`#2979FF` **3.98**, I-mean `#009688` **3.67**, Maybe `#607D8B` **4.37**. *Only
the two least urgent phrases pass.* ContextPackScreen the same, including
`urgent #F44336` **3.68**. EmotionScreen selected states 1.79–3.00.

**A11Y-24 — Delete Account consent text misdescribes what is destroyed.**
`ProfileScreen.js:38-40` promises *"Communication data on this device will not be
affected"* while `:69-85` clears `@aac_ai_profile`, `@aac_sentence_history`,
`@aac_favourites`, `@aac_custom_vocab`, `@aac_custom_vocab_deleted`,
`@aac_settings`. The user consents to one action and a materially different,
irreversible one happens — years of accumulated personalisation. `:92` then
reports unconditional success even when `:63-65`/`:86-88` swallowed failures.

**A11Y-26/27/28 — touch targets below the floor on core paths.**
`VoicePresetPicker.js:78-87` **36dp** (sits on the primary board);
`SettingsScreen.js:394-400` rate/pitch **39×46dp**; `:430-432` **43dp**;
`LoginScreen.js:177` / `SignupScreen.js:196` links **18dp** with no padding and
no hitSlop — below even the 24dp AA minimum, and one of them is "Forgot
password?"; `CameraScreen.js:410-419` speak button **24dp**, `:425` phrase chips
**33dp**. None carry `hitSlop`.

### MEDIUM (selected)

**A11Y-29** custom vocabulary does not appear until the user leaves and returns
to the board (`coreVocabulary.js:256`, `App.js:60`, `AACBoardScreen.js:89`).
**A11Y-30** deleting a custom word shifts every later custom word; `mergeRemote`
can also order custom words differently **between devices**.
**A11Y-31** `VocabManagerScreen.js:81-98` passes **7 buttons** to
`Alert.alert`; Android renders at most 3 — so a caregiver on Android cannot
approve a word into Social, Important or Other, and category drives the
Fitzgerald colour.
**A11Y-32** fixed `height` around scaling text clips at 200%
(`VocabManagerScreen.js:361,382`, `LoginScreen.js:173`, `SignupScreen.js:190`,
`FeedbackScreen.js:152`, `ProfileScreen.js:122`, `ContextPackScreen.js:132`);
absolute `lineHeight` with scaling `fontSize` at `InsightsScreen.js:306,310`,
`OnboardingScreen.js:145`.
**A11Y-33** `OnboardingScreen.js:15` calls `getPalette('light')` at **module
scope** — a high-contrast user gets the light palette on the first screen they
ever see, before Settings is reachable.
**A11Y-34** Speak/Backspace/Clear set `disabled` with **no disabled styling**;
`scanBar` has no `flexWrap` and overflows at raised font scale.
**A11Y-35** `DisplayMode.js:50-56` — the whole screen is one
`TouchableOpacity onPress={onClose}`, so any involuntary contact ends the display
while a partner is reading; not `accessible={false}`, so iOS may never read the
sentence out; no `accessibilityViewIsModal`; `SCREEN_W` read at module scope
despite `supportedOrientations`.

### Verified GOOD — do not re-check
1. **Core vocabulary never reorders by prediction, frequency or recency.** Every
   ranker (`getTopWords`, `getBigramPredictions`, `scoreWithExplanation`)
   terminates at `setSuggestions()`; none reaches `currentPage.buttons`.
2. Grid size is user-controlled only; no content condition reflows it; every core
   page holds exactly 12 buttons so no category can collapse.
3. Vocabulary touch targets are 72–111 × 72dp — comfortably past the floor.
4. **No timeouts, auto-dismissals or auto-advances anywhere.** All five
   `setTimeout`/`setInterval` sites are network aborts, a search debounce, or the
   scan interval itself. A user may take as long as they need.
5. Release-to-activate holds, and the AI tier-fallback chain genuinely degrades
   to a static local board with no network dependency.

### What the auditor could not verify
Rendered geometry is computed, not measured (±2dp on line boxes; the large shifts
are far outside that margin). No runtime or AT testing — nothing confirmed
against VoiceOver, TalkBack or a physical switch. Seven peripheral screens were
covered by a delegated checklist pass rather than read end-to-end. Reading level
and symbol comprehension need an SLT, not a code audit.

---

## E. Security and privacy (`firebase-security-auditor`) — verdict: do not ship

The structural problem, stated once: **the entire access-control model for
caregiver→user data is client-side JavaScript.** There is no server-side rule
anywhere in either repo that is aware of `role` or `caregiverId`. And the
checked-in `database.rules.json` has **never been deployed** — the checklist item
is unticked and the file was invalid until 2026-08-04 — so the ruleset actually
protecting production is looser than anything in version control.

### SEC-C1 — `setUserPassword` is a public, unauthenticated account-takeover endpoint — CRITICAL, certain
`dashboard/functions/index.js:17-39`. No `context.auth`, no Authorization header,
no role check, no rate limit, no App Check, and `cors({origin:true})` reflects any
origin. `firebase.json` points the functions codebase at `functions/`, so **this
is the deployed artefact**.
Attack: uids are rendered throughout the dashboard and appear in URLs
(`/user-actions/:userId`). `curl -X POST .../setUserPassword -d
'{"uid":"<adminUid>","newPassword":"x"}'` → sign in as that admin → read every
AAC user's activity log and every feedback submission. No credential needed at
any step.

### SEC-C2 — the "locked" copy is the one that isn't running — CRITICAL, certain
The hardened version with `if (!context.auth)` and the admin check lives in
`dashboard/src/functions/index.js` — the **CRA source tree**, not a functions
codebase — is imported by nothing, and **does not parse** (`node --check` fails
on typographic quotes at `:10`). `functions/index.js` parses cleanly. So
"locked-not-deleted" means the unlocked one is deployed and the locked one never
could be.

### SEC-C3 — a Google service-account private key is in the dashboard's git history — CRITICAL, certain
Added in `cdf18ec` (`credentials/serviceAccountKey.json`) and `8f9aa1e`
(`credentials/AdminSetting/serviceAccountKey.json`), removed in `dfe7429`.
Filenames only — the key was not opened and history was not touched, per §0.2.
`git rm` does not remove the blob: `git show <commit>:<path>` returns it to
anyone with clone access, including stale local clones and any fork. **An Admin
SDK service account bypasses every rule in this audit unconditionally.**
The only step that actually revokes access: GCP Console → IAM → Service Accounts
→ delete the **key ids**. Do that before anything else. History rewriting is a
separate decision and was deliberately not attempted.

### SEC-C4 — anyone can appoint themselves caregiver of any AAC user — CRITICAL, high
`dashboard/src/pages/Signup.js:143` lets the applicant pick their own role
client-side and `:50` writes it straight to the DB. `App.js:79` guards
`/connect-user` with `<ProtectedPage>` and **no `requiredRole`**, and
`PrivateRoute.js:29` implements exactly one branch (`requiredRole === 'admin'`) —
so a route without `requiredRole` admits every authenticated principal.
`ConnectUser.js:20` then lists **every user in the system** and `:42` claims one
by writing `caregiverId` into *their* profile. No invitation, no token, no
approval by the AAC user, no guardian confirmation, no notification.
Attack: self-register at the public `/signup`, toggle "Caregiver", pick a child
from a browsable directory of names and emails, open `/logs`. **Under a minute.**

### SEC-C5 — the dashboard downloads every user's logs and filters them in JavaScript — CRITICAL, certain
`Logs.js:64` queries the `/userLogs` root with `limitToLast(500)`, then
`if (!isAdmin) arr = arr.filter(...)` **in the browser**. `UserActions.js:36` is
worse — a live `onValue` on the whole root with no limit. The filter is a
rendering decision, not access control: F12 → Network shows the 500 most recent
entries across the entire platform. `/notifications` and `/caregiver` carry no
`requiredRole` at all, and `AuthContext.js:35-40` swallows a role-lookup failure
and lets the session through with `role: null`.

### SEC-H6 — a user can escalate their own role — HIGH, certain
`role` lives at `users/$uid`, which the user owns (`database.rules.json:6`), and
the validator explicitly permits `'caregiver'`. Any AAC user can run
`set(ref(db,'users/'+myUid+'/role'),'caregiver')` from the app's own session —
*authorized by design* — then sign in to the dashboard as a caregiver.
Note: a child `".write": false` under a parent that grants write does **not**
revoke it; RTDB write rules cascade downward and cannot be narrowed by
descendants. Moving `role` to a custom claim is the only working fix.

### SEC-H7 — `Login.js:44-54` hands out `admin` on a client-side race
The privilege decision is made in the browser from a read the browser controls
(`isFirstUser = !usersSnap.exists()`), and written by the browser. If `/users` is
ever emptied or made unreadable in a way that yields an empty object, the next
person to log in becomes admin.

### SEC-H8 — `$other: false` is present at three levels out of nine
Correct at `userLogs/$uid/$logId`, its `deviceInfo`, and `feedback/$uid/$entryId`.
**Absent** at `users/$uid` (any field; `caregiverId` — the authorization
primitive — has no `.validate` at all), `userSettings/$uid` (**no validation
whatsoever**: arbitrary tree, arbitrary depth, arbitrary size),
`customVocab/$uid` and its `items/$idx`, `userSync/$uid`, `vocabRequests/$uid`.
Attack: `set(ref(db,'userSettings/'+uid), <100 MB of JSON>)`. Nothing stops it.
Repeat across free anonymous accounts until the storage bill or the database-size
limit bites — a denial of service against a device people depend on to speak,
funded by the project.

### SEC-H9 — a user can forge log entries attributed to another user — HIGH, certain
`enhancedLogger.js:175` — `targetUserId = metadata.targetUserId || currentUser.uid`
— is caller-supplied and in `ALLOWED_LOG_FIELDS`. The rule validates it as a
string ≤128 chars with **no check that it equals `$uid`**. User A writes to their
own authorized `userLogs/A` with `targetUserId: B`; `UserActions.js:44` filters
the global tree by that field, so the forged entries appear on B's activity page
with an arbitrary `action` string. **In a safeguarding setting that is fabricated
evidence about a vulnerable person, presented to their caregiver as a system
record.** Fix: `".validate": "newData.val() === $uid"` and drop the field from
the client-settable list.

### SEC-H10 — the dashboard logger has no allow-list and lets the caller override everything
`dashboard/src/utils/logger.js:12-36` spreads `...metadata` **last**. Everything
also lands in `localStorage` unconditionally — including on the Firebase-failure
path — and is never cleared on sign-out. A shared clinic or school workstation
accumulates 200 entries of AAC users' uids, action text and timestamps for the
next person to use the browser.
**The app's allow-list was verified as correct**: `enhancedLogger.js:184-193`
spreads filtered metadata first and its own values after, `syncLogsToFirebase`
re-filters on the way out, and the only two call sites pass `{error: error.code}`.

### SEC-H11 — deletion misses 7 of 13 nodes and orphans data permanently on failure
`ProfileScreen.js:55-65` deletes six nodes. Not deleted: `feedback/{uid}` (name,
email, up to 5000 chars of free text), `sessions`, `favorites` (which contains
`fav.sentence` — **actual utterances**), `customBoards`, `archivedFeedback`,
`alerts` referencing the uid, and `userLogs/{caregiverUid}` entries carrying
`targetUserId === uid`. Worse, the `catch` swallows the failure and execution
proceeds to `deleteUser` at `:91` — once the Auth account is gone, every
remaining node is protected by `auth.uid === $uid` for a uid that can never
authenticate again. **Unreachable, undeletable, permanent.** UK GDPR Art. 17
failure with no recovery path.

### SEC-H12 — there is no way for a user to obtain their own data
No export exists anywhere in the app. The only export in the system is
`Logs.js:109-127` — a CSV **for caregivers about users**, landing unencrypted in
a Downloads folder. The data subject has the weakest access to their own record
of anyone in the system.

### SEC-H13 — no notice, no consent, no lawful basis for caregiver monitoring
One privacy link in `SettingsScreen.js:324`; no consent step in onboarding;
nothing tells the AAC user or a guardian that a caregiver can read their
activity — and because linking requires no action by the user (SEC-C4), they need
never learn a caregiver was attached. Art. 9 special-category data by
implication, no DPIA in `docs/`.

### SEC-H14 — retention is one function covering one path, and it fails silently
`functions/index.js:444-476`: `once('value')` on the whole `/userLogs` tree in
512 MB, no `maxInstances`, `catch` swallows the error and returns `null` so the
scheduler records success — **retention stops forever with no alert**. Nothing
prunes `feedback`, `vocabRequests` (whose **keys are the words the user tried to
say and could not find** — an unusually direct record of unmet communication
needs), `customVocab`, `userSync`, `sessions`, `favorites`, `alerts`, or
`archivedFeedback`.

### SEC-H15 — utterance-adjacent content is stored at paths nobody is tracking
`customVocab/{uid}` and `vocabRequests/{uid}` are hardcoded literals in
`customVocabStore.js` and appear in **neither** repo's `DB_PATHS`. So anything
that enumerates the schema — deletion, export, retention — misses them by
construction.

### SEC-H16 — utterance content and photos are processed in us-central1
`aiBackend.js:9-11` hardcodes the us-central1 base, and `functions/index.js:28`
sets no `.region()`, so all five functions default there. RTDB is europe-west1
and `VERTEX_LOCATION` is europe-west1 — but the function receiving the plaintext
is not. `aacPhraseSuggestions` gets the in-progress sentence and the last three
spoken phrases; the image endpoints get up to 5 MB of a photo of the user's
surroundings. Careful regionalisation undone by the proxy in front of it.

### SEC-H17 — seven RTDB paths the code uses have no governing rule
`alerts`, `favorites`, `customBoards`, `archivedFeedback`, `systemConfig`,
`fineTuneMetrics`, `sessions`. `Alerts.js:103-106` compounds it with a multi-path
`update(ref(db), updates)` issued against the **database root**.

### SEC-M19..M30 (condensed)
M19 `FeedbackAdmin.js:69-73` interpolates unvalidated `fb.email` into a `mailto:`
authority — a stored `&` injects headers (e.g. attacker `cc=`) — and puts 5000
chars of a user's free text into a URL that persists in shell history.
M20 archive replays attacker-controlled object shapes into an unruled path.
M21 writes target an arbitrary uid taken from a dropdown, re-verified nowhere.
M22 `systemConfig` is a globally-consumed config written by a client.
M23 **no App Check anywhere**, though `functions/index.js:53` relies on it in a
comment.
M24 rate limiting is a per-instance in-memory `Map`: effective limit is
`maxInstances × limit`, resets on cold start, and
`if (size > 10_000) clear()` lets an attacker with 10,001 free anonymous uids
**wipe everyone's counters**.
M25 `Access-Control-Allow-Origin: *` on every AI endpoint + free anonymous auth =
any web page can drive Vertex and Hugging Face on the project's bill.
M26 no `.indexOn` for the queries the dashboard runs.
M27 two function codebases both named `default` on one project — deploying from
either offers to delete the other's functions; the checklist records this
happening and being deferred.
M28 dashboard `.gitignore` does not cover `*service-account*.json`,
`google-services.json`, `GoogleService-Info.plist`, `*.keystore`, `*.jks`.
M29 `.env.example` carries a dead slot for a **billable** Vision key that no code
reads; `EXPO_PUBLIC_*` is inlined into the APK, so filling it in ships an
extractable billable key. Related: `docs/security/mobile-secret-remediation.md`
is **tracked** and contains a live Firebase Web API key in plaintext plus
prefixes of the HF and Vision keys, with rotation listed as required and no
evidence it happened.
M30 `storage.rules` has never been deployed, so the bucket is on defaults —
which, with anonymous sign-in enabled, is effectively open. The file itself is
well constructed; it is simply not in force. No shipped code uses Storage, which
is why this is Medium.

### Could not determine from here
The **currently deployed** RTDB ruleset, and whether the HF/Vision keys named in
`docs/security/mobile-secret-remediation.md` were ever actually rotated.

---

## F. Performance (`perf-profiler`)

**PERF-01 — HIGH — `import * as tf from '@tensorflow/tfjs'`** at
`useOnDevicePrediction.js:3` and `improvedModelLoader.js:1` pulls core +
converter + layers + data + cpu/webgl/wasm backends and defeats dead-code
elimination. `tfjs-react-native` peers only on core/cpu/webgl; the app only calls
`loadLayersModel`, so converter's graph machinery is dead weight. Unpacked:
`tfjs-data` 3.8 MB, `tfjs-backend-wasm` 13 MB, `tfjs-converter` 25 MB
(`measured`). Very likely the largest single contributor to the 7.1 MB bundle
(`estimated` — no per-module breakdown available offline).

**PERF-02 — LOW — `an-array-of-english-words` is dead weight.** Zero imports
anywhere; `index.json` is 3.36 MB. Metro does not ship it, so this is
`node_modules`/install/gate noise rather than bundle size. The changelog already
claims it was removed.

**PERF-04 — HIGH — the same TF.js model is loaded up to three times.**
`App.js:54` `loadImprovedModel()` at module scope, plus one
`tf.loadLayersModel` per `useOnDevicePrediction` mount — and that hook is used by
both `AACBoardScreen.js:67` (home tab, so at cold start) and
`EasySentenceBuilderScreen.js:36`. Two full parses and two warm-up inferences
compete for the JS thread in the first seconds; each personalised copy carries
its own Adam optimizer state once `recordTap` starts fine-tuning. **The two
screens' personalised models are never shared** — on-device learning on the board
does not transfer to the sentence builder.

**PERF-11 — MEDIUM — context provider values are built inline.**
`SettingsContext.js:110` and `AuthContext.js:52` construct a new object literal
every render, so every consumer of `useSettings()`/`useAuth()` — i.e. every
screen — re-renders whenever the provider re-renders for any reason, including
its own Firebase `onValue` firing with unchanged content. Standard `useMemo` fix,
low risk, app-wide blast radius for the bug.

**PERF-10 — HIGH (reliability) — `arasaacService.js` has zero caching.** No
AsyncStorage, no disk cache, no in-memory Map, no LRU. Every category switch and
every keystroke re-fetches. A symbol seen once is never available offline. The
screen does fall back to text chips so communication survives — but the symbol
experience degrades to text *every* time, permanently.

**PERF-14/15 — MEDIUM — the AI profile is unbounded and is `JSON.stringify`d on
the tap path.** `aiProfileStore.js:29-39` — `wordFrequencies`, `wordRecency`,
`bigrams`, `phraseFrequencies`, `hourlyActivity`, `failedSearches` have no
eviction. `getBigramPredictions`/`getTopWords`/`scoreWithExplanation` do a full
`Object.entries(...).sort(...)` **after every word selection**. And `maybeSave()`
(`:100-106`, `SAVE_INTERVAL = 10`) `JSON.stringify`s the entire profile
synchronously on every 10th tap. Cost grows with account age, not with session
length — which lands hardest on exactly the people who depend on this most.

**PERF-07 — LOW now, MEDIUM later — custom vocabulary is uncapped and lands on
the home grid.** `customVocabStore.js:168-186` just `.push()`es, unlike
`sentenceHistoryStore` (100) and `favouritesStore` (50). `getPage('home')`
appends all of it. The AI insights feature actively nudges caregivers to add
failed searches, so the home grid is the one list engineered to grow without
bound. `AACBoardScreen.js:779` also sets `removeClippedSubviews={false}` with no
`getItemLayout` — fine at 32–50 items, not at 500.

**PERF-13 — MEDIUM — side effects inside a `setState` updater.**
`AACBoardScreen.js:309-325` calls `recordWordSelection` and `recordTap` from
*inside* the functional updater passed to `setSentenceWords`. React may invoke an
updater more than once. No `StrictMode` today, so it is latent rather than live.

**PERF-17 — `initLogger()` is never called anywhere.** So `isOnline` stays at its
hardcoded `true` for the life of the app, and the reconnect-triggered resync
never runs. Confirmed by grep: zero call sites.

**PERF-08/18 — `EasySentenceBuilderScreen`** fetches ARASAAC at `_500.png` to
display at 60–80dp (≈36× the pixels needed), and fetches its 7 category
thumbnails **serially** in an `await`-in-loop instead of `Promise.all`.

**Verified good:** TF.js tensors are disposed correctly
(`useOnDevicePrediction.js:69,96-100`, `improvedModelLoader.js:36`); scan timers
and all context listeners are cleaned up; `App.js:53-60` correctly fires model
and profile loads without awaiting them; the main AAC board renders **no images
at all** (vector glyphs and text only), so the surface that matters most for
tap latency has zero image-decode cost.
