# Production-Readiness Audit — August 2026

**Scope:** `ai-powered-aac-app` (Expo/React Native app + Cloud Functions) and
`ai-powered-aac-dashboard` (CRA admin dashboard + Cloud Functions). Both
target Firebase project `commai-b98fe`.

**Baseline at start of audit** (actual command results, not claims):
- `npx jest`: 3 of 20 suites failed to run, 2 of 117 tests failing
- `npx eslint`: 3 errors, 35 warnings
- Two unresolvable imports in the navigation tree meant the **Metro bundle
  could not build at all** — despite release docs stating "Zero code changes
  remain".

**Status after this pass:** 19 suites / 126 tests passing, 0 lint errors,
`npx expo export --platform android` bundles successfully. All findings
below resolved unless marked ⚠ (requires human/credentials).

---

## Critical (fixed)

| # | Finding | Resolution |
|---|---------|-----------|
| C1 | `AACBoardScreen` crashed on every render — five `useRef(fn)` calls read `const` callbacks before their declaration (temporal dead zone). The app's primary screen was unreachable. | Refs start empty and are populated by effects after declaration; scan handler calls are null-safe. |
| C2 | `useOnDevicePrediction` required `assets/tf_model/model.json` / `group1-shard1of1.bin`, which do not exist → Metro bundle failure. | Point at the real `word_prediction_tfjs/` assets; clamp token ids to the model's 21-token embedding range; filter `<PAD>`/`<UNK>` from output. |
| C3 | `LoginScreen` imported nonexistent `../utils/logger` → bundle failure; it also logged the user's **email address** into logs that sync to Firebase. | Import from `enhancedLogger`; email removed from log payloads. |
| C4 | Account deletion never cleared local data — `AsyncStorage` was used without being imported, and the `try/catch` swallowed the `ReferenceError` while telling the user everything was deleted. | Import added; deletion path now really clears local storage. |
| C5 | **Two live Firebase Admin SDK private keys committed to the dashboard repo** (`credentials/serviceAccountKey.json`, `credentials/AdminSetting/serviceAccountKey.json`). | Files deleted; `credentials/` and key patterns gitignored. ⚠ **Keys must be revoked in GCP IAM and git history purged — deletion alone does not invalidate them.** |
| C6 | Dashboard `setUserPassword` Cloud Function was an **unauthenticated HTTP endpoint that let anyone set any user's password** (account takeover). | Replaced with `onCall` requiring an authenticated admin (custom claim or DB role), input validation, no raw error echo. ⚠ Must be redeployed to take effect. |

## High (fixed)

| # | Finding | Resolution |
|---|---------|-----------|
| H1 | All four AI Cloud Function endpoints (`imageCaptionProxy`, `aacPhraseSuggestions`, `imageToAACPhrases`, `ocrToAACPhrases`) were unauthenticated with `Access-Control-Allow-Origin: *` — a free proxy to the project's Vertex AI/Hugging Face budget. | Every endpoint now verifies a Firebase ID token, rate-limits per user, caps payload sizes, sets `maxInstances`/`timeoutSeconds`, and times out upstream calls. Guests get anonymous Firebase sessions so the app still works without an account. ⚠ Redeploy required; enable the Anonymous sign-in provider; App Check recommended as a further layer. |
| H2 | `cleanupLegacyLogs` — unauthenticated destructive endpoint (its own comment said "remove after running"). | Removed. |
| H3 | `storage.rules` existed but was never deployed (`firebase.json` had no `storage` block). | Added. ⚠ Redeploy required. |
| H4 | Plaintext leaked Hugging Face token and Vision API key in two committed docs. | Redacted (history still contains them — rotation remains mandatory). |
| H5 | Switch scanning broke permanently after opening the Quick Repair overlay once (single-slot callbacks were overwritten and never restored), and the scan position reset on every render (page object identity churn). | Scan service gained save/restore context; overlay hands scanning back on close/unmount; `setScanItems` preserves position for unchanged ids; board memoizes the current page. Covered by new unit tests. |
| H6 | Privacy claims contradicted the code: sentence content and photos ARE sent to Google/Hugging Face, and the Settings copy said "All data stays on-device". Sentence builder also wrote sentence text into the log queue that syncs to Firebase. | Sentence-content logging removed; new "Online suggestions" toggle gates the only path sending sentence context off-device; Settings copy is now truthful; `data-safety-draft.md` rewritten to disclose AI processing. |
| H7 | AI personalisation opt-out not honoured on Sentence Builder or Emotion screens; learned data lost on app kill (flush never called). | All recording gated on the setting; profile flushed on app background. |
| H8 | Feedback was completely broken: DB rules denied `feedback/*` writes, so every online submit fell into an offline queue that nothing ever flushed. | Rules allow validated per-user feedback writes; queue flushes on reconnect and after successful sends. |
| H9 | Dashboard `PrivateRoute` let any signed-in account open admin pages. | `requireAdmin` prop; `/admin`, `/logs`, `/user-management`, `/finetune-metrics` require the admin role. |

## Medium (fixed)

- `functions.config()` (decommissioned) → Secret Manager (`HF_TOKEN`) and runtime `GCLOUD_PROJECT`; hardcoded project-id fallback removed.
- Prompt-injection hardening: prompts now instruct the model to treat user words and OCR'd text as content, never instructions; Vertex safety settings added; per-item length caps on `currentWords`/`recentPhrases`; `timeOfDay` allow-listed; image size caps on **all** image endpoints (caption proxy previously had none).
- 138 MB of unused ML model assets (`assets/childes_model/`, 21 weight shards) and the dead `localPredictor.js` that referenced them removed (recoverable from git history). Active prediction uses the 1.6 MB `word_prediction_tfjs` model. Also removed dead `visionService.js` (imported a deleted module, encouraged a client-side API key) and unused `@tensorflow-models/coco-ssd` dependency.
- Two unreachable screens removed: `CommunicationScreen` (never registered in navigation), `LiveSceneModeScreen` (unregistered **and** broken — never requested camera permission), plus unused `PhotoPreviewSection`. Documented here rather than silently dropped; both are in git history if wanted later.
- Stale tests deleted/rewritten: `improvedWordPrediction.test.js` tested a module that doesn't exist; `improvedModelLoader.test.js` asserted a refactor that was never merged. New tests cover the real API, the scan save/restore behaviour, and the authenticated backend client.
- `enhancedLogger`: queue-restore bug duplicated the queue on write failure (scope bug); device info was a hardcoded placeholder (`appVersion: '1.0.0'`); anonymous sessions no longer sync logs.
- Race conditions / stale state: debounced + cancellable pictogram search, cancellation guards in suggestion effects, `onRefresh` spinners can no longer hang, voices load failure no longer hides the picker forever, onboarding cannot trap the user on a storage failure.
- ARASAAC requests gained an 8s timeout (previously could hang loading states forever). `via.placeholder.com` fallback replaced with a local rendering.
- `ErrorBoundary` now remounts the subtree on "Try Again" (previously a deterministic error re-threw instantly).
- Settings: high-contrast theme rendered white text on yellow (≈1.5:1) on selected buttons — now palette-driven; stale hardcoded "v1.1.0" now reads `package.json`.
- Touch targets raised to ≥44 dp on sentence-bar actions, scan controls, emotion reset, overlay close, vocab category chips; missing accessibility labels/roles/hitSlop added on remove-word chips, category cards, and vocab edit chips.

## Known limitations / not addressed in this pass (⚠ = needs human)

1. ⚠ **Rotate/revoke**: both Admin SDK keys (GCP IAM), the old HF token, and the old Vision key; purge dashboard git history (`git filter-repo`) after rotation.
2. ⚠ **Deploy**: Cloud Functions (both repos), database + storage rules; set the `HF_TOKEN` secret; enable the Anonymous auth provider. Until redeployed, production still runs the insecure functions.
3. ⚠ **Dashboard data access**: admin pages read root `users`/`userLogs`/`caregivers`/`fineTuneMetrics` collections, which the (strict) rules in this repo deny. Either the deployed rules are dangerously loose, or the dashboard is broken in production. The right fix is admin-SDK-backed callable endpoints for dashboard reads; interim: verify what rules are actually deployed and reconcile. **Do not loosen the per-user rules.**
4. On-device prediction quality: the bundled model has a 21-token output vocabulary trained on CHILDES data; its suggestions are limited. It degrades gracefully (local profile + cloud suggestions carry most value). A retrained model with a matching tokenizer is the long-term fix.
5. i18n exists (`src/i18n/strings.js` with a full Spanish table) but has no language selector and most screens hardcode English. Wiring it is a coherent follow-up feature, not deployment-critical for an English-first release.
6. Physical switch/keyboard input (`handleScanKeyEvent`) is exported but not bound to any global key listener — on-screen scan controls work; external-switch hardware support needs a native key-event integration and device testing.
7. Onboarding renders in light theme regardless of system preference (first run only).
8. `pruneUserLogs` loads the whole log tree into memory; fine at current scale, will need pagination if the user base grows.
9. `RECORD_AUDIO` permission is declared but no feature records audio — consider removing before store submission to reduce review friction (left in place pending a product decision).
10. EU data residency: functions run in `us-central1` while RTDB/Vertex are `europe-west1` — consider relocating functions for GDPR posture and latency.

## Verification commands (all actually run)

```
npx eslint . --ext .js,.jsx            # 0 errors, 16 warnings (tests/scripts + benign hook-deps)
CI=1 npx jest                          # 19 suites, 126 tests, all passing
npx expo export --platform android     # bundles: 7.15 MB Hermes bytecode, no resolution errors
```

A production `.aab` build could not be produced in this environment (requires
EAS credentials); `npx expo export` bundling verifies Metro resolution and
asset requires end-to-end.
