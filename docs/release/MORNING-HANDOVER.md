# Morning handover — commands to run yourself

Written 2026-08-05. Everything below is deliberately **not** run by the previous
session: each item either deploys, or is otherwise irreversible.

Project: `commai-b98fe`. Run from the repo root unless a step says otherwise.

Nothing here is committed. See "Uncommitted changes" at the bottom before you
start — you may want to commit first so a bad deploy is easy to reason about.

---

## Run order

1. Database rules — dry run, deploy, Playground (§1)
2. Storage rules — dry run, deploy, Playground (§2)
3. Functions redeploy (§3)

1 and 2 are independent of each other. 3 is independent of both but should go
last, because it is the one that ships a dependency change rather than a rules
change.

---

## 1. Database rules

```
firebase deploy --only database --dry-run --project commai-b98fe
firebase deploy --only database --project commai-b98fe
```

CLI is 15.17.0, so `--dry-run` is supported. Expect a rules-syntax check and a
success line naming the default RTDB instance. A failure names the offending line
— the same class of break as the old `newData.numChildren()`, which is not part
of the RTDB rules language and had silently invalidated this file since `f9eb808`.

**A dry run proves the file compiles, not that it behaves.** The Playground below
is the part that matters.

### 1a. Rules Playground

Get your UID: Console → Authentication → Users → copy **User UID**.

Console → **Realtime Database → Rules** → hard-reload the page so the editor shows
the *published* rules → **Rules Playground**.

For every case: Simulation type **write**, Authenticated **on**, Provider
**Password**, Firebase UID `<YOUR-UID>`. Nothing is persisted — `testId` and
`testEntry` never appear in your data.

- [ ] `/userLogs/<YOUR-UID>/testId` with
      `{"action":"playground_test","timestamp":1754300000000,"level":"INFO",`
      `"sessionId":"session_playground","carerId":"<YOUR-UID>",`
      `"targetUserId":"<YOUR-UID>",`
      `"deviceInfo":{"platform":"android","appVersion":"1.2.0"}}`
      → must **ALLOW**
- [ ] the same entry plus `"junkField":"should-be-rejected"` → must **DENY**
      *(this is the real test)*
- [ ] `{"action":"playground_test","timestamp":1754300000000,`
      `"deviceInfo":{"platform":"android","appVersion":"1.2.0","imei":"123456"}}`
      → must **DENY** (proves the nested `deviceInfo.$other` guard)
- [ ] `/feedback/<YOUR-UID>/testEntry` with
      `{"feedback":"playground test","timestamp":1754300000000}` → **ALLOW**;
      the same plus `"junkField":"x"` → **DENY**

**If junk is ALLOWED**, diagnose before reworking — most likely causes, in order:
the editor does not actually contain `$other` (deploy did not land); the Playground
is pointed at a non-default RTDB instance; or the auth toggle is off/admin. If all
three check out, `$other:false` is inert and **both** `userLogs` and `feedback`
need reworking — the per-field validators still hold, so the deploy stays, but the
"unknown fields are rejected" claim must be withdrawn and the real fix becomes
routing both writes through an Admin-SDK Cloud Function that whitelists
server-side.

### What changed about these cases since they were written

**Nothing in the cases themselves** — they are copied verbatim from
`deployment-checklist.md` §1a and are still correct.

What changed is the client behind them, and it changes how you read a failure:

- The `deviceInfo.imei` case (case 3) is now **doubly** guarded. `logEvent` filters
  metadata keys against `ALLOWED_LOG_FIELDS` before writing, and spreads that
  filtered metadata *before* its own fields, so the app can no longer produce an
  entry like that even if a caller tries. The Playground still tests the rule
  directly, which is the point — but a DENY here is now belt-and-braces rather
  than the only thing standing between a bad caller and a rejected write.
- **A DENY is no longer a device-wedging event.** Before 2026-08-05, one rejected
  entry stayed in AsyncStorage forever and blocked every later log sync on that
  device. `syncLogsToFirebase` now drops entries rejected by the rules and retries
  only transient failures. Verifying the rules is still worth doing; failing the
  verification is no longer catastrophic.

---

## 2. Storage rules

```
firebase deploy --only storage --dry-run --project commai-b98fe
firebase deploy --only storage --project commai-b98fe
```

**If the deploy errors that no bucket exists:** this is the first-ever storage
deploy and the default bucket was never provisioned. Console → Storage → **Get
started** → accept the default location, then re-run. The bucket location is
permanent, which is why that click is yours.

Regression risk is nil — re-confirmed 2026-08-05 that no `getStorage` /
`firebase/storage` import exists anywhere outside `node_modules`. No shipped code
path can be affected.

### 2a. Rules Playground

Console → **Storage → Rules → Rules Playground**. Locations are relative to the
bucket root.

| # | Type | Location | Auth | Payload | Expect | Proves |
|---|---|---|---|---|---|---|
| 1 | create | `/users/<YOUR-UID>/x.jpg` | UID `<YOUR-UID>`, provider Password | 1 MB `image/jpeg` | **ALLOW** | happy path |
| 2 | create | `/users/<YOUR-UID>/x.jpg` | same | 10 MB `image/jpeg` | **DENY** | 5 MB cap |
| 3 | create | `/users/<YOUR-UID>/x.jpg` | same | 1 MB `application/pdf` | **DENY** | image-only |
| 4 | create | `/users/someone-else/x.jpg` | UID `<YOUR-UID>` | 1 MB `image/jpeg` | **DENY** | ownership |
| 5 | create | `/users/<YOUR-UID>/x.jpg` | UID `<YOUR-UID>`, provider **Anonymous** | 1 MB `image/jpeg` | **DENY** | `sign_in_provider != 'anonymous'` |

Case 5 covers the least conventional line in the file. If the Playground has no
Anonymous provider option, record it as **unverified** rather than passed.

### What changed about these cases since they were written

Nothing. Phases 1–4 touched no storage code, no storage rules, and nothing that
reads or writes a bucket. Copied verbatim from `deployment-checklist.md` §1b.

---

## 3. Functions redeploy

Needed because `functions/package-lock.json` changed — `path-to-regexp` moved
`0.1.12 → 0.1.13`, closing GHSA-37ch-88jc-xwx2 (ReDoS, CVSS 7.5). One package
changed, nothing else.

```
firebase deploy --only functions --project commai-b98fe
```

Expect the five current functions to redeploy: `imageCaptionProxy`,
`aacPhraseSuggestions`, `imageToAACPhrases`, `ocrToAACPhrases`, `pruneUserLogs`.

**If it offers to delete `setUserPassword`, answer No.** It is deliberately
LOCKED-not-deleted: the `allUsers` invoker binding is removed and it returns 403
at the infra layer, but it must stay deployed until the dashboard's authenticated
replacement ships. See checklist §2a.

The Cloud Runtime Config deprecation warning should be absent — it came from the
stored `hf` / `vertex` values, which were unset on 2026-08-04. This deploy only
confirms that; it is not what removes it.

---

## Uncommitted changes

Nothing was committed. Eight modified files, no new files besides this handover:

| File | Change | Session |
|---|---|---|
| `database.rules.json` | `numChildren()` → named-field whitelist + `$other:false` | 2026-08-04 |
| `storage.rules` | 5 MB cap, image-only, non-anonymous, ownership | 2026-08-04 |
| `src/utils/enhancedLogger.js` | metadata whitelist (08-04) + poison-pill fix (08-05) | both |
| `src/__tests__/enhancedLogger.test.js` | 4 added tests: 2 whitelist, 2 drop/retry | both |
| `package.json` | `axios ^1.7.9 → ^1.19.0` | 2026-08-05 |
| `package-lock.json` | axios 1.13.6 → 1.19.0 + its deps | 2026-08-05 |
| `functions/package-lock.json` | `path-to-regexp 0.1.12 → 0.1.13` **plus a stray line, see below** | 2026-08-05 |
| `docs/release/deployment-checklist.md` | Phase 1–4 findings and gate results | both |
| `docs/release/MORNING-HANDOVER.md` | this file (new) | 2026-08-05 |

### Commit `functions/package-lock.json` in two pieces

That file carries one line that **predates both sessions** and is unrelated to any
work here:

```
@@ -1184,6 +1184,7 @@  node_modules/firebase-admin (12.7.0)
+      "peer": true,
```

Benign npm bookkeeping from some earlier install. It should go in its own commit
so the `path-to-regexp` security fix has a clean, auditable diff. Stage it
separately with `git add -p functions/package-lock.json`.

---

## Not in scope, still open

- **Dashboard repo** — untouched, separate session. `setUserPassword` stays locked
  until its authenticated replacement ships (checklist §2).
- **Device smoke test** — airplane-mode communication and account deletion, on real
  hardware (checklist §5).
- **Batch B** — root `npm audit fix`, deferred (checklist §8). No `--force`, ever:
  its only extra win is `postcss`, bought with `expo 54 → 57`.
- **§8 platform deadlines** — Node 20 → 22, `firebase-functions ^5 → ^6`. Recorded,
  not actioned.
- **versionCode 19 Metro failure** — did not reproduce; see checklist §4a. Treat as
  open until a `versionCode`-bumping build passes.
