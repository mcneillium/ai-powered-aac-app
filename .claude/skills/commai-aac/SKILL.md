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
