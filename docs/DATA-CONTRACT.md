# CommAI — Realtime Database data contract

**Owner:** this repo. `database.rules.json` lives here and is the only place
rules are deployed from; the dashboard's `firebase.json` has no `database` block.

**Status as of 2026-08-08:** the contract is **broken in production**. The
dashboard reads `userLogs` at a path shape the app stopped writing on
2026-03-29, and no rule anywhere grants a caregiver or admin read access to
anything. Both statements are verified, not inferred — the second by 67
emulator-backed tests in `test/rules/`. Read
`.claude/overnight/2026-08-08/BACKLOG.md` items B-1 to B-3 before changing
anything here.

Project `commai-b98fe`, RTDB in `europe-west1`.

---

## The rule that matters

A path renamed in one repo and not the other is not a refactor. It is a
production outage in a product that is somebody's voice. Any change to a path,
node name, field name or shape must:

1. be **additive**, with a read path that still understands data already written
   in the old shape;
2. land in **both repos in the same change**;
3. be flagged in the handover under `## DATA CONTRACT CHANGES — REVIEW BEFORE DEPLOY`.

---

## Paths

| Path | Shape | Written by | Read by | Rules | Growth | Retention |
|---|---|---|---|---|---|---|
| `users/{uid}` | `{name, email, role, createdAt, caregiverId?}` | app `SignupScreen.js:64`; dash `Signup.js:50`, `Login.js:49`, `ConnectUser.js:42`, `UserManagement.js:57,68` | app `AuthContext.js:30` (own role only); dash, ~13 call sites, all reading the **collection root** | owner-only R/W (`:3-11`). `role` validator rejects `'admin'`. **No rule permits reading the root.** No `$other` guard, and `caregiverId` — the authorisation primitive — has no validator at all | 1 record/user, ~150 B | none; deleted on account deletion |
| `userSettings/{uid}` | `{theme, gridSize, contrast, speechRate, speechPitch, speechVoice}` | app `SettingsContext.js:101` (whole-object `set`) | app `SettingsContext.js:62`; dash `UserSettings.js:26` | owner-only R/W (`:13-18`), **no field validation of any kind** | 6 keys, ~120 B | none; deleted on account deletion |
| **`userLogs/{uid}/{pushId}`** | `{action, timestamp, level, sessionId, targetUserId, carerId, synced?, syncTimestamp?, serverTimestamp?, count?, error?, deviceInfo{platform, appVersion}}` | app `enhancedLogger.js:202` (live), `:297` (batch), `:347` (`logs_synced`) | CF `pruneUserLogs`. **The dashboard reads the wrong shape — see below.** | strictest node in the DB (`:55-81`): closed `$other` whitelist, per-field validators. **No `.indexOn`** | ~350 B/entry | 30 days via `pruneUserLogs` — conditionally, see B-4 |
| ~~`userLogs/{pushId}`~~ (flat) | — | dash `utils/logger.js:24`, `TestSystem.js:61` | dash `Logs.js:64`, `Notifications.js:59`, `AdminDashboard.js:84`, `CaregiverDashboard.js:175`, `UserActions.js:36` | **collides with `userLogs/$uid`; every write and read is denied** | zero | n/a |
| `userSync/{uid}` | `{lastActivity: ISO-8601 **string**}` | app `syncStatus.js:21` | dash `SyncStatusCard.js:35` | owner-only (`:48-54`) | ~60 B | none |
| `feedback/{uid}/{pushId}` | `{name, email, role, feedback, timestamp}` | app `FeedbackScreen.js:19` | dash `Feedback.js:24`, `FeedbackAdmin.js:24` | validated, but **`.read: false` unconditionally** (`:82-95`) | user-paced, ≤5 KB/entry | none; **now** deleted on account deletion (was not before 2026-08-08) |
| `customVocab/{uid}` | `{items: [{id, word, category, source, createdAt, updatedAt}], deletedIds: {id: ts}}` | app `customVocabStore.js:286` (whole-object `set`) | app `customVocabStore.js:92` | well validated (`:19-38`) | grows with vocabulary; `deletedIds` never compacted | none; deleted on account deletion |
| `vocabRequests/{uid}/{term}` | `{[term]: count}` | app `customVocabStore.js:264` | app `customVocabStore.js:232,260` | validated (`:39-47`) | one key per distinct missing term, forever | none; deleted on account deletion |
| `alerts/{caregiverId}/{pushId}` | `{userId, type, trigger, timestamp, read}` | **nobody** | dash `Alerts.js:49`, `Layout.js:88`, `AdminDashboard.js:109` | **no rule → denied** | zero | n/a |
| `favorites/{uid}/{pushId}` | `{sentence, usageCount, lastUsed, category}` | **nobody** (the app's `favouritesStore.js` is AsyncStorage-only) | dash `Favorites.js:39` | **no rule → denied** | zero | n/a |
| `customBoards/{uid}/{boardId}` | `{name, color, words, createdAt, updatedAt}` | dash `CustomBoards.js:118,123` | dash `CustomBoards.js:52` **only** | **no rule → denied** | per caregiver edit | none |
| `archivedFeedback/{uid}/{pushId}` | copy of a feedback entry | dash `FeedbackAdmin.js:82` | **nobody** | **no rule → denied** | write-only accumulator of PII | none |
| `systemConfig` | singleton config object | dash `SystemSettings.js:53` | dash `SystemSettings.js:39` **only** | **no rule → denied** | fixed | none |
| `fineTuneMetrics/{pushId}` | `{epoch, loss, accuracy, timestamp}` | **nobody** | dash `FineTuneMetrics.js:31` | **no rule → denied** | zero | n/a |
| `sessions/{uid}/{id}` | undefined | **nobody** | **nobody** | **no rule → denied** | zero | phantom path; declared in both `schema.js` and asserted by a test |

`customVocab` and `vocabRequests` appear in **neither** repo's `DB_PATHS` — they
are hardcoded string literals. That is why anything enumerating the schema
(deletion, export, retention) has historically missed them.

---

## Known contract breaks

**CB-1 — `userLogs` shape.** App commit `ed2d27f` (2026-03-29) moved logs to
`userLogs/{uid}/`. The dashboard's last schema alignment was `b383ccd`, ten days
earlier, and it still reads a flat map. `Logs.js:72` spreads
`([id, log]) => ({id, ...log})`, so `log.action` and `log.timestamp` are
`undefined` and `orderByChild('timestamp')` sorts uid buckets rather than
entries. `CaregiverDashboard.js:197` computes `new Date(undefined)`, so "active
today" is permanently 0 — a caregiver checking whether a non-speaking person has
communicated today is told *no* regardless of the truth. **The app and the rules
are correct; the dashboard is wrong.**

**CB-2 — no caregiver read tier.** Every `.read` is `auth.uid === $uid`. RTDB
read rules cascade downward only, so a rule at `users/$uid` does not authorise
reading `users`. Verified by `test/rules/database.rules.test.js`: a *linked*
caregiver is denied.

**CB-3 — `role: 'admin'` cannot be written.** Both `schema.js` files export
`ROLES.ADMIN`; the validator permits only `user|caregiver`. Note that simply
adding `'admin'` would let **any user promote themselves**, because
`users/{uid}` is client-writable. `role` needs to move to an Auth custom claim.

**CB-4 — field semantics.** `logs_synced.count` means **entries successfully
written**, not entries attempted. It changed meaning when `syncLogsToFirebase`
moved from `Promise.all` to `Promise.allSettled` on 2026-08-05. Nothing reads it
today, which is why nothing broke — and why the definition needs writing down
before someone builds a tile on it. `attempted` and `dropped` should be added
alongside it so permanently dropped entries leave a durable trace.

**CB-5 — `userSync.lastActivity` is the only ISO-8601 string** in a system where
every other timestamp is epoch milliseconds. Consistent end to end today; the
hazard is a well-meaning normalisation, which the `isString()` validator would
reject while `syncStatus.js:25` swallows the error into a `console.warn`.

---

## Changes made on 2026-08-08

**None to the contract.** No path, node name, field name or shape was changed.
`feedback/{uid}` was added to the *deletion* list in `ProfileScreen.js`, which
removes data the user already owned and could already write — that is a
completeness fix, not a schema change.
