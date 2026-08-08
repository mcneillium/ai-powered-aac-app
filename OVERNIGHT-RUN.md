# CommAI — Autonomous Overnight System Improvement Run

**Operator:** Paul (`mcneillium`)
**Repos:** `C:\Users\McNei\Documents\ai-powered-aac-app` (React Native / Expo) and `C:\Users\McNei\Documents\ai-powered-aac-dashboard` (React + MUI)
**Backend:** Firebase project `commai-b98fe` (Realtime Database `europe-west1`, Auth, Cloud Functions, Hosting)
**Mode:** Fully unattended. No human is awake. No questions will be answered.

---

## 0. STANDING ORDERS — READ FIRST, OBEY THROUGHOUT

These override anything later in this document if they ever conflict.

### 0.1 Autonomy contract

1. **Never stop to ask a question.** There is no one to answer. If you need a decision, make it, and record it in the Decision Ledger (§0.6) with your reasoning and the alternatives you rejected.
2. **Never pause between phases** for confirmation. Run Phase 0 through Phase 9 back to back.
3. **Never emit an interim summary to the console.** Write progress to files. Produce exactly **one** final summary at the very end, after Phase 9.
4. **Never idle waiting for input.** If a command hangs, kill it after its stated timeout, log the timeout, and continue.
5. If a phase fails irrecoverably, log it, mark it `BLOCKED` in the ledger with everything you learned, and **move to the next phase**. Do not abort the run.
6. If you find yourself with time remaining after Phase 9, return to the backlog produced in Phase 4 and pull the next-highest-value safe item. Keep going until the budget in §0.4 is exhausted.

### 0.2 Hard guardrails — violations are run-ending failures

You have full permission to make decisions, refactor, add, delete, and design. You do **not** have permission to do any of the following:

- **Do not push to `main`/`master` on either repo.** Work on the branches created in Phase 0. Local commits only. Do not `git push` at all unless pushing the working branch to a remote of the same name, and never with `--force` or `--force-with-lease`.
- **Do not run `firebase deploy` against production** for hosting, functions, database rules, or storage rules. Rules work is written and validated locally and via the emulator only. Deployment is Paul's call in the morning.
- **Do not change the Firebase data contract silently.** Realtime Database paths, node names, field names, and document shapes are a *shared* contract between the mobile app and the dashboard. If a rename is genuinely the right call, you must: (a) implement it as an additive migration with a backward-compatible read path, (b) update *both* repos in the same commit, (c) flag it in `HANDOVER.md` under a heading `## DATA CONTRACT CHANGES — REVIEW BEFORE DEPLOY`. A one-sided change is a production outage. Treat it that way.
- **Do not bump `versionCode` or `version` in `app.json` / `app.config.js`** unless a phase explicitly instructs it. If you do, log it prominently.
- **Do not touch, print, echo, or commit secrets.** No `google-services.json` contents, no service account JSON, no API keys, no `.env` values in logs, commit messages, or reports. If you find a secret committed to git history, do **not** attempt history rewriting — record it in `HANDOVER.md` under `## SECURITY — IMMEDIATE ACTION REQUIRED` and move on.
- **Do not delete user-facing data, database nodes, or storage objects** in any environment.
- **Do not run `npm audit fix --force`.** Breaking changes introduced blind are worse than the advisory.
- **Do not disable, weaken, or `.skip` a test to make a gate pass.** If a test is genuinely wrong, fix the test and say so in the ledger.
- **Do not remove accessibility affordances** to hit a performance target. In an AAC product, accessibility outranks performance, always.
- **Do not upgrade React Native, Expo SDK, or the Firebase SDK major versions** during this run. Those are supervised daytime changes. Record the recommendation instead.

### 0.3 Priority order

If you have to choose what to spend time on, this is the order:

1. **The release is blocked.** Getting a bundleable, buildable app is worth more than everything below it combined.
2. **Correctness and data integrity** — anything that could corrupt, lose, or leak a user's vocabulary, utterance history, or personal data.
3. **Accessibility** — this is an AAC app. A user who cannot operate it has no voice. This is not a "nice to have" category.
4. **Security and privacy** — AAC users are frequently vulnerable adults and children. Treat every log line as potentially sensitive.
5. **Reliability and offline behaviour.**
6. **Performance and latency.**
7. **Code quality, tests, docs.**
8. **New features and ideas.**

### 0.4 Budget and pacing

- Target total wall-clock: **8 hours**. Soft-stop at 7h30m and spend the remainder on Phase 9 (verification + handover) so you never hand Paul a half-finished tree with no report.
- Any single subagent gets **maxTurns** bounded (set in its frontmatter). Any single shell command gets a timeout; long ones (installs, builds) get 20 minutes, everything else 5 minutes.
- Do not spend more than **90 minutes** on Phase 1 even if unsolved. Log findings, move on — a documented dead end is a useful artefact.

### 0.5 Working artefacts — create these in Phase 0 and maintain them all night

Everything goes under `.claude/overnight/<YYYY-MM-DD>/` in the **app** repo (the dashboard repo gets a symlink-free copy of its own findings):

| File | Purpose |
|---|---|
| `LEDGER.md` | Append-only decision log. Every non-trivial choice, with reasoning and rejected alternatives. |
| `PROGRESS.md` | Append-only timeline. One line per meaningful event, timestamped. |
| `FINDINGS.md` | Raw output of all audit subagents, grouped by domain. |
| `BACKLOG.md` | The scored, prioritised improvement backlog from Phase 4. |
| `IDEAS.md` | New feature and product ideas from Phase 6, with feasibility notes. |
| `RISKS.md` | Anything you found but deliberately did not touch, and why. |
| `HANDOVER.md` | The morning document. Written last. This is what Paul actually reads. |
| `logs/` | Raw command output, one file per gate run. Never inline giant logs into the markdown. |

### 0.6 Decision Ledger format

Every entry in `LEDGER.md` uses exactly this shape. Terse is fine. Empty is not.

```
### D-042 — [Phase 5] Replaced inline symbol lookup with an LRU cache
- **Decision:** Added a 200-entry LRU in `src/services/symbolCache.js`; ARASAAC fetches now go through it.
- **Why:** Profiling showed 40+ duplicate network calls per board render.
- **Alternatives rejected:** (a) React Query — adds a dependency for one use case. (b) Unbounded Map — unbounded memory on long sessions, which is exactly the poison-pill class of bug we already fixed once.
- **Blast radius:** Read path only. No data contract change. Falls back to direct fetch on cache miss or error.
- **Reversible:** Yes — single commit `a1b2c3d`, revert is clean.
- **Confidence:** High.
```

### 0.7 Commit discipline

- One logical change per commit. Never a mega-commit.
- Conventional commits: `fix:`, `feat:`, `perf:`, `a11y:`, `refactor:`, `test:`, `docs:`, `chore:`, `build:`.
- Every commit body ends with `Ledger: D-0NN` referencing the ledger entry.
- Run the gate suite (§0.8) **before** each commit. Never commit a red tree. If a change cannot pass the gates, stash it, write it up in `RISKS.md`, and move on.
- Tag the tree at the end of each phase: `git tag overnight/<date>/phase-N`. This gives Paul clean rollback points.

### 0.8 The gate suite

Define this once in Phase 0 as `scripts/gates.mjs` (Node, so it works identically on Windows) and run it via `node scripts/gates.mjs`. It must run, in order, and report a machine-readable pass/fail per gate:

1. `npx tsc --noEmit` if TypeScript is configured, else skip with a logged note
2. Lint (`npx eslint . --max-warnings=0` — if the current tree already fails this, record the baseline count in Phase 0 and gate on *not increasing* it rather than zero)
3. Unit tests (`npx jest --ci --silent` or whatever the repo uses)
4. `npx expo-doctor` (app repo only)
5. A **bundle smoke test** — see Phase 1, this is the critical one
6. `npm ls --all >/dev/null` for tree integrity after any dependency change

Always capture full output to `logs/gate-<phase>-<n>.log` and only surface the summary.

---

## PHASE 0 — BOOTSTRAP, BASELINE, AND AGENT INFRASTRUCTURE

### 0.A Establish safety rails

1. In **both** repos: confirm a clean working tree. If either is dirty, commit the existing work to a branch `overnight/<date>/pre-existing-wip` first so nothing of Paul's is lost, then proceed. Log exactly what you stashed.
2. Record the current HEAD SHA of both repos in `PROGRESS.md`. This is the rollback anchor.
3. Create and check out `overnight/<date>/improvements` in both repos.
4. Create the artefact directory tree from §0.5.

### 0.B Capture the baseline — you cannot claim an improvement without a before

Measure and record all of the following in `PROGRESS.md` under `## BASELINE`:

- Line count and file count per repo, per top-level directory
- Dependency counts (direct vs transitive), and `npm ls --all` health
- Current lint error/warning counts
- Current test count, pass count, and coverage percentage (if instrumented; if not, note that)
- `npx expo-doctor` output
- Bundle size: run a production Metro bundle to disk (see Phase 1) and record byte size per platform
- Cold start time if measurable, else note as unmeasured
- Number of `TODO`, `FIXME`, `HACK`, `XXX` comments
- Count of `console.log` calls in production code paths
- Cloud Functions: count, runtime version, and deployed region
- Firebase rules files: line counts and whether rules tests exist at all

### 0.C Build the subagent fleet

Write these files into `.claude/agents/` in the **app** repo. Give each one `memory: project` where noted so that findings accumulate across future overnight runs — this run should leave the fleet smarter than it found it.

Use cheap models for fan-out reading and Fable for judgment. Concretely:

| Agent | Model | Tools | Memory | Role |
|---|---|---|---|---|
| `repo-cartographer` | `haiku` | Read, Grep, Glob | project | Maps both repos: module graph, entry points, dead files, duplicated logic. High-volume reading, low judgment. |
| `data-contract-guardian` | `fable` | Read, Grep, Glob | project | **Veto role.** Enumerates every Firebase path/field read or written by either repo and maintains `docs/DATA-CONTRACT.md`. Any proposed change touching those paths must be checked against this agent before commit. |
| `aac-accessibility-auditor` | `fable` | Read, Grep, Glob | project | Audits against §3.C. The single most important auditor in the fleet. |
| `firebase-security-auditor` | `fable` | Read, Grep, Glob, Bash | project | Rules coverage, auth boundaries, PII in logs, Functions IAM, data retention. |
| `ai-pipeline-analyst` | `fable` | Read, Grep, Glob | project | The three-tier pipeline: on-device TF.js LSTM → AI Profile Store → Vertex AI Gemini. Latency, fallback, cost, quality. |
| `perf-profiler` | `sonnet` | Read, Grep, Glob, Bash | project | Bundle size, re-render hotspots, list virtualisation, image/symbol caching, memory growth. |
| `dependency-medic` | `sonnet` | Read, Edit, Bash | — | Advisories, drift, duplicate transitive versions, unused deps. Bound by §0.2 (no majors, no `--force`). |
| `build-doctor` | `fable` | Read, Edit, Bash, Grep, Glob | project | Metro/Babel/Hermes/EAS. Owns Phase 1. |
| `test-author` | `sonnet` | Read, Write, Edit, Bash | — | Writes tests. Never weakens them. |
| `code-reviewer` | `fable` | Read, Grep, Glob, Bash | project | Read-only. Reviews every diff before commit. Cannot edit — it reports. |
| `docs-scribe` | `sonnet` | Read, Write, Edit, Glob | — | Maintains the artefact files and the final handover. |

Every agent file must:
- Preload the existing project skill: `skills: [commai-aac]` (verify the skill name from `.claude/skills/`; if it resolves differently, use the actual name and note the correction).
- State its output format explicitly: findings as a numbered list, each with **severity** (`critical` / `high` / `medium` / `low`), **file:line**, **evidence**, **proposed fix**, **blast radius**, **confidence**.
- Instruct it to write learnings to its memory directory at the end of its run: codepaths discovered, patterns, gotchas, where things live.
- Instruct it to report obstacles explicitly rather than silently returning partial work.

### 0.D Install the safety hook

Write `.claude/hooks/guard.mjs` — a Node script (cross-platform, no bash/PowerShell divergence). Register it as a `PreToolUse` hook matching `Bash` in `.claude/settings.json`.

It reads the hook JSON from stdin, extracts `tool_input.command`, and **exits with code 2** (which blocks the command and returns the message to you) if the command matches any of:

- `git push` with `--force` or `-f`, or targeting `main`/`master`
- `firebase deploy` (any form) — the emulator is fine, deploy is not
- `rm -rf` targeting anything outside the repo working tree, or targeting `.git`
- `npm audit fix --force`
- `eas submit`
- Anything writing to `google-services.json`, `*.keystore`, `service-account*.json`, or `.env*`
- `git reset --hard` targeting a SHA older than the run's baseline anchor

Exit 0 for everything else. Test the hook once with a deliberately blocked command, confirm it blocks, log the confirmation, and move on. If the hook cannot be made to work on this environment, log that loudly in `RISKS.md` and proceed with heightened manual care.

### 0.E Build the gate suite

Write `scripts/gates.mjs` per §0.8. Run it once. Record the baseline result — **including which gates currently fail**. A pre-existing failure is not your fault, but it *is* your baseline, and Phase 9 must show you did not make it worse.

---

## PHASE 1 — UNBLOCK THE RELEASE (versionCode 19 Metro bundling failure)

**This is the highest-value work in the entire run. Do it first, at full effort.**

Context you already have: versionCode 18 built and uploaded to Play Console successfully. versionCode 19 fails at Metro bundling on EAS. Local `node_modules` drift has already been ruled out as a cause, because EAS builds from a clean container using the lockfile — so any hypothesis that depends on local state is wrong by construction and should be discarded immediately.

### 1.A Reproduce it locally, deterministically

An EAS round-trip is a slow feedback loop. Get a fast one first:

1. Reproduce the *exact* EAS install: `rm -rf node_modules && npm ci` (never `npm install` here — `ci` is what the container does, and the distinction is the whole point).
2. Run a production Metro bundle straight to disk, which is the step that fails:
   ```
   npx expo export --platform android --output-dir .metro-smoke --clear
   ```
   and separately, the lower-level path:
   ```
   npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output .metro-smoke/index.android.bundle --assets-dest .metro-smoke/assets
   ```
3. If it fails locally: excellent, you have a fast loop. Capture the **full** error with `--verbose` and `--reset-cache` to `logs/metro-repro.log`.
4. If it succeeds locally but fails on EAS, the delta is environmental. Enumerate the differences systematically: Node version (compare `.nvmrc` / `engines` / `eas.json` `node` field against your local), npm version, platform-specific path handling (Windows vs Linux — **case sensitivity in imports is the classic killer here**), `.easignore` / `.gitignore` excluding a file Metro needs, `EXPO_PUBLIC_*` env vars present locally but absent in the build profile, and native module resolution.

### 1.B The case-sensitivity sweep (do this regardless of whether 1.A reproduces)

Paul develops on Windows. EAS builds on Linux. Windows filesystems are case-insensitive; Linux is not. This is the single most common cause of "works locally, fails on EAS" bundling errors, and it is invisible locally by definition.

Write a script that, for every `import`/`require` with a relative path in both repos, resolves the path and asserts the **exact** case matches the on-disk filename. Report every mismatch. Fix them all. This alone may be the entire bug.

While you're there, also check: imports of files that exist but are gitignored, imports resolving to a directory without an `index` file, and any `require` of a path built by string concatenation (Metro cannot statically resolve these).

### 1.C Systematic differential diagnosis

Work the hypothesis space in order of cheapness-to-test:

1. **Lockfile drift** — diff `package-lock.json` between the versionCode 18 commit and HEAD. What actually changed in the resolved tree? A transitive bump in a Babel or Metro plugin is a prime suspect. Consider that the `path-to-regexp` update in `functions/` and the root `npm install` reconciliation both mutated the tree.
2. **Babel/Metro config** — diff `babel.config.js`, `metro.config.js`, `tsconfig.json`, and `app.json`/`app.config.js` across the same range. Any plugin ordering change, any `resolver` or `transformer` customisation.
3. **New syntax or new import** — what source files changed between 18 and HEAD? Anything using syntax a stale Babel plugin can't parse? Any new `import` of something not in `dependencies` (a phantom dependency that resolves locally via hoisting but not in a clean install)?
4. **Asset resolution** — new fonts, SVGs, symbol assets, or JSON that Metro's `assetExts`/`sourceExts` doesn't know about. You integrate OpenMoji, Mulberry, and ARASAAC — asset pipeline changes are plausible.
5. **TF.js / native module interaction** — TF.js and its React Native bindings are a known source of Metro resolution pain (WASM/bin assets, platform-specific entry points).
6. **Circular imports** — Metro tolerates some and chokes on others under production minification specifically.
7. **`expo-doctor` output** — read it properly, don't skim it.

Bisect if needed: `git bisect` between the versionCode 18 commit and HEAD, with the local bundle command as the test predicate. This is the highest-signal move available and you should reach for it early if 1.A reproduces.

### 1.D Fix, verify, and defend

1. Apply the minimal fix. Not a refactor — a fix. Refactors belong in Phase 5.
2. Prove it: clean `npm ci`, clean Metro cache, production bundle succeeds, output byte size is sane compared to the Phase 0 baseline.
3. **Add the bundle smoke test to the gate suite permanently.** A production Metro bundle to a temp dir is now gate #5. This class of failure must never again be discoverable only on EAS.
4. Add a CI-shaped script `scripts/preflight.mjs` that runs `npm ci` + case-sensitivity check + production bundle, so it can later be wired to a git hook or GitHub Action. Document it. Do not wire it to a pre-commit hook automatically — that's an intrusive change to Paul's workflow that he should opt into.
5. Write up the root cause in `HANDOVER.md` in plain language, including what it was *not*, so the dead ends don't get re-explored.
6. **Do not run an EAS build.** It burns build minutes, takes 20+ minutes of wall clock, and requires credentials handling. Instead, prepare everything so Paul can fire one command in the morning, and state that command explicitly at the top of `HANDOVER.md`.

If after 90 minutes the root cause is still unknown: stop. Write up every hypothesis with the evidence for and against, ranked, plus the exact next diagnostic step for each. Move to Phase 2.

---

## PHASE 2 — CLOSE THE OPEN THREADS

These are known, scoped, and half-finished. Finishing them is cheap and high-value.

### 2.A The poison-pill follow-ups in `src/utils/enhancedLogger.js`

`syncLogsToFirebase` was already fixed: `Promise.all` was replaced with `Promise.allSettled` so a single rejected Firebase log entry can no longer stall the entire AsyncStorage queue indefinitely. Three checks were left open. Close all three:

1. **Is the retained queue bounded?** If not, cap it at 500 entries with FIFO eviction of the oldest. An unbounded retry queue on a device that's offline for a week is a memory and storage leak, and it's the same failure class as the bug just fixed.
2. **Do dropped entries emit an observable signal?** Add a `console.warn` on drop. Explicitly **do not** route this through `logEvent` — a logger that logs its own logging failures through itself is a recursion trap. This was already noted; honour it.
3. **Does the changed semantics of `logs_synced.count` conflict with any dashboard reads?** Grep the **dashboard repo** for every read of that field. If the dashboard interprets `count` as "attempted" and it now means "succeeded" (or vice versa), that is a silent data-quality regression in Paul's own analytics. Fix whichever side is wrong, in the same commit, and flag it under the data-contract heading.

While in this file, also verify: retry backoff is exponential with jitter (not a tight loop), permission errors are dropped permanently rather than retried forever, transient errors are retried, and no utterance content or PII is written into log payloads.

### 2.B The Firebase deployment checklist

Pick up where it stands: database rules, storage rules, Cloud Functions dependency updates (Batch A done, Batch B deferred).

1. **Verify the `database.rules.json` feedback path** before running any Playground cases — this was flagged as unverified and everything downstream depends on it.
2. **Establish the ALLOW control case first.** A DENY case that passes means nothing until you've proven an ALLOW case passes too — otherwise you're just observing that everything is denied. Get the control green, then the DENY cases become meaningful evidence.
3. **Confirm `--dry-run` support** for the storage target before relying on it. If it isn't supported, say so and use the emulator instead.
4. **Convert the whole thing into automated rules tests** using `@firebase/rules-unit-testing` against the emulator, checked into `test/rules/`. Manual Playground clicking does not survive contact with a busy week. Cover, at minimum: unauthenticated read/write to every top-level node (expect deny), authenticated user reading another user's data (expect deny), authenticated user reading own data (expect allow), caregiver reading a linked user's data (expect allow), caregiver reading an unlinked user's data (expect deny), and writes with malformed shapes (expect deny via validation rules).
5. Wire the rules tests into the gate suite.

### 2.C Batch B dependency updates

Now do the deferred batch, respecting the sequencing constraint that root `npm install` mutates the resolved tree as a side effect.

The protocol, strictly:
1. Run gates → record green baseline.
2. Apply **one** package update.
3. Run gates → if red, revert that one update, log why in `RISKS.md`, continue with the next.
4. Commit each successful update individually.
5. After any root `npm install`, re-run gates *again* before proceeding, because the tree moved underneath you.

No major version bumps (§0.2). Prefer patch and minor within the current major. For anything that *should* be a major bump, write it into `BACKLOG.md` with a migration-effort estimate rather than doing it.

---

## PHASE 3 — FULL-SYSTEM AUDIT (parallel subagents)

Dispatch the auditor fleet **in parallel**. Each returns a structured findings list; you synthesise, you do not paste raw output into your own context. All raw findings go to `FINDINGS.md`.

### 3.A `repo-cartographer` — structural map

Both repos. Produce `docs/ARCHITECTURE.md`: module graph, entry points, data flow from user tap → prediction → utterance → TTS → log → Firebase → dashboard. Identify: dead files (imported by nothing), duplicated logic across repos that should be a shared package, god-files over 500 lines, components with more than 8 props, and any place the same Firebase path string is hardcoded in more than one location (these should be constants).

### 3.B `data-contract-guardian` — the shared contract

Produce `docs/DATA-CONTRACT.md`: every RTDB path, its shape, which repo writes it, which repo reads it, whether it's validated by rules, its expected size growth over time, and its retention story. Flag any path written by one repo and read by neither, any path read but never written, and any unbounded-growth node (utterance logs are the obvious candidate — if a heavy user generates 500 utterances a day, what does that node look like in two years, and what does it cost to read?).

### 3.C `aac-accessibility-auditor` — the most important audit here

This is an AAC product used by people with complex communication needs. Audit against the following, and be rigorous — this is where a generic code review would let you down:

**Motor planning and layout stability.** In AAC, users build muscle memory for button *positions*. A vocabulary item that moves between sessions or between board states destroys motor planning and can set a user back months. Audit: does any code path reorder, resize, or reflow buttons based on prediction confidence, recency, or frequency? If yes, that is a **critical** finding regardless of how good it looks in a demo. Prediction should add to a dedicated prediction zone, never rearrange the core board.

**Core vocabulary integrity.** Is there a stable core word set that persists across all boards? Are core words in consistent screen positions?

**Motor access.** Touch target sizes (44×44dp absolute minimum, and AAC users often need considerably larger). Hit slop. Accidental-activation rejection — is there a configurable dwell/hold-to-select time? A release-to-activate option? A post-activation lockout to prevent double-fire from tremor?

**Switch access.** Does the app support external switch input at all? Row/column scanning? Configurable scan rate, auto-scan vs step-scan, scan highlighting that is visible to someone with a visual impairment?

**Screen reader.** Every interactive element: does it have `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`, and correct `accessibilityState`? Is focus order sane? Are modals trapping focus correctly? Are decorative images marked `accessibilityElementsHidden`?

**Visual.** Contrast ratios against WCAG 2.2 AA (4.5:1 body, 3:1 large text and UI components) — actually compute them from the theme values, don't eyeball. Does the app respect OS font scaling without breaking layout? Is there a high-contrast mode? Does it honour reduce-motion?

**Cognitive and temporal.** Are there any time-limited interactions, auto-dismissing toasts, or animations that could rush a user? Any modal that can trap a user with no obvious exit? Is there an undo for destructive actions?

**Speech output.** Is TTS interruptible? Configurable rate and pitch? Does the utterance bar show what will be spoken before speaking? Can a partially built utterance be edited word-by-word rather than cleared entirely?

For each finding: severity, the specific WCAG criterion or AAC principle it violates, file:line, and a concrete fix.

### 3.D `firebase-security-auditor`

Rules coverage per path (any path with no rule is a finding). Auth boundary correctness — can a caregiver account reach a user they aren't linked to? Cloud Functions: are they authenticated, do they validate input, do they have appropriate IAM, do they leak stack traces to clients? Is any PII or utterance content written to logs, Crashlytics, or analytics? Is there a data retention policy, and is it implemented or just documented? Given the UK/NI context, note GDPR-relevant issues: lawful basis for caregiver monitoring, data subject access (can a user export or delete everything?), and data minimisation. Check for API keys or config in the client bundle that shouldn't be there, and check `.gitignore` coverage for all credential file patterns.

### 3.E `ai-pipeline-analyst`

The three-tier architecture: on-device TF.js LSTM → AI Profile Store → Vertex AI Gemini.

- **Latency budget.** What is the measured time-to-first-prediction for each tier? For AAC, on-device prediction needs to feel instantaneous — set a target of under 100ms and report the actual. If the LSTM inference is on the JS thread and blocking, that's a critical finding.
- **Tier routing.** What triggers escalation from tier 1 to tier 3? Is it confidence-based, explicit, or naive? What is the cost per user per day at tier 3, and does anything cap it?
- **Offline degradation.** With no network, does tier 1 still work? Does the UI communicate degraded mode, or does it just silently get worse?
- **Failure modes.** Gemini timeout, rate limit, malformed response, content filter block — is each handled distinctly, or does everything collapse into a generic catch?
- **Prediction quality.** Is there *any* measurement of whether predictions are accepted? Acceptance rate is the only metric that matters and it's cheap to instrument.
- **Personalisation.** How does the AI Profile Store actually improve over time? Is there recency weighting? Does it handle vocabulary the user has explicitly rejected?
- **Prompt management.** Are Gemini prompts versioned, or inline string literals scattered through the code? Is there a fallback if a prompt change degrades quality?

### 3.F `perf-profiler`

Bundle size by module (use `expo export` output plus a source-map explorer). Startup path — what runs before first paint, and can any of it be deferred? Are symbol grids virtualised or rendering hundreds of images at once? Symbol caching: are ARASAAC fetches cached to disk, are they available offline, is there an LRU or does it grow forever? Re-render analysis on the board component. Memory growth over a simulated long session. AsyncStorage read/write patterns on the hot path. Any `JSON.parse`/`stringify` of large objects synchronously during interaction.

### 3.G Test coverage reality check

Not just the percentage — the *shape*. Which of these have zero tests: the prediction pipeline, the logger queue, the Firebase sync layer, the rules, the utterance builder, offline transitions, the auth/caregiver-linking boundary? Rank by (risk × absence of coverage).

---

## PHASE 4 — SYNTHESISE AND PRIORITISE

Merge every finding into `BACKLOG.md`. De-duplicate ruthlessly — the same root cause will surface from three different auditors.

Score each item:

- **Impact** (1-5) — weighted by §0.3 priority order. An accessibility fix at severity `high` outscores a performance win at severity `high`.
- **Confidence** (1-5) — how sure are you this is real and the fix works?
- **Effort** (1-5, inverted) — how much work?
- **Blast radius** (`isolated` / `module` / `cross-repo` / `data-contract`)
- **Reversibility** (`clean-revert` / `messy` / `one-way`)

Then sort into three tiers and write them as three distinct sections:

- **TIER A — Do tonight.** High impact, high confidence, isolated or module blast radius, clean revert. This is your Phase 5 worklist.
- **TIER B — Prepared, not applied.** Real and worth doing, but cross-repo, data-contract-touching, or one-way. For each: write the full implementation plan, the migration steps, the test plan, and the rollback plan. Do the *thinking* so the doing is trivial in the morning. Do not apply.
- **TIER C — Recommended, needs Paul.** Major version bumps, architectural changes, anything with a product judgement embedded in it.

Do not gold-plate the scoring. Spend at most 30 minutes here and get to work.

---

## PHASE 5 — IMPLEMENT TIER A

For each Tier A item, in descending score order:

1. Re-read the relevant code fresh (don't work from the audit summary alone — auditors can be wrong).
2. Write or update a test that **fails** because of the issue, where the issue is testable.
3. Implement the fix.
4. Confirm the test now passes.
5. Run the full gate suite.
6. Send the diff to `code-reviewer` (read-only). If it raises a `critical` or `high` finding, address it before committing. If you disagree with the reviewer, record the disagreement and your reasoning in the ledger — don't silently override it.
7. If the diff touches any path in `docs/DATA-CONTRACT.md`, check with `data-contract-guardian` before committing.
8. Commit with a ledger reference.
9. Append to `PROGRESS.md`.

Stop pulling from Tier A when you hit the Phase 5 time budget (target: 2.5 hours) or when the remaining items are all lower-value than starting Phase 6. Anything untouched stays in the backlog with its score intact.

**Bias toward the boring.** A hundred small, correct, reversible improvements are worth more to Paul than one ambitious refactor he has to spend Saturday morning understanding.

---

## PHASE 6 — NEW IDEAS AND FORWARD DESIGN

Now think like a product engineer, not a maintainer. Write `IDEAS.md`.

Generate **at least 25 substantive ideas** across the categories below. For each: what it is, why it matters *for AAC users specifically*, rough effort, dependencies, risks, and whether it's differentiating or table-stakes. Then pick the top 3 that are genuinely buildable and implement a **prototype behind a feature flag, defaulted off**, plus a test. Flag-off means it ships dark and Paul decides.

Seed categories — go well beyond these:

**Communication effectiveness**
- Whole-utterance prediction vs word-by-word; phrase banks for high-frequency situations
- Context-aware prediction: time of day, location, calendar, conversation partner, recent topic
- Repair strategies — what happens when the listener didn't understand? A "let me rephrase" affordance
- Conversation partner mode: a display for the listener showing the utterance being built, reducing the awkward silence that dominates AAC exchanges
- Fringe vocabulary acquisition — detecting that a user is reaching for a word they don't have, and offering to add it
- Rate enhancement metrics: words per minute, keystroke savings — the actual clinical measures AAC is evaluated on

**Autonomy and dignity**
- Voice banking / personalised TTS voice selection, including age- and gender-appropriate voices
- User-controlled privacy: can the user (not just the caregiver) see and delete their own history?
- A "private" mode where an utterance isn't logged at all
- Emergency/urgent phrases reachable in one tap from any board state

**Reliability**
- Full offline parity, with a visible, honest connection indicator
- Conflict resolution for multi-device vocabulary edits
- Automated encrypted backup and one-tap restore of the user's entire vocabulary — losing a personalised AAC vocabulary is a catastrophic event for a user
- Crash-safe utterance recovery: if the app dies mid-sentence, the utterance survives

**Clinical / caregiver value (dashboard)**
- Vocabulary growth over time, core-vs-fringe ratio, most-used and never-used items
- Never-used vocabulary report — dead buttons are cognitive load; surfacing them is genuinely useful to an SLT
- Goal tracking aligned to speech and language therapy targets
- Exportable session reports (PDF/CSV) for clinical review
- Consent-aware analytics: nothing shown to a caregiver that the user hasn't been told about

**Platform and quality**
- Automated accessibility regression testing in CI
- Error/crash reporting that is privacy-safe by construction (no utterance content, ever)
- Feature flag infrastructure, if it doesn't exist
- Internationalisation and multi-language symbol sets
- Play Store readiness: data safety declarations, accessibility statement, target SDK compliance

**AI/ML**
- On-device personalisation of the LSTM without sending data off-device
- Confidence calibration and a transparent "why this suggestion" view for caregivers
- Prediction acceptance rate as a first-class tracked metric, feeding back into ranking
- Semantic symbol search across OpenMoji/Mulberry/ARASAAC so a caregiver can find the right symbol fast

For each of the 3 prototypes: build it, flag it off, test it, document how to turn it on, and write the evaluation criteria Paul should use to decide whether to keep it.

---

## PHASE 7 — HARDENING

1. **Tests.** Fill the highest-risk gaps found in 3.G. Target the prediction pipeline, the logger queue, the Firebase sync layer, offline transitions, and the caregiver auth boundary. Aim to raise coverage meaningfully but never at the expense of test quality — three good tests beat thirty assertions on getters.
2. **CI.** Write a GitHub Actions workflow (`.github/workflows/ci.yml`) in both repos running the gate suite on PR. Commit it but **do not** configure any secrets or deployment steps.
3. **Error boundaries.** Ensure a crash in the prediction layer cannot take down the board. In an AAC app, degraded communication is acceptable; no communication is not. Every AI-tier call should be wrapped such that failure falls back to the next tier down, and tier 1 failure falls back to a static board that always works.
4. **Observability.** Structured logging with levels, PII-free by construction. A debug screen (dev builds only) showing tier routing decisions, latency, cache hit rates, and queue depth.
5. **Types.** If TypeScript is partially adopted, extend it to the Firebase data layer first — that's where type safety pays for itself. If it isn't adopted at all, add JSDoc types to the data layer and note the migration path in Tier C rather than converting anything.

---

## PHASE 8 — FULL VERIFICATION SWEEP

Nothing here is optional. This is the phase that determines whether Paul wakes up to an asset or a liability.

1. Clean install from lockfile in both repos (`rm -rf node_modules && npm ci`).
2. Full gate suite, both repos. Capture to `logs/`.
3. Production Metro bundle, both platforms if configured. Compare size against Phase 0 baseline and explain any increase over 5%.
4. `npx expo-doctor` — compare against baseline.
5. Dashboard production build (`npm run build`) — must succeed.
6. Firebase rules tests against the emulator — all green.
7. Re-run the case-sensitivity import check — zero violations.
8. `git log --oneline` review: is every commit atomic, conventional, and ledger-referenced?
9. **Self-review the entire cumulative diff** (`git diff <baseline-sha>..HEAD`) via `code-reviewer`, with fresh eyes. Anything it flags as `critical` gets reverted, not patched at 5am.
10. Confirm no secrets in any commit: scan the full diff for key-shaped strings, and confirm no credential files were added.
11. Confirm the data contract: any change is documented and applied to **both** repos.

If any verification fails and cannot be fixed within 20 minutes, **revert to the last green phase tag** and document what was lost. A clean tree with fewer improvements is strictly better than a broken tree with more.

---

## PHASE 9 — HANDOVER

Write `HANDOVER.md`. This is the only document Paul is guaranteed to read, so front-load it. Structure exactly as follows:

```
# Overnight Run — <date>

## 1. DO THIS FIRST (2 minutes)
<The single most important action, with the exact command. Almost certainly the EAS build.>

## 2. STATE OF THE TREE
- Branch: overnight/<date>/improvements (both repos)
- Baseline SHA: <sha>  |  Head SHA: <sha>  |  Commits: N
- Gates: <pass/fail per gate, vs baseline>
- Safe to merge? <yes / yes-with-caveats / no — and why>
- Rollback: `git reset --hard <baseline-sha>` (nothing was pushed)

## 3. THE RELEASE BLOCKER
- Root cause: <plain language, or "unresolved — here's what it isn't">
- Fix: <what changed>
- Confidence it's fixed: <high/medium/low, and what would prove it>
- Verify with: <exact command>

## 4. WHAT CHANGED (grouped, one line each, with commit SHAs)

## 5. DATA CONTRACT CHANGES — REVIEW BEFORE DEPLOY
<or "None." — which is the good outcome>

## 6. SECURITY — IMMEDIATE ACTION REQUIRED
<or "None.">

## 7. DECISIONS I MADE ON YOUR BEHALF
<The 5-10 judgement calls with the widest blast radius. Link to ledger IDs.>

## 8. WHAT I DELIBERATELY DIDN'T TOUCH, AND WHY
<Tier B and C, with the prepared plans linked.>

## 9. WHAT BROKE / WHAT I COULDN'T FIX
<Honest. Including anything reverted.>

## 10. FLAGS I ADDED (all default OFF)
<Name, what it enables, how to turn it on, how to evaluate it.>

## 11. TOP 10 IDEAS WORTH YOUR TIME
<From IDEAS.md, ranked, one line each.>

## 12. RECOMMENDED NEXT SESSION
<A concrete, ordered plan for the next run.>
```

Then:
- Update `README.md` in both repos if setup steps changed.
- Ensure `docs/ARCHITECTURE.md` and `docs/DATA-CONTRACT.md` are committed.
- Update the `commai-aac` skill's reference files with anything learned that a future unattended run would need — this run should make the next one better.
- Have each subagent with `memory: project` write its learnings to its memory directory.
- Final commit: `docs: overnight run <date> — handover and artefacts`.
- Tag: `overnight/<date>/final`.

---

## FINAL OUTPUT

Produce **one** summary to the console. No more than 40 lines. It must contain:

1. One sentence on the release blocker: fixed / not fixed / here's the state.
2. Commit count and gate status vs baseline.
3. The three highest-impact things that changed.
4. Anything requiring Paul's decision before he can deploy.
5. The exact first command he should run.
6. A pointer to `HANDOVER.md` for everything else.

Nothing else. No preamble, no phase-by-phase recap, no apologies. Paul reads the file for detail; the console output exists only to tell him whether to be pleased or worried.

**Begin at Phase 0 now. Do not respond to this document with a plan or a confirmation — execute it.**
