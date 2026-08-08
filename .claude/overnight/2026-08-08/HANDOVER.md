# Overnight Run — 2026-08-08

## 1. DO THIS FIRST (2 minutes)

```
npx eas build --profile production --platform android
```

The release blocker is understood, reproduced, and already fixed — but no build
has confirmed it end to end, and that is the one thing only you can do. Before
you spend the minutes, if you want the local check:

```
node scripts/preflight.mjs          # ~1 min: npm ci, import sweep, gates, bundle
```

It ran green from a clean `npm ci` at the end of this session.

**Then, before you deploy anything to Firebase, read §5 and §6. There are two
things there you should know before you touch the console — one of them is live
right now.**

---

## 2. STATE OF THE TREE

- **Branch:** `overnight/2026-08-08/improvements` (both repos)
- **App:** baseline `7415345` → head `ae9d70b` · **16 commits**
- **Dashboard:** baseline `a7bec76` → head `84239ef` · **2 commits** (CI + docs only, no code)
- **Your pre-existing uncommitted work** is preserved on
  `overnight/2026-08-08/pre-existing-wip` in both repos — nothing was discarded.

**Gates, final run (all eight green, no skips):**

| Gate | Baseline | Now |
|---|---|---|
| `tsc --noEmit` | pass (vacuous — 0 TS files) | pass |
| eslint | 0 errors, 14 warnings | **0 errors, 14 warnings** |
| jest | 19 suites, 130 tests | **26 suites, 264 tests** |
| firebase rules | *did not exist* | **67 cases, all green** |
| import case + resolution | pass | pass |
| expo-doctor | 1 failing check | 1 failing check (8 packages behind SDK pins) |
| production bundle | 7,147,473 B | 7,171,xxx B (**+0.33%**) |
| `npm ls --all` | 4 invalid peer resolutions | 4 |

The +0.33% is the three flagged-off prototypes and the suggestion-strip change.

The whole diff also went through an independent review before the final commits.
It came back **block**, correctly, on a regression I had introduced — details in
§9. Three follow-up commits (`2cc68f8`, `8d796ed`, `ae9d70b`) address every
finding it raised.

**Safe to merge?** **Yes, with one caveat.** Everything is tested and gated, but
three changes touch the primary communication surface and could not be verified
on a device from here: the reserved-height suggestion strip, the theme colours,
and the scan focus ring. Open the board, tap two words, and toggle high contrast
before you merge. Nothing else needs eyes.

**Rollback:** `git reset --hard 7415345` (app) / `a7bec76` (dashboard). Nothing
was pushed. Phase tags exist at `overnight/2026-08-08/phase-{0,1,2,5,6}` for
partial rollbacks.

---

## 3. THE RELEASE BLOCKER

**Root cause: an import of a module that does not exist.**

```js
// src/screens/LoginScreen.js:12, at commit b8e817f
import { logEvent } from '../utils/logger';   // there is no src/utils/logger.js
```

`App.js:37` imports `LoginScreen`, so it is in the production module graph.
Metro resolves the whole graph before emitting anything, so the build dies:

```
Android Bundling failed 7529ms index.js (1050 modules)
Error: Unable to resolve module ../utils/logger from ...\src\screens\LoginScreen.js
```

A second instance sat in `src/hooks/useOnDevicePrediction.js`, which required
`assets/tf_model/model.json` when the real path is one directory deeper.

**It was NOT** `node_modules` drift. That was the previous session's hypothesis
and it is now disproven: I checked out the April tree, junctioned the *current,
healthy, reconciled* `node_modules` into it, and it still failed in 7.5 seconds.
It was also not case sensitivity, not the lockfile, and not Babel/Metro config —
`git diff b8e817f..HEAD` across every config file is **empty**.

**Fix:** already shipped, in your own commit `194a416` (2026-08-02). Nothing new
was needed.

**Confidence: high** that this is why the April tree cannot bundle — reproduced,
deterministic, 7.5 seconds. **Medium** that it is precisely what versionCode 19
hit, and the reason for the gap is worth stating plainly: nobody captured the
original EAS error. Nothing else in that tree can fail a Metro bundle *before*
this does, because Metro resolves the graph first.

**Verify with:** `node scripts/preflight.mjs` then the EAS build in §1.

**What now prevents it:** `scripts/check-import-case.mjs` resolves every relative
import the way Metro does and asserts exact on-disk casing, in under a second.
It is gate #5, it is a separate early step in CI, and it would have caught this
in April. Full write-up: `docs/release/metro-bundling-postmortem.md`.

---

## 4. WHAT CHANGED

**Accessibility** — the priority order says this outranks everything but the release.

- `1cc1bd2` The board no longer moves ~110dp (1.4 button rows) when the first
  prediction arrives. The strip now holds a fixed 66dp slot and the action row's
  width never changes.
- `31ff21c` Your speech rate and pitch are no longer discarded. `applyPreset`
  overwrote them; since `normal` is `{1.0, 1.0}` and is the default, anyone who
  set 0.5× was spoken at 1.0× on every board utterance. Presets now multiply.
  TTS is also reliably stoppable — `stop()` was gated on a flag only set by an
  async callback, so rapid taps queued utterances instead of replacing them.
- `5d8db1c` Switch scanning can no longer speak a word you did not select. Scan
  items were keyed by array position, so a new batch of predictions with the
  same count compared equal and the highlight stayed put while the word changed.
- `fdca526` Quick Repair scan controls now render on first open. A `useRef`
  gated them and never triggered a re-render, so a step-scan user was trapped on
  the urgent-repair surface.
- `30bc067` Twelve filled-button contrast failures fixed (worst was 1.97:1), all
  borders raised to 3:1, and the scan ring changed — `#FF6600` was 2.09:1 on the
  "important" fill and collapses entirely under red-green colour blindness.
  Every value was solved numerically and is now asserted by a test.
- `4c8f09f` `xxx` — the CHILDES marker for unintelligible speech — can no longer
  be offered as a suggestion and spoken aloud. The old filter tested for a string
  that does not exist in the tokenizer.

**Correctness and data integrity**

- `53e842a` Account deletion: the dialog no longer promises that on-device
  communication data is safe while deleting it; `feedback/{uid}` is now included;
  and a partial failure aborts instead of proceeding to delete the Auth account
  and stranding the rest forever.
- `e7cdf6a` Every online log was being written to Firebase **twice**, and the
  in-memory queue was never drained on a healthy session so it grew without
  bound. Both fixed, plus a 500-entry cap, drop warnings, and exponential
  backoff with jitter. `initLogger()` had zero call sites and is now called.

**Tooling and tests**

- `b2052f8` Gate suite, preflight, import-resolution check, `.env.example`, and
  a `PreToolUse` safety hook.
- `1e5231b` 67 emulator-backed security-rules tests. **Read §5.**
- `967e724` CI on every PR, both repos. No secrets, no deploy.
- `7aad9c6` Three prototypes behind flags, all OFF (§10).
- `b8a9684` Context provider values memoised — every screen re-rendered whenever
  a Firebase listener fired with unchanged content.

**After the review** (see §9)

- `2cc68f8` Restored the scan focus ring on suggestion chips — a regression I
  introduced — plus the NUL-byte strip and a source-hygiene test. Also stopped
  the disabled 0.4 opacity dimming the focus ring, since RN composites the
  border and `disabled` only blocks touch, not switch input.
- `8d796ed` Credential freshness is now checked **before** anything is deleted.
  `deleteUser` needs a recent sign-in, so on a device signed in for weeks the
  most likely outcome of "Delete Everything" was total data loss with the account
  intact.
- `ae9d70b` Three narrower windows: the logger entry is queued before the write
  and spliced on confirmation; a corrupt log store no longer escalates the sync
  backoff to its ceiling; superseded utterances can no longer clear the current
  one's speech flags; and the tab bar joined the contrast pass it had been left
  out of.

---

## 5. DATA CONTRACT CHANGES — REVIEW BEFORE DEPLOY

**No contract change was made.** No path, node, field or shape moved.

**But do not run `firebase deploy --only database` yet.**

The 67 new rules tests execute `database.rules.json` against the emulator, and
they prove three things that were previously only suspected:

1. **A *linked* caregiver is denied every read of their user's data.** There is
   no caregiver rule anywhere — every `.read` is `auth.uid === $uid`, and RTDB
   read rules cascade downward only.
2. **Six paths the dashboard uses have no rule at all** — `alerts`, `favorites`,
   `customBoards`, `systemConfig`, `fineTuneMetrics`, `sessions` — and fall
   through to the deny-all catch-all.
3. **`role: 'admin'` can never be written**, though both `schema.js` files export
   it and the dashboard writes it during first-user bootstrap.

Deploying these rules takes the caregiver dashboard **offline** — not degraded,
offline. And because every dashboard call site swallows the failure into an
empty state, it will look like a data problem rather than a rules problem.

Separately and independently: the dashboard reads `userLogs` as a flat map,
but the app moved to `userLogs/{uid}/{pushId}` in your commit `ed2d27f` on
2026-03-29. Every log row renders `undefined`, and `CaregiverDashboard`'s
"active today" is permanently 0 — a caregiver checking whether a non-speaking
person has communicated today is told *no* regardless of the truth. That has
been broken for four months.

The full plan, in the order the steps must happen (two are dangerous if
swapped), is `BACKLOG.md` items **B-1 to B-3**. `docs/DATA-CONTRACT.md` has
every path with its writer, reader, rule and growth story.

---

## 6. SECURITY — IMMEDIATE ACTION REQUIRED

Three items. The first two are live right now.

**S-1 — Revoke the leaked service-account keys. Do this before anything else.**
Two Admin SDK private keys remain in the **dashboard** repo's git history
(commits `cdf18ec` and `8f9aa1e`, later `git rm`'d — which does not remove a
blob). Anyone with clone access, any fork, any stale local clone can recover
them. An Admin SDK key **bypasses every security rule in this report
unconditionally**, so nothing else here matters while they are valid.

> GCP Console → IAM & Admin → Service Accounts → the account → Keys → **delete
> the key ids**. Deleting the key, not the file, is what revokes access.

I did not open the files and did not attempt history rewriting (§0.2). History
rewriting is a separate decision you can take calmly once the keys are dead.

**S-2 — `setUserPassword` is a public, unauthenticated account-takeover
endpoint.** `dashboard/functions/index.js:17`. No `context.auth`, no role check,
no rate limit, `cors({origin: true})`. uids are rendered throughout the
dashboard and appear in `/user-actions/:userId` URLs, so one curl sets any
account's password — including an admin's.

You had marked this "locked, not deleted". The lock does not exist: the hardened
version lives in `dashboard/src/functions/index.js`, which is the **CRA source
tree**, not a functions codebase; nothing imports it; and it fails `node --check`
on typographic quotes. **The locked one is the one that is not running.**

**S-3 — a user can promote themselves to caregiver.** `role` lives at
`users/{uid}`, which the user owns and can write, and the validator explicitly
permits `'caregiver'`. One authorised write from the mobile app's own session,
then sign in to the dashboard. Fix is to move `role` to an Auth custom claim —
note that a child `".write": false` cannot narrow a parent that grants write, so
moving the node is the only thing that works.

Also worth knowing, not immediate: anyone can self-register at the public
`/signup`, toggle "Caregiver", and claim any unclaimed AAC user from a browsable
directory of names and emails, in under a minute, with no notification to
anyone. That is `BACKLOG.md` C-3 and it needs a product decision, not a patch.

---

## 7. DECISIONS I MADE ON YOUR BEHALF

1. **[D-003] Overturned the previous session's root-cause hypothesis.** It
   recorded `node_modules` drift as the probable fix for versionCode 19. I
   disproved it by reproducing the failure against a healthy tree. A wrong
   explanation left standing costs the next investigator a morning.
2. **[D-012/D-013] Did not touch `database.rules.json`.** It is the security
   boundary, the fix is large, and I could not run the app to see the
   consequences. Wrote the tests that specify the fix instead, and made the
   handover say "do not deploy".
3. **[D-005] Gated pre-existing failures on "not worse" rather than zero.**
   `.npmrc` sets `legacy-peer-deps` and TF.js declares unsatisfiable peers, so
   four invalid resolutions are the correct steady state. Gating on zero would
   mean gating on a TF.js major bump.
4. **[D-014] Reserved permanent vertical space for the prediction strip.** It
   costs a little screen height when there is nothing to suggest. Motor planning
   is worth more than the pixels.
5. **[D-015] Solved the palette numerically, not by eye,** and kept
   `buttonText: '#FFFFFF'` by darkening the accents rather than flipping the ink
   — that left all 68 call sites untouched.
6. **[D-016] Made a partial deletion failure abort** instead of completing. A
   user on a flaky connection previously got a success message and an orphaned,
   permanently unreachable copy of their data.
7. **[D-018] Wired none of the three prototypes into a screen.** Each needs a
   device test on the communication surface first.
8. **[D-002] Created the `commai-aac` skill** — `.claude/skills/` did not exist,
   so the agent fleet had nothing to preload.
9. **[D-011] Reordered the logger's fast path** so entries are queued only when
   the direct write fails. This changes behaviour on the success path; it is the
   fix for a double-write, and the tests cover both paths.
10. **[D-004] Accepted that the safety hook is inert this session** and worked
    under manual discipline instead. See §9.

Full reasoning and rejected alternatives for each: `LEDGER.md`.

---

## 8. WHAT I DELIBERATELY DIDN'T TOUCH

`BACKLOG.md` has all of it, scored. The headlines:

**Tier B — prepared, not applied.** The rules rewrite and caregiver read tier
(B-1); the dashboard's `userLogs` path shape (B-2); `.indexOn` (B-3 — note that
opening reads *before* this lands turns a permission error into a 262 MB
transfer per page load); the `pruneUserLogs` OOM (B-4); the two Firebase
codebases both named `default`, which means a deploy from the dashboard deletes
all five app functions (B-5); History/Favourites panels shifting the board 275dp
(B-6); sub-44dp touch targets (B-7); word-by-word utterance editing (B-8).

**Tier C — needs you.** Key revocation and `setUserPassword` (§6); how caregiver
linking should actually work; whether `customVocab` or `customBoards` is the
canonical board surface (a caregiver currently builds a board, gets a success
toast, and it never reaches the device); Expo SDK patch drift; App Check;
Cloud Functions running in us-central1 while the data lives in europe-west1.

**One finding worth its own line.** Tier 1 — the on-device LSTM, the reason
eight `@tensorflow/*` packages are in the bundle — **contributes nothing at
runtime**. It never loads (`json` is in `assetExts`, so `require('model.json')`
returns an asset id); if it loaded it would decode through the wrong index space
(1 of 21 classes matches `vocab.js`); and the weights are near-uniform anyway —
79% of contexts produce the same five pronouns. Every failure is silent, masked
by the bigram fallback. Before fixing it, decide whether to retrain or delete;
and do **not** fix the loading bug alone, because that ships a 100–400ms
JS-thread stall on every fourth tap. `BACKLOG.md` B-10 and B-11.

---

## 9. WHAT BROKE / WHAT I COULDN'T FIX

- **The safety hook took hours to arm, then blocked me.** I wrote
  `.claude/hooks/guard.mjs`, registered it, unit-tested all ten rules across
  fifteen commands — and then a live `firebase deploy --dry-run` sailed straight
  through, so I recorded it as inert and worked under manual discipline instead.
  Hours later it arrested one of my own commands: a heredoc writing
  documentation that happened to contain the words `firebase deploy`. So it
  works, it enforces on text as well as intent, and **it is live in this repo
  now.** When you run the morning deploys it will block them from inside Claude
  Code — run those from a plain terminal. It also blocks `eas build` and
  `eas submit`. To remove it, delete `.claude/settings.json`; every rule in
  `guard.mjs` is commented with why it exists.
- **The Firebase emulator needs Java, and your machine has none.** I downloaded
  a portable JDK 21 into a scratch directory to run the rules suite — that is
  gone now, and the gate will report `SKIP … UNVERIFIED` for you rather than
  fail. To run them yourself:
  `winget install --id EclipseAdoptium.Temurin.21.JDK` then `npm run test:rules`.
  CI already installs a JDK.
- **`@firebase/rules-unit-testing@5.x` broke the dependency tree** (it peers on
  `firebase ^12`, you are on `^11`). The tree gate caught it within a minute; I
  reverted to 4.0.1. Worth noting because it is exactly the §2.C hazard: a root
  install moving the tree underneath you.
- **My first expo-doctor baseline was wrong.** The first `CI=1` run reported
  18/18 passing; that was a cache artefact and the true state is 1 failing check
  (8 packages behind their SDK pins). Corrected in
  `scripts/gates.baseline.json`, with the reason recorded in the file.
- **I broke something and the review caught it.** Worth reading, because it is
  the most instructive thing that happened tonight. Commit `5d8db1c` changed the
  switch-scan item id from `sug-0` to `sug-want` to stop the scanner speaking the
  wrong word — and left the chip renderer still asking for `sug-0`. Result: the
  focus ring became unmatchable, so a switch user got **no visible focus at all**
  across the whole suggestion block. A commit whose entire purpose was preventing
  a switch user from activating something they had not seen selected shipped, for
  three commits, with the indicator for those exact items dead.

  Every gate was green throughout. Nothing tests that a rendered element's id
  matches the scan item's id — a convention held in two places by memory. The fix
  (`2cc68f8`) puts it in one exported helper used by both. The lesson is not
  "review is useful"; it is that a convention duplicated across a boundary is a
  bug waiting for someone to fix the other half.

- **A NUL byte reached `switchScanService.js`** during editing, inside a template
  literal where it was functionally invisible: jest passed, eslint passed, the
  production bundle built. It would have shipped. Stripped, and
  `src/__tests__/sourceHygiene.test.js` now fails on any control character in any
  source file. I do not know exactly which edit introduced it, which is itself
  the reason the test exists.

- **Nothing was reverted, and no test was weakened, skipped or deleted.**
  Test count went 130 → 264.
- **Not verified on a device.** No screen was rendered. The three
  communication-surface changes in §2 are the ones to look at.
- **Batch B dependency updates were not attempted.** The one dependency change
  I did make immediately turned the tree gate red, which was a fair warning
  about doing more of them unattended with no device to test on.

---

## 10. FLAGS I ADDED (all default OFF)

In `src/config/featureFlags.js`. Turn one on by setting it `true` there and
rebuilding, or `setFeatureFlag('name', true)` in a dev build. No persistence and
no remote config, deliberately — a flag that changes underneath the user is a
liability in a device someone speaks with. **None is wired into a screen**, so
turning one on today changes nothing; wiring is 0.5–1 day each.

| Flag | What it enables | How to judge it |
|---|---|---|
| `utteranceRecovery` | The in-progress sentence survives a crash or low-memory kill. 30-minute expiry, device-local, never synced. | Force-kill mid-sentence and relaunch. Success is the sentence returning intact. The failure to watch for is the opposite one: a stale draft restored into a *new* conversation is worse than no draft. |
| `rateMetrics` | Words per minute and keystroke savings — the two measures AAC is clinically evaluated on and the two you collect neither of. Counts and milliseconds only, never words. | Run a fortnight on one consenting user. If the WPM curve does not move when you change something you believe helps, the metric is not measuring what you think. Keep it if an SLT says the numbers match their judgement. |
| `activationLockout` | Post-activation window so a tremor cannot double-fire a word. First press always fires instantly. | Needs a user with a tremor, not a simulation. Success is fewer duplicated words with **zero** rejected deliberate presses. If you find yourself raising it past ~500ms, the real answer is dwell-to-select. |

---

## 11. TOP 10 IDEAS WORTH YOUR TIME

From `IDEAS.md` (36 in total), ranked by value per day of work.

1. **Fringe vocabulary acquisition** — `vocabRequests/{uid}` already records
   every word the user searched for and could not find. Nothing reads it. That
   node is a list of things this person wanted to say. ~2d.
2. **Word-by-word utterance editing on the main board** — fixing word 2 of 7
   currently costs five deletions of correct words, and the Sentence Builder
   already does it. ~1d.
3. **Rate enhancement metrics** — prototyped; 1d to wire up. Without it nobody
   can answer "is this working?".
4. **Crash-safe utterance recovery** — prototyped; 0.5d to wire up.
5. **Emergency phrases in one tap from any board state** — the Quick Repair FAB
   is close, but its contents are conversational repair, not urgency. ~1d.
6. **Private mode** — an utterance that is never logged. The user is entitled to
   say something their caregiver does not get to read later. ~1d.
7. **Never-used vocabulary report** — dead buttons are pure cognitive load on
   every scan; the data already exists and SLTs will act on it. ~2d.
8. **User-facing history and deletion** — a caregiver can export someone's
   communication in one click and that person cannot see any of it. ~2d.
9. **Prediction acceptance rate, fixed and fed back into ranking** — currently
   it can report over 100% and is shown to clinicians. ~2d.
10. **Symbol cache on disk with a bounded LRU** — ARASAAC is fetched fresh every
    single time, so a symbol seen a hundred times is still unavailable offline.
    ~2d.

---

## 12. RECOMMENDED NEXT SESSION

In this order. The first three are not optional and the ordering of 4–6 matters.

1. **Revoke the service-account keys** (§6 S-1). Ten minutes, and nothing else
   is real until it is done.
2. **Remove `setUserPassword` and redeploy functions** (§6 S-2).
3. **Run the EAS build** and confirm versionCode 20 bundles. If it does, close
   the release blocker properly in `deployment-checklist.md` §4a.
4. **Fix the dashboard's `userLogs` read shape and add `.indexOn`** (B-2, B-3).
   Both repos, one commit.
5. **Then** rewrite the rules with a caregiver tier driven by a custom claim,
   using the existing 67 tests as the specification — flip the linked-caregiver
   case to `assertSucceeds` and keep the unlinked one failing. That pair is the
   whole boundary. (B-1)
6. **Then** deploy database and storage rules.
7. Decide `customVocab` vs `customBoards` (C-4). Until you do, disable the
   CustomBoards page rather than leaving a caregiver believing they have
   configured a board that never reaches the device.
8. Install a JDK so `npm run test:rules` runs locally, and wire the parity check
   between the two `schema.js` files into the gate suite.

A note on where the value was tonight: the release blocker took twenty minutes
because the answer was a static check nobody had written. The remaining six
hours found that the caregiver half of this product does not work and has not
for four months. If there is one habit worth taking from this run, it is that
the rules and the dashboard need a test that executes them, not a checklist that
describes them — because the checklist passed every time.
