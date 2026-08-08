# Risks — found and deliberately not acted on (2026-08-08)

Everything here was seen, understood, and left alone. Each entry says why, and
what it would take to close.

---

## R-001 — The safety hook is written and inert until Claude Code restarts

**Severity:** medium (process risk, not product risk)

`.claude/hooks/guard.mjs` is registered as a `PreToolUse` hook for `Bash` in
`.claude/settings.json`. All ten rules were unit-tested against fifteen commands
and every block and allow was correct. But Claude Code captures hook
configuration at session start, so registering one mid-session does not arm it.
Verified live: a `firebase deploy --dry-run` ran through unblocked after
registration.

Tonight's guardrails were therefore enforced by discipline, not by machine.

**Consequence for Paul:** the hook *will* arm on his next Claude Code start in
this repo. It blocks `firebase deploy` (any non-dry form), `eas build`,
`eas submit`, force-pushes, pushes to `main`/`master`, `npm audit fix --force`,
`rm -rf` targeting `.git` or outside the tree, reads/writes of credential files,
and `git reset --hard` behind the run baseline. If that is unwelcome, delete
`.claude/settings.json`. If it is welcome, know that `firebase deploy` will be
blocked when he goes to deploy the rules in the morning — run those from a plain
terminal, not from inside Claude Code.

---

## R-002 — `.env` is gitignored, so an EAS build may ship with no Firebase config

**Severity:** high — but unconfirmed, and it needs Paul's Expo account to confirm

`firebaseConfig.js` builds the entire Firebase config from `EXPO_PUBLIC_*`
environment variables. Expo inlines those **at bundle time**. Verified: the local
export contains the resolved project id and database URL, so locally the `.env`
file is doing the work.

`.env` is in `.gitignore`. It is *not* in `.easignore`, and `.easignore` replaces
`.gitignore` for the EAS upload — but EAS CLI builds its archive from the git
working copy, and whether a gitignored-but-easignore-permitted file survives that
is version-dependent and I could not determine it from here without running a
build, which §0.2 forbids.

If the file does not reach the container, the shipped app initialises Firebase
with `apiKey: undefined` and `getDatabase()` throws at module scope — a crash on
launch, before the board ever renders.

**Why not fixed:** the fix is to put the values into EAS environment variables or
`eas.json`, and §0.2 forbids this run from touching or committing any `.env`
value. That is Paul's action and it takes two minutes.

**What was done instead:** added `.env.example` with the key names and
placeholder values (no real values), and a preflight assertion that the exported
bundle actually contains a resolved Firebase project id — so a config-less build
fails locally instead of on a user's phone. See the handover for the exact
`eas env:create` commands.

**How to settle it definitively:** `npx eas build --profile production --platform
android` and check the build log's "Uploading project" file list, or simply
launch the resulting build. versionCode 18 reached Play Console, which is weak
evidence the config does arrive — reaching Play Console does not prove the app
launched.

---

## R-003 — `metro.config.js` moves `json` out of `sourceExts` and into `assetExts` globally

**Severity:** medium

```js
assetExts.add('json');
config.resolver.sourceExts = config.resolver.sourceExts.filter((e) => e !== 'json');
```

This is done so TF.js can fetch `model.json` raw, and it works. But it applies to
**every package in the dependency tree**, not just ours. Any dependency doing
`require('./something.json')` and expecting a parsed object now receives an asset
reference. `@expo/vector-icons` glyphmaps are the visible instance — they appear
in the export as 26 separate JSON assets.

**Why not touched:** it currently bundles and the icons render, so the blast
radius of changing it is larger than the blast radius of leaving it. The correct
fix is a targeted resolver rule that treats JSON as an asset only under
`assets/tf_model/`, leaving the rest of the tree alone — that is a Phase 5/backlog
item with a real regression surface, not a 5am change.

---

## R-004 — `tsc --noEmit` is a vacuous gate

**Severity:** low

`tsconfig.json` exists and extends `expo/tsconfig.base`, and the gate passes —
but there are **zero** `.ts`/`.tsx` files in the repo. The gate currently proves
nothing. It is kept because it costs 5 seconds and starts being meaningful the
moment the first typed file lands. Recorded so nobody mistakes a green
`typecheck` for type safety.

---

## R-005 — `.gitignore` excludes bare `data`, `files`, and `credentials` at any depth

**Severity:** low, currently harmless

```
files
credentials
data
!src/data/
```

None of these have a leading or trailing slash, so they match a file *or*
directory of that name anywhere in the tree. `src/data/` is explicitly re-included
and is correctly tracked (verified: both files show in `git ls-files`). But the
next time anyone adds `src/services/data/` or `assets/files/`, it will be
silently untracked — and silently absent from the EAS upload, which is exactly
the shape of the versionCode 19 failure.

**Why not fixed:** changing ignore patterns can un-ignore something Paul
deliberately keeps out of git, and I cannot see what is on his disk that these
were written for. The safe fix is to anchor them (`/files/`, `/credentials/`,
`/data/`) after confirming what they were protecting.
