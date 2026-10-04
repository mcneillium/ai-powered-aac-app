# Deployment Checklist — Voice (AAC app)

Updated 2026-08-02. Complete the **Backend** section before shipping any
client build — the client now depends on authenticated Cloud Functions.

## 0. Security prerequisites (blocking — do these first)

- [x] Revoke both leaked Firebase Admin SDK keys in GCP IAM
      (`firebase-adminsdk-fbsvc@commai-b98fe`, key ids `1136dd44…`, `f0aff750…`),
      then purge them from the dashboard repo history (`git filter-repo`).
      Done 2026-08-04 — a third, unrecognised key on the same service account
      was also revoked; that account now holds **zero** keys.
- [x] Revoke the old Hugging Face token (`hf_NHyU…`) and Google Cloud Vision key
      (`AIzaSyD4WZ…`) if not already done.
- [x] Create a fresh HF token and store it as a Functions secret:
      `firebase functions:secrets:set HF_TOKEN`
      Done — `HF_TOKEN` versions/1 exists, access granted to the appspot SA.
- [x] Enable the **Anonymous** sign-in provider in Firebase console
      (guests need it for the authenticated AI endpoints).
- [x] **NEW (found 2026-08-04) — a third HF token is sitting in Cloud Runtime
      Config in cleartext.** `firebase functions:config:get` returned
      `hf.token = hf_Uqaz…` alongside `vertex.project_id`. This was *not* the
      Secret Manager copy; no current source reads it (`functions/index.js`
      uses `process.env.HF_TOKEN`).
      Done 2026-08-04 — `hf_Uqaz…` revoked, `hf` and `vertex` unset from Runtime
      Config. The live token is the Secret Manager `HF_TOKEN` (value ending
      `lUfm`), confirmed to be a different, still-valid token.
- [x] **Close public access on the three legacy endpoints** — see §2a.
      Done 2026-08-04. `generateQuickPage` and `cleanupLegacyLogs` deleted
      outright; `setUserPassword` had its `allUsers` invoker binding removed and
      now returns 403 at the infra layer (verified), but is deliberately **not**
      deleted — see §2a.

**Section 0 is closed.** No known live credential exposure remains in this repo
or its deployed surface.

## 1. Backend deploy (app repo)

- [x] `cd functions && npm install`
- [x] `firebase deploy --only functions` — deploys the authenticated AI
      endpoints, removes `cleanupLegacyLogs`
      Done 2026-08-04 — `imageCaptionProxy`, `aacPhraseSuggestions`,
      `imageToAACPhrases`, `ocrToAACPhrases`, `pruneUserLogs` all updated.
      Three functions were offered for deletion and **deferred**; see §2a.
- [ ] `firebase deploy --only database` — deploys rules incl. the new
      `feedback` section.
      Was blocked: `newData.numChildren()` is not part of the RTDB rules
      language, so the file had never validated since commit `f9eb808`.
      Rewritten 2026-08-04 as an explicit field whitelist + `$other: false`.
      Dry-run first: `firebase deploy --only database --dry-run --project
      commai-b98fe`. **A dry run proves the file compiles, not that it behaves**
      — the whitelist must then be confirmed in the Rules Playground, see §1a.
- [ ] `firebase deploy --only storage` — first-ever deploy of storage.rules;
      verify bucket access afterwards, see §1b.
      Regression risk is nil: no `getStorage` / `firebase/storage` import exists
      anywhere outside `node_modules` (re-confirmed 2026-08-04), so no shipped
      code path can be affected by these rules.
- [x] Verify with no Authorization header the AI endpoints return 401
      Confirmed — returns 401 "Missing Authorization header".
- [ ] (Recommended) Enable Firebase App Check for a second abuse layer

## 1a. Verifying the database rules whitelist

The `userLogs` and `feedback` blocks both rely on `"$other": {".validate": false}`
to reject unlisted fields. Nothing in a deploy proves that works. After deploying,
hard-reload Console → Realtime Database → Rules so the editor shows the *published*
rules, open the Rules Playground, and run these as **write**, authenticated,
provider Password, UID `<YOUR-UID>`. Nothing is persisted.

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

### Client coupling — done 2026-08-04, hardened 2026-08-05

`logEvent(action, metadata)` used to spread `...metadata` straight into the log
entry, so any future caller passing an unlisted key would have its write rejected.
`src/utils/enhancedLogger.js` now filters metadata through `ALLOWED_LOG_FIELDS`
(the 12 names the rules permit) before writing, in both `logEvent` and
`syncLogsToFirebase`. Regression tests in `src/__tests__/enhancedLogger.test.js`.

Spread order verified 2026-08-05 (`enhancedLogger.js:163-172`): filtered metadata
spreads **first**, so `action` / `timestamp` / `deviceInfo` and the other fields
`logEvent` owns always win over anything a caller supplies.

Call sites audited 2026-08-05. Repo-wide, only three files reference `logEvent` at
all — `src/utils/enhancedLogger.js` (definition), `src/__tests__/enhancedLogger.test.js`,
and `src/screens/LoginScreen.js`. Production call sites are exactly two:
`LoginScreen.js:54` (no metadata) and `LoginScreen.js:60` (`{ error: error.code }`,
whitelisted). The `logger.debug/info/warn/error` wrappers at
`enhancedLogger.js:355-358` have **no callers**. There is no `src/utils/logger.js`
— `docs/audit/mobile-audit.md:177` still names one, and that reference is stale.
**The claim that production only ever sends `error` as a metadata key is
confirmed**, so the rules deploy is safe regardless of client version.

### Poison-pill fix — done 2026-08-05 (blocking, found in Phase 1a)

Filtering metadata narrowed the entry point but did not remove the failure mode.
Traced in the pre-fix `syncLogsToFirebase`: on a `PERMISSION_DENIED` rejection the
function left the entry **in AsyncStorage for the next sync** — answer (c), not
(a) drop or (b) bounded retry. `await Promise.all(promises)` rejected on the first
bad entry, the `AsyncStorage.setItem(...[])` clear on the next line never ran, and
the `catch` returned `false` under the comment *"If there was an error, keep the
logs locally"*. A rules rejection is deterministic, so that entry would fail
identically forever and block every later log on that device. Confirmed poison
pill.

Fixed: `Promise.all` → `Promise.allSettled`, with per-entry disposition.
Entries rejected by rules (`isPermissionError`, matching `PERMISSION_DENIED` /
`permission-denied` / `permission_denied` on `error.code` plus a message fallback)
are **dropped**; every other failure — offline, timeout, server error — stays
queued. Anything unrecognised is treated as transient, so an unknown error costs a
retry rather than the entry. AsyncStorage is rewritten with the retryable
remainder instead of blanket-cleared, and the `logs_synced` summary is only
written when at least one entry actually landed.

Two jest tests cover both directions: a `PERMISSION_DENIED` entry is dropped and
the queue drains to empty; a `Network request failed` entry is kept and is the
only thing left in the queue.

**No data-contract change.** RTDB paths and field names are untouched. The one
semantic change: `logs_synced.count` now reports entries actually written rather
than entries attempted — same field, same type, and the old value was wrong
whenever a write failed.

## 1b. Verifying the storage rules

Console → Storage → Rules → Rules Playground. Locations are relative to the bucket
root.

- [ ] **create** `/users/<YOUR-UID>/x.jpg`, UID `<YOUR-UID>`, provider Password,
      1 MB `image/jpeg` → **ALLOW**
- [ ] same but 10 MB → **DENY** (5 MB cap)
- [ ] same but 1 MB `application/pdf` → **DENY** (image-only)
- [ ] **create** `/users/someone-else/x.jpg` as UID `<YOUR-UID>`, 1 MB
      `image/jpeg` → **DENY** (ownership)
- [ ] same as the first case but provider **Anonymous** → **DENY** (proves the
      `sign_in_provider != 'anonymous'` clause, the least conventional line in
      the file). If the Playground has no Anonymous provider option, record this
      one as unverified rather than passed.

If the deploy errors that no bucket exists, the default bucket was never
provisioned — Console → Storage → Get started, then re-run. The bucket location is
permanent.

## 2a. Deferred function deletions (app repo)

The `firebase deploy --only functions` run on 2026-08-04 offered to delete three
functions. All three were answered **No**. Disposition:

All three are Gen1/Gen2 HTTP functions with `allUsers` on the invoker role —
i.e. live and callable by anyone. Verified 2026-08-04 by GET probe (each
returned 405 from its *own* handler, not from IAM) and by `get-iam-policy`.

- [ ] `setUserPassword` — **do not delete; revoke public access instead.**
      Gen2 (Cloud Run `setuserpassword`), `allUsers` → `roles/run.invoker`.
      Deleting it before the dashboard replacement is live would leave no
      password-reset path, so deletion stays **blocked on §2**. But the
      continuity argument does not require it to stay *public*: the dashboard
      UI calls it with `httpsCallable`, which wraps the payload as
      `{data:{uid,newPassword}}`, while the deployed `onRequest` handler reads
      `req.body.uid` — so **legitimate password reset is already broken in
      production** and only a hand-crafted flat POST works. Removing `allUsers`
      costs no working functionality and closes an account-takeover hole.
      **Done 2026-08-04 — `allUsers` invoker binding removed; 403 confirmed at
      the infra layer. The function stays deployed on purpose: it is LOCKED, not
      deleted, and waits for the dashboard's authenticated replacement (§2).
      Do not delete it before that ships.**
- [x] `cleanupLegacyLogs` — safe to delete. Gen1, nodejs20. No reference in
      `functions/index.js`, `src/`, or the dashboard repo (including full
      history on all branches); only changelog/audit docs mention it.
      Deleted 2026-08-04.
- [x] `generateQuickPage` — **delete, and treat as a security item, not
      housekeeping.** Gen1, nodejs20, `allUsers`. Not orphaned by accident: it
      came from `claude/review-aac-app-state-uk2j6` (commit `46dab92`,
      2026-04-03), a branch never merged to master and last touched
      2026-05-11. Its handler is `functions.https.onRequest` with **no auth
      check**, calling Vertex AI `gemini-2.5-flash` on the project's own
      service-account credentials — an open, billable LLM proxy. It is the
      same vulnerability class §1 was written to fix. Deleted 2026-08-04.

## 2. Backend deploy (dashboard repo)

- [ ] **BLOCKER (found 2026-08-04):** the admin-gated replacement lives at
      `src/functions/index.js`, but `firebase.json` deploys from `functions/`.
      `functions/index.js` still contains the **old unauthenticated
      `onRequest`** version — deploying today would redeploy the vulnerability.
      The replacement file also uses curly quotes (`‘` / `’`) instead of
      apostrophes on 10 lines and fails `node --check`. Fix both before
      deploying: move the file to `functions/index.js` and replace the quotes.
- [ ] `firebase deploy --only functions` — replaces the unauthenticated
      `setUserPassword` with the admin-gated callable
- [ ] Confirm the admin user's custom claim (`role: admin`) is set — the old
      `adminSetClaim.js` script was removed with the credentials directory;
      re-run equivalent with a fresh, uncommitted service account if needed
- [ ] Audit the **currently deployed** database rules against
      `ai-powered-aac-app/database.rules.json`; dashboard admin pages reading
      root collections must move to admin-SDK-backed endpoints rather than
      loosening per-user rules

## 3. App configuration

- [ ] `.env` present locally / EAS env vars set for all
      `EXPO_PUBLIC_FIREBASE_*` values (firebaseConfig.js validates at startup)
      — configure them as EAS project environment variables for production
      builds; there is no committed `.env.example`, values come from the
      Firebase console
- [ ] Optionally set `EXPO_PUBLIC_FUNCTIONS_BASE_URL` (defaults to the
      `us-central1-commai-b98fe` base)
- [ ] `app.json`: name "Voice", package/bundle id
      `com.elpabloawakens.aipoweredaacapp`, version `1.2.0`
      (EAS `autoIncrement` manages versionCode)
- [ ] Decide on `RECORD_AUDIO` permission — currently declared but unused by
      any feature; removing it eases store review
- [ ] Confirm privacy policy URL in `src/theme.js` is live and reflects the
      updated data-safety disclosures (AI processing of photos and sentence
      context)

## 4. Quality gates (run locally, must pass)

Use `npm install --legacy-peer-deps` in the app root — the pinned TensorFlow
`4.16.0` overrides conflict with peers otherwise.

- [x] `npm install --legacy-peer-deps`
      Run 2026-08-05: **84 added, 64 removed, 76 changed**. This was pre-existing
      drift, not a change — `googleapis`, `typescript` and `http-server` were
      declared in `devDependencies` but absent from `node_modules`. Note it also
      corrected `axios`, which was **installed at 1.14.0 while the lockfile
      pinned 1.13.6**; the "1.14.0" recorded in §8 on 2026-08-04 was the drifted
      figure, not the committed one.
- [x] `npx eslint . --ext .js,.jsx` → 0 errors
      Run 2026-08-05 three times — after the poison-pill fix, after the install
      reconciliation, and after the axios upgrade. **0 errors, 14 warnings** each
      time (pre-existing `no-unused-vars` / `react-hooks/exhaustive-deps` /
      `import/first`; none in the changed files).
- [x] `CI=1 npx jest` → all suites green
      Run 2026-08-05 at the same three points: **19 suites, 130 tests, all
      passed**. Baseline was 128; the two added are the poison-pill drop/retry
      pair.
- [x] `npx expo export --platform android` → bundles without resolution errors
      Run 2026-08-05: **succeeded**, 1055 modules, `Exported: dist`. Re-run with
      `--clear` to rule out a stale Metro cache: succeeded again, exit 0, no
      resolution errors. See §4a.

Re-run all of these after any §8 dependency change.

## 4a. The versionCode 19 Metro bundling failure — did not reproduce

Investigated 2026-08-05. `npx expo export --platform android` completes cleanly,
both from warm cache and from `--clear`. There is nothing to diagnose in the
current tree and no fix was applied.

The tree did change materially between that failure and this run: `npm install
--legacy-peer-deps` reconciled 84 added / 64 removed / 76 changed packages,
including three `devDependencies` that were declared but not installed. A
partially-installed `node_modules` is a routine cause of Metro resolution
failures, so that reconciliation is the most probable fix.

**That is a hypothesis, not a finding** — without the original error text it
cannot be confirmed. If the failure recurs, capture the full Metro output before
touching anything; if it does not recur on the next build, the drift explanation
stands. Do not treat this as closed until a `versionCode`-bumping build has
passed.

## 5. Android release

- [ ] `npx eas build --profile production --platform android`
      (remote credentials; produces `.aab`)
- [ ] Smoke-test the build on a device: first launch → onboarding → AAC board
      speaks; camera describe + read-text; switch scanning incl. opening and
      closing Quick Repair while scanning; guest vs signed-in; airplane-mode
      communication; account deletion
- [ ] Play Console: upload `.aab` to internal testing
      (`npm run eas:submit:android` uses `google-play-service-account.json`,
      never committed)
- [ ] Data safety form: use `docs/release/data-safety-draft.md` (2026-08
      revision — discloses AI processing; the older draft was inaccurate)
- [ ] IARC questionnaire, screenshots (templates in `assets/branding/`),
      listing copy from `docs/release/play-store-listing-draft.md`
- [ ] Roll out internal → closed → production tracks progressively

## 6. iOS release (not yet attempted)

- [ ] Apple Developer account + App Store Connect app record for
      `com.elpabloawakens.aipoweredaacapp`
- [ ] `npx eas build --profile production --platform ios` (add an ios section
      to `eas.json` production profile if customisation needed)
- [ ] Verify `NSCameraUsageDescription` copy; remove
      `NSMicrophoneUsageDescription` if `RECORD_AUDIO` is dropped
- [ ] App Privacy questionnaire mirroring the Play data-safety answers
- [ ] TestFlight internal → external → App Store review

## 7. Post-deploy verification

- [ ] Cloud Function logs show 401s for unauthenticated probes, 200s for app
      traffic
- [ ] `pruneUserLogs` scheduled job runs (Blaze plan + Cloud Scheduler)
- [ ] Feedback submitted from the app appears under `feedback/{uid}`
- [ ] Account deletion removes `users/{uid}`, `userSettings/{uid}`,
      `userLogs/{uid}`, `userSync/{uid}`, `customVocab/{uid}`,
      `vocabRequests/{uid}`

## 8. Dependency and platform work (before real users, not deploy blockers)

Recorded 2026-08-04. None of these block the §1 deploys.

Run the two batches below **separately**, so any regression is attributable.

**Batch A — the two real-exploit-path fixes, then gates, then redeploy.**

- [x] **`path-to-regexp` in `functions/`** — GHSA-37ch-88jc-xwx2, ReDoS,
      CVSS 7.5, fixed in 0.1.13. Reached via
      `firebase-functions@5.1.1 → express@4.22.1 → path-to-regexp@0.1.12`.
      `express@4.22.x` declares `~0.1.12`, so 0.1.13 is already inside its
      allowed range and needs no `overrides` entry:
      `cd functions && npm update path-to-regexp` — dry-run confirmed
      **`changed 1 package`** and nothing else.
      Prefer this over `npm audit fix` here: `npm audit fix` in `functions/`
      rewrites ~24 packages, including `@google-cloud/storage 7.19.0 → 7.21.0`
      and `fast-xml-parser 5.5.8 → 5.10.1`, which pulls in four new transitives
      (`anynum`, `xml-naming`, `is-unsafe`, `@nodable/entities`). Those four are
      legitimate — all published by `amitgupta <amitgupta.gwl@gmail.com>` under
      the `NaturalIntelligence` org, same maintainer as `fast-xml-parser` and
      `strnum` — but it is a far wider blast radius than the advisory requires.
      Neither route touches `firebase-functions ^5→^6` or `firebase-admin
      ^12→^14`; npm gates both behind `isSemVerMajor`.
      **Done 2026-08-05.** `npm update path-to-regexp` → `0.1.12 => 0.1.13`,
      exactly one package changed. GHSA-37ch-88jc-xwx2 gone from `npm audit`;
      functions total 22 → 21 (high 5 → 4). `functions/package.json` unchanged —
      no override was needed. `firebase-functions` stayed at 5.1.1 and
      `firebase-admin` at 12.7.0, both untouched.
- [x] **axios** — direct dependency, ships in the app bundle
      (`src/services/arasaacService.js`). Five advisories, the binding one being
      GHSA-pmwg-cvhr-8vh7 (high, CVSS 7.2, NO_PROXY bypass via 127.0.0.0/8),
      which needs `>=1.15.1`.
      **Done 2026-08-05.** `npm install axios@latest --legacy-peer-deps`:
      declared `^1.7.9 → ^1.19.0`, installed `1.13.6 → 1.19.0`. Every axios
      advisory is gone; root total 37 → 35 (high 13 → 12). Call surface in
      `arasaacService.js` is `axios.get(url, {timeout})` reading
      `response.status` / `response.data` with a catch-all handler — no
      interceptors, no `axios.create()`, no default-header config, no
      error-shape inspection. Nothing in the 1.13→1.19 range touches it.

      ⚠ **Transitive major bump, accepted:** axios 1.19.0 declares
      `proxy-from-env: ^2.1.0`, taking that package `1.1.0 → 2.1.0`. It is the
      remediation for the NO_PROXY advisories themselves, nothing else in the
      tree depends on it (`npm ls proxy-from-env` shows axios as sole parent),
      and it cannot be declined without declining axios 1.19.0. No **direct**
      dependency crossed a major boundary. Also bumped inside axios:
      `follow-redirects 1.15.11 → 1.16.0` and a nested `form-data@4.0.6`.
- [ ] Redeploy after Batch A: `firebase deploy --only functions --project
      commai-b98fe`, because `functions/package-lock.json` changed. Note this
      does **not** clear the Cloud Runtime Config deprecation warning — that was
      already cleared by unsetting `hf`/`vertex` in §0; the redeploy only
      confirms it. **Still outstanding — see `MORNING-HANDOVER.md`.**

**Batch B — later, on its own.**

- [ ] **`npm audit fix` in the app root** — resolves the remaining
      non-`expo`-pinned transitives. Re-run §4 gates afterwards **including**
      `npx expo export --platform android`; the lockfile touches Metro/RN
      internals. Dry-run confirmed it leaves every `expo`-pinned advisory alone.
- [ ] **Do not run `npm audit fix --force`.** Its only extra win is `postcss`,
      and it gets there by moving `expo` 54 → 57 (SemVer major). Treat an Expo
      SDK upgrade as its own project — note `origin/chore/upgrade-expo-54`
      already exists as a starting point.
- [ ] **Dashboard repo dependencies** — 64 vulns in the app + 32 in its
      functions, materially worse than this repo. Separate piece of work.

### Dated platform deadlines

- [ ] **Node 20 runtime → Node 22** (`functions/package.json` `engines.node`).
      Node 20 deprecates **October 2026**. The dashboard's functions already
      target Node 22, so 22 is the proven target. Do this at the same time as
      the `firebase-functions` upgrade below to avoid two deploy cycles.
- [ ] **`firebase-functions` ^5.0.0 → ^6.x** — breaking-change upgrade.
      The dashboard is already on ^6.0.1. All five app functions use the v1
      `functions.https.onRequest` / `.runWith()` / `.pubsub.schedule()` API and
      would need porting. Schedule alongside the Node 22 move.
- [ ] **Cloud Runtime Config shuts down March 2027.** The current app source
      does **not** call `functions.config()` — it reads `process.env.HF_TOKEN`
      (Secret Manager) and `process.env.GCLOUD_PROJECT`. The deprecation
      warning at deploy comes from *stored* config values (`hf.token`,
      `vertex.project_id`) left over from the abandoned Quick Page work.
      Clearing them (see §0) removes the warning and the stale secret at once;
      no code migration is needed.
