# Deployment Checklist — Voice (AAC app)

Updated 2026-08-02. Complete the **Backend** section before shipping any
client build — the client now depends on authenticated Cloud Functions.

## 0. Security prerequisites (blocking — do these first)

- [ ] Revoke both leaked Firebase Admin SDK keys in GCP IAM
      (`firebase-adminsdk-fbsvc@commai-b98fe`, key ids `1136dd44…`, `f0aff750…`),
      then purge them from the dashboard repo history (`git filter-repo`).
- [ ] Revoke the old Hugging Face token (`hf_NHyU…`) and Google Cloud Vision key
      (`AIzaSyD4WZ…`) if not already done.
- [ ] Create a fresh HF token and store it as a Functions secret:
      `firebase functions:secrets:set HF_TOKEN`
- [ ] Enable the **Anonymous** sign-in provider in Firebase console
      (guests need it for the authenticated AI endpoints).

## 1. Backend deploy (app repo)

- [ ] `cd functions && npm install`
- [ ] `firebase deploy --only functions` — deploys the authenticated AI
      endpoints, removes `cleanupLegacyLogs`
- [ ] `firebase deploy --only database` — deploys rules incl. the new
      `feedback` section
- [ ] `firebase deploy --only storage` — first-ever deploy of storage.rules;
      verify bucket access afterwards
- [ ] Verify with no Authorization header the AI endpoints return 401
- [ ] (Recommended) Enable Firebase App Check for a second abuse layer

## 2. Backend deploy (dashboard repo)

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

- [ ] `npm install`
- [ ] `npx eslint . --ext .js,.jsx` → 0 errors
- [ ] `CI=1 npx jest` → all suites green
- [ ] `npx expo export --platform android` → bundles without resolution errors

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
