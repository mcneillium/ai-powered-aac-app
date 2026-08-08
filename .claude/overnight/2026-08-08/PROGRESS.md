# Overnight run — progress timeline (2026-08-08)

Append-only. One line per meaningful event. Times are local (BST).

## BASELINE

Captured 22:34–22:52.

### Rollback anchors

| Repo | Branch at start | HEAD SHA at start | WIP preserved as | Working branch |
|---|---|---|---|---|
| app (`ai-powered-aac-app`) | `master` | `7079c09c3dbf75a6aac0391df9f3318985562698` | `overnight/2026-08-08/pre-existing-wip` @ `7415345` | `overnight/2026-08-08/improvements` |
| dashboard (`ai-powered-aac-dashboard`) | `main` | `18967d331c4f76bc8f706771efcc92a8cfd722eb` | `overnight/2026-08-08/pre-existing-wip` @ `a7bec76` | `overnight/2026-08-08/improvements` |

Both trees were dirty at start. Nothing was discarded — see D-001.

- app: `functions/package-lock.json` (a stray `"peer": true` on `firebase-admin`),
  plus untracked `OVERNIGHT-RUN.md` and `docs/release/MORNING-HANDOVER.md`.
- dashboard: `.firebase/hosting.YnVpbGQ.cache` (a hosting deploy artefact).

### Size and shape

| Metric | app | dashboard |
|---|---|---|
| Source files (`src/`) | 62 | 56 |
| Source LOC (js/jsx under `src/`) | 9,752 | not yet measured |
| Root-level js/json files | 13 | — |
| Cloud Functions | 5 (`functions/index.js`, 476 LOC) | shares the same backend |
| Direct dependencies | 35 prod + 11 dev | 19 prod + 2 dev |
| Packages installed (`node_modules` top level) | 743 | not yet measured |
| Test files | 19 suites in `src/__tests__/` | 2 (`App.test.js`, `shared/schema.test.js`) |
| `database.rules.json` | 102 lines | shared |
| `storage.rules` | 54 lines | shared |
| Rules tests | **none** | **none** |

### Gate baseline (app repo) — `node scripts/gates.mjs --label=phase0`

| Gate | Result | Value |
|---|---|---|
| typecheck (`tsc --noEmit`) | PASS | 0 errors. Note: **0 `.ts`/`.tsx` files exist**; this gate is currently vacuous. |
| lint (`eslint . --ext .js,.jsx`) | PASS | 0 errors, **14 warnings** across 12 files → the baseline to not exceed |
| test (`jest --ci`) | PASS | **19 suites, 130 tests, 0 failures**, 1.4s |
| rules | SKIP | `test/rules/` does not exist |
| import-case | PASS | 139 relative specifiers across 73 files, 0 violations |
| expo-doctor | PASS | 18/18 checks under `CI=1` (see D-005 — it answers differently without `CI`) |
| bundle | PASS | **7,147,473 bytes** Android Hermes bundle (`.metro-smoke`), 12 MB total export |
| tree (`npm ls --all`) | PASS | 4 invalid peer resolutions, all from `@tensorflow/tfjs-react-native` |

Coverage: **not instrumented.** No `--coverage` config, no threshold. Recorded as
unmeasured rather than guessed.

Cold start: **unmeasured.** No instrumentation exists and measuring it needs a
device; recorded as a gap rather than estimated.

### Code hygiene counters

| Counter | app |
|---|---|
| `TODO` / `FIXME` / `HACK` / `XXX` in `src` + `functions` + root | 583 (dominated by `functions/node_modules`; app-source figure to be isolated in Phase 3) |
| `console.log` in `src/` + `App.js` + `index.js` | 14 |
| All `console.*` in the same scope | 64 |

### Cloud Functions

Five exported, all in `functions/index.js`: `imageCaptionProxy`,
`aacPhraseSuggestions`, `imageToAACPhrases`, `ocrToAACPhrases`, `pruneUserLogs`.
`engines.node = "20"`. Region and IAM to be confirmed in Phase 3.D.

---

## TIMELINE

- `22:34` Confirmed both repos dirty. Preserved each tree on
  `overnight/2026-08-08/pre-existing-wip` (D-001), branched
  `overnight/2026-08-08/improvements` from it in both.
- `22:34` Created `.claude/overnight/2026-08-08/{,logs}`, `.claude/agents`,
  `.claude/hooks`.
- `22:36` `.claude/skills/` does not exist — the `commai-aac` skill referenced by
  OVERNIGHT-RUN.md §0.C has never been created (D-002).
- `22:38` Baseline eslint: 0 errors, 14 warnings.
- `22:39` **Production Metro bundle of HEAD succeeded** (exit 0, 7.15 MB). The
  release blocker does not reproduce at HEAD — consistent with the 2026-08-05
  session's finding.
- `22:41` Wrote `scripts/check-import-case.mjs`. Clean against HEAD.
- `22:42` `npm ci --dry-run` → "up to date". Lockfile is in sync with
  `package.json`; a failed container install is **not** the cause.
- `22:44` Config diff `b8e817f..HEAD` (April → now): **zero changes** to
  `metro.config.js`, `babel.config.js`, `app.json`, `eas.json`, `index.js`,
  `tsconfig.json`, `.easignore`, `.npmrc`. Only `package.json` moved
  (`@tensorflow-models/coco-ssd` removed, `axios ^1.7.9 → ^1.19.0`). Rules out the
  whole Babel/Metro-config hypothesis class.
- `22:46` **Root cause found.** Ran `check-import-case.mjs` against a worktree at
  `b8e817f` (the last pre-August commit, i.e. the versionCode-19-era tree): four
  unresolvable relative imports, two of them in the production module graph.
- `22:49` **Root cause reproduced empirically.** Bundled the April tree against
  the *current healthy* `node_modules` (junction). Failed in 7.5s:
  `Unable to resolve module ../utils/logger from src/screens/LoginScreen.js`.
  This disproves the previous session's `node_modules`-drift hypothesis: the
  drift was reconciled and the April tree still fails. Log:
  `logs/metro-repro-vc18.log`. (D-003)
- `22:50` Baseline jest: 19 suites / 130 tests green. Baseline `expo-doctor`
  (no `CI`): 1 check failed, 8 packages out of date.
- `22:51` Wrote `.claude/hooks/guard.mjs` and unit-tested all 10 rules across 15
  commands — every block and every allow behaved correctly.
- `22:52` **The guard hook is registered but inert this session** — Claude Code
  captures hooks at startup, so a mid-session registration does not take effect.
  Confirmed by a live `firebase deploy --dry-run` passing through unblocked.
  Logged in `RISKS.md`; proceeding with heightened manual care. (D-004)
- `22:52` `firebase deploy --only database --dry-run` (the one deploy-family
  command that is safe, and it ran before the guard was in place) reports
  **`rules syntax for commai-b98fe-default-rtdb is valid`** — closes the first
  checkpoint of Phase 2.B.
- `22:53` Wrote `scripts/gates.mjs` + `scripts/gates.baseline.json` and
  `scripts/preflight.mjs`. First full gate run: **7 pass, 0 fail, 1 skip**.
- `22:55` Wrote the 11-agent fleet into `.claude/agents/` and created the missing
  `commai-aac` skill.
