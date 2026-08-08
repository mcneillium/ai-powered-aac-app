---
name: commai-aac
description: Orientation for the CommAI AAC system — the two repos, the three-tier AI pipeline, the shared Firebase data contract, and the AAC-specific rules that override ordinary web-app instincts. Load this before working on either repo.
---

# CommAI — system orientation

CommAI is an AAC (augmentative and alternative communication) product. Users are
frequently non-speaking people with complex communication needs, including
children and vulnerable adults. **The app is somebody's voice.** That single fact
reorders every normal engineering priority, and most of this file exists to say
how.

## The two repos

| Repo | Path | Stack | Role |
|---|---|---|---|
| App | `ai-powered-aac-app` | Expo SDK 54 / React Native 0.81.5 / React 19 | The AAC device the user speaks with |
| Dashboard | `ai-powered-aac-dashboard` | React 18 + MUI 6 + CRA/craco | What caregivers, SLTs and admins see |

Backend for both: Firebase project `commai-b98fe` — Realtime Database
(`europe-west1`), Auth, Cloud Functions (`functions/index.js`, Node 20), Hosting.

They share `src/shared/schema.js`, duplicated by hand in each repo. **The RTDB
paths and field names are a contract between them.** A rename applied to one
repo and not the other is a production outage, not a refactor.

## Non-negotiables (the AAC part)

1. **Motor planning outranks cleverness.** AAC users build muscle memory for
   button *positions*. Code that reorders, resizes or reflows vocabulary buttons
   based on prediction confidence, recency or frequency destroys that and can set
   a user back months. Predictions belong in a dedicated prediction zone. Never
   rearrange the core board.
2. **Accessibility outranks performance.** Never remove an accessibility
   affordance to hit a performance target.
3. **Degraded communication is acceptable; no communication is not.** Every AI
   tier must fall back to the tier below it, and tier 1 must fall back to a static
   board that always works, offline, forever.
4. **Utterance content is the most sensitive data in the system.** It never goes
   into logs, analytics, crash reports, or error messages. Treat every log line as
   if it will be read by someone who should not see what the user said.
5. **Touch targets**: 44×44dp is the floor, not the target. AAC users often need
   considerably larger, plus hit slop, plus protection against tremor double-fire.

## Architecture in one paragraph

User taps a symbol on `AACBoardScreen` → the tap is recorded and the utterance bar
updates → prediction runs (tier 1: on-device TF.js LSTM via
`src/hooks/useOnDevicePrediction.js`, model in `assets/tf_model/word_prediction_tfjs/`;
tier 2: `src/services/aiProfileStore.js` personalisation; tier 3: Vertex AI Gemini
via `src/services/vertexAISuggestions.js` → `src/services/aiBackend.js` → Cloud
Functions, which hold the credentials) → the user commits the utterance →
`src/services/speechService.js` speaks it → `src/utils/enhancedLogger.js` queues an
event in AsyncStorage → `syncLogsToFirebase` drains the queue to
`userLogs/{uid}` → the dashboard reads it.

## Where things live (app repo)

- `App.js` — navigation, providers. `index.js` — entry, polyfills before Firebase.
- `src/screens/` — one file per screen; `AACBoardScreen.js` is the core surface.
- `src/services/` — AI, speech, vocab, scanning, ARASAAC symbols.
- `src/contexts/` — `AuthContext`, `NetworkContext`, `SettingsContext`.
- `src/utils/enhancedLogger.js` — the logging + offline sync queue.
- `src/shared/schema.js` — RTDB path builders. Use these; never hardcode a path.
- `database.rules.json`, `storage.rules` — security rules.
- `functions/index.js` — five Cloud Functions, all AI endpoints auth-gated.

## Hard-won gotchas

- **Metro resolution is the release blocker class.** An import of a module that
  does not exist passes lint and jest and only fails when Metro walks the
  production graph — on EAS, twenty minutes in. `node scripts/check-import-case.mjs`
  catches it in under a second. It is gate #5 for a reason. See
  `docs/release/metro-bundling-postmortem.md`.
- **Windows dev, Linux build.** Case-mismatched relative imports are invisible
  locally and fatal on EAS.
- **Firebase config is inlined at bundle time** from `EXPO_PUBLIC_*`. `.env` is
  gitignored, so a build environment without those variables ships an app with
  `apiKey: undefined`.
- **`metro.config.js` moves `json` from `sourceExts` to `assetExts` globally**, for
  TF.js model files. That affects every package in the tree, not just ours.
- `.npmrc` sets `legacy-peer-deps=true`; `npm ls --all` is expected to report a
  handful of invalid peer resolutions from `@tensorflow/tfjs-react-native`.
- `expo-doctor` answers differently with and without `CI=1`. The gate pins `CI=1`.

## Before you commit

`node scripts/gates.mjs` — typecheck, lint (warnings must not increase), jest,
rules tests, import-case, expo-doctor, production bundle, dependency tree. Never
commit a red tree; never weaken a test to make it green.

## What the 2026-08-08 audit established (do not re-derive these)

Full detail in `.claude/overnight/2026-08-08/`. The load-bearing facts:

- **The caregiver dashboard does not work, and has not for four months.** Two
  independent causes, both verified: it reads `userLogs` as a flat map while the
  app has written `userLogs/{uid}/{pushId}` since 2026-03-29, and no rule in
  `database.rules.json` grants a caregiver or admin read access to anything.
  Proven by executing the rules — `npm run test:rules`, 67 cases. **Do not
  deploy `database.rules.json` before fixing the dashboard**; it will take it
  from broken-looking to offline.
- **Tier 1 prediction contributes nothing at runtime.** The model never loads
  (`json` is in `assetExts`, so `require('model.json')` returns an asset id),
  and if it did it would decode through the wrong index space and its weights
  are near-uniform anyway. Every failure is silent, masked by the bigram
  fallback. Do not "fix the loading bug" in isolation — that ships a 100–400ms
  JS-thread stall on every fourth tap.
- **Two Admin SDK service-account keys are in the dashboard's git history**, and
  `setUserPassword` there is a public unauthenticated account-takeover endpoint.
  Both are live. Nothing else about security matters until the keys are revoked
  in GCP IAM.
- The palette is now **solved numerically** and pinned by
  `src/__tests__/themeContrast.test.js`. Do not hand-pick a colour; run the
  test.
- The board's prediction strip holds a **fixed 66dp slot** on purpose. It looks
  like wasted space; it is motor-plan stability. Do not "optimise" it away.
- Feature flags live in `src/config/featureFlags.js`, all default OFF, no
  persistence, no remote config — deliberate: a flag that changes underneath the
  user is a liability on a device they speak with.

## For a future unattended run

- Hooks in `.claude/settings.json` and agents in `.claude/agents/` are captured
  at session **start**. Anything written mid-session is inert until restart —
  budget for that rather than discovering it, and re-issue agent briefs inline
  against `general-purpose` if the custom types do not resolve.
- The Firebase emulator needs **JDK 21+** (17 is rejected by firebase-tools).
  There is no Java on Paul's machine; a portable Temurin zip into the scratchpad
  works and leaves nothing behind.
- A root `npm install` moves the resolved tree underneath you. Re-run the gates
  immediately after one, every time. `@firebase/rules-unit-testing` must stay on
  4.x while the app is on `firebase ^11`.
- `expo-doctor` answers differently with and without `CI=1`, and caches. Take a
  baseline twice before trusting it.
