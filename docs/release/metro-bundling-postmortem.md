# Postmortem — the versionCode 19 Metro bundling failure

**Status:** root cause identified and reproduced. The fix already shipped in
`194a416` (2026-08-02). A permanent gate now exists so this class cannot reach
EAS again.

**Investigated:** 2026-08-08, unattended run. Supersedes
`deployment-checklist.md` §4a, which recorded "did not reproduce" and offered a
hypothesis that this investigation has since disproven.

---

## What happened

versionCode 18 built on EAS and uploaded to Play Console. versionCode 19 failed
during Metro bundling. Local checks were all green, so there was nothing obvious
to look at, and the original EAS error text was not captured.

## Root cause

`src/screens/LoginScreen.js` imported a module that did not exist.

```js
// src/screens/LoginScreen.js:12   (at commit b8e817f)
import { logEvent } from '../utils/logger';
```

There is no `src/utils/logger.js`. The real module is
`src/utils/enhancedLogger.js`. `LoginScreen` is imported directly by `App.js:37`,
so it is in the production module graph — not dead code Metro could skip.

Metro resolves the whole graph before it emits anything, so the build dies here:

```
Android Bundling failed 7529ms index.js (1050 modules)
Error: Unable to resolve module ../utils/logger from ...\src\screens\LoginScreen.js
```

A second instance of the same class sat in `src/hooks/useOnDevicePrediction.js`,
which required `../../assets/tf_model/model.json` and
`../../assets/tf_model/group1-shard1of1.bin`. The real paths are one directory
deeper, under `assets/tf_model/word_prediction_tfjs/`. That hook is reached from
both `AACBoardScreen` and `EasySentenceBuilderScreen`, so it would have failed
the build too, immediately after the first one was fixed.

A third — `src/services/visionService.js` importing the deleted
`./hfImageCaption` — was only reachable from a test, so it never affected the
bundle. It is listed here because it is the same mistake and shows the pattern.

## How it was proven

1. Created a git worktree at `b8e817f`, the last commit before the August work —
   the tree versionCode 19 was built from.
2. Ran `node scripts/check-import-case.mjs` against it. Four unresolvable
   relative specifiers, two of them in the production graph. **7 seconds.**
3. Junctioned the *current, healthy, fully reconciled* `node_modules` into that
   worktree and ran the real production bundle:
   `npx expo export --platform android --clear`. It failed in 7.5 seconds with
   the error above. Full log: `.claude/overnight/2026-08-08/logs/metro-repro-vc18.log`.
4. Ran the same command at HEAD: succeeded, exit 0, 7.15 MB Hermes bundle.

Step 3 is the important one. It removes `node_modules` from the equation
entirely: the April tree fails even when given a known-good dependency tree.

## What it was **not**

Recorded so these do not get re-explored:

- **Not `node_modules` drift.** This was the previous session's hypothesis and it
  is disproven by step 3 above. The April tree fails against a healthy tree.
- **Not a lockfile or transitive-dependency change.** `npm ci --dry-run` reports
  the lockfile in sync with `package.json`. The only `package.json` change across
  the whole range is `@tensorflow-models/coco-ssd` being removed and
  `axios ^1.7.9 → ^1.19.0`.
- **Not Babel, Metro, Expo or TypeScript configuration.** `git diff b8e817f..HEAD`
  across `babel.config.js`, `metro.config.js`, `app.json`, `eas.json`,
  `tsconfig.json`, `index.js`, `.easignore` and `.npmrc` is **empty**. Nothing
  changed.
- **Not case sensitivity.** Windows-develops-Linux-builds is the usual suspect and
  it was checked first: zero mismatches, at HEAD and in the April tree. The
  imports were not mis-cased, they pointed at nothing.
- **Not TF.js native module resolution**, not asset extension handling, not
  circular imports, not a Node version difference, not a missing environment
  variable. All of those produce different failures, and none of them can produce
  this error message.

## Confidence

**High** that this is why the April tree cannot be bundled — it is reproduced,
deterministic, and takes 7.5 seconds.

**Medium** that this is precisely what versionCode 19 hit, and the reason for the
gap is worth stating plainly: nobody captured the original EAS error. The
identification rests on it being the same tree, the failure being deterministic,
and it occurring at the right stage of the build. Nothing else in that tree can
fail a Metro bundle *before* this does, because Metro resolves the graph first.

If a future build fails at bundling, **capture the full error text before
touching anything.** That single habit would have turned this from a two-session
investigation into a two-minute one.

## Why nothing caught it

| Check | Why it stayed green |
|---|---|
| `eslint` | `import/no-unresolved` is not enabled by `eslint-config-expo`, and the module resolver plugin was not configured to verify relative paths. |
| `jest` | `LoginScreen` had no test. An untested screen's imports are never executed. |
| `tsc --noEmit` | Passes, but there are zero `.ts` files — the gate is vacuous. |
| `expo-doctor` | Checks dependency versions and config, never the module graph. |
| Running the app in Expo Go | Metro resolves lazily in development; the failing module is only pulled in when the Login screen is first rendered, and a signed-in developer never sees it. |

That last row is the real lesson. **A development bundle is not a production
bundle**, and the difference is exactly where this class of bug lives.

## What now prevents it

1. **`scripts/check-import-case.mjs`** — resolves every relative `import`/`require`
   in the tree the way Metro would (extension probing, platform variants,
   directory indexes) and asserts the target exists *with exactly the on-disk
   casing*. Also flags directory imports with no index file and `require()` of a
   concatenated path. Runs in well under a second.
2. **Gate #5 in `scripts/gates.mjs`** — a full production Metro bundle to disk,
   plus the import check, both as absolute gates. Neither is graded on a curve.
3. **`scripts/preflight.mjs`** — the pre-EAS ritual: `npm ci` exactly as the
   container does it, the import sweep, the gates, a production bundle, and an
   assertion that the resulting bundle contains a resolved Firebase config. Run
   it before spending build minutes. Deliberately **not** wired to a git hook —
   it deletes `node_modules`, which is far too intrusive to do behind your back.

```
node scripts/preflight.mjs            # full, ~10 min
node scripts/preflight.mjs --no-install   # ~2 min, skips npm ci
```
