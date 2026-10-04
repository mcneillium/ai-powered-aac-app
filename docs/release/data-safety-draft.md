# Data Safety working draft

Reviewed 2026-10-04 against the release-readiness branch, starting at
`8a04b4c8181883970b629b1935e96281fe5a8284`. This is a source-level inventory,
not a submitted declaration. Recheck the final binary, its configuration and
deployed services before completing Play Console. See `current-release-gates.md`.

This replaces the August draft: local-only learning was incorrectly marked
collected; account IDs and synced diagnostics were omitted; online suggestions
were incorrectly described as enabled by default; retention, encryption at
rest and complete deletion were asserted without operational evidence.

Google Play defines collection as transmission off the device. Local-only
processing is outside that definition. Optional/ephemeral transmissions and
SDK behaviour still require review in the form. Service-provider and
user-initiated transfers can qualify for sharing exceptions; confirm the
applicable relationship before selecting answers. [Official guidance][1]

## Data flows

| Feature / data | Local use | Off-device path | Declaration work |
|---|---|---|---|
| Boards, drafts, favourites, spoken history | On-device stores | No routine sync found; history can enter optional AI requests below | Local use alone is not collection |
| Personal prediction/profile | Optional local words, pairs and counts | No learned-model upload found | Do not mark local learning collected solely because it is saved |
| Account registration | Optional email/password account; name/role | Firebase Auth; `users/{uid}` stores email, name, role, creation timestamp | Email, name, UID and authentication handling; account management/functionality |
| Settings | AsyncStorage primary | Signed-in `userSettings/{uid}` | Preferences/app activity; final serialized fields. AI/learning consent must remain device-only |
| Custom vocabulary/requests | Labels, categories, IDs, timestamps, tombstones | Real-account `customVocab/{uid}`, `vocabRequests/{uid}` | User-created content; imported labels can sync after confirmation |
| Diagnostics/activity | Bounded local queue | Signed-in `userLogs/{uid}`, `userSync/{uid}` | Activity/diagnostics and IDs; functionality/troubleshooting |
| Online phrase suggestions | Local predictions remain available | Current words, up to three recent history texts, time-of-day label to Cloud Functions then Google Vertex AI | Communication content; optional functionality/personalisation |
| Photo description/OCR | Selected camera/gallery preview | Base64 to Cloud Functions; description uses Hugging Face captioning and Vertex AI; OCR uses Vertex AI | Photos and content within them; optional functionality |
| Tile photos/photo scenes | Private files, scene labels/points/phrases | No automatic cloud photo sync found | Separate from online Camera feature |
| ARASAAC | Native downloaded board pictures work offline | Fixed image URLs to `static.arasaac.org`; explicit category/search text to `api.arasaac.org` and image requests | Search text may be personal; provider sees network metadata. Do not say nothing is sent |
| Feedback | Offline queue | Text, optional name/email, role, timestamp at `feedback/{uid}` | User content/contact info/UID; optional developer communications |
| JSON/PDF export | Private temporary cache | OS sharing to user-selected destination; labels/phrases and optional photos | Review user-initiated sharing exception; external copies remain |

Accounts are optional for communication. Cloud-disabled APKs cannot verify
cloud paths. Guests can explicitly choose network features; guest does not
mean no networking. Earlier versions automatically created anonymous Firebase
sessions at startup. The release candidate must create one only when needed
for an explicitly chosen online feature.

## Disclosures to retain

- Online phrases default **off** on new installs. Test saved-choice migration
  and prevent remote settings from enabling consent on another device.
  Requests carry Firebase ID tokens: omitting name/email from the generated
  prompt does not make the request anonymous. Typed content can identify users.
- Photo upload is a separate choice from online phrases. Camera permission
  is not upload consent. Turning phrase suggestions off does not disable a
  separately selected photo-processing feature.
- Diagnostic fields include timestamps, level, session ID, account IDs,
  counts, errors, platform and app version. The field whitelist does not
  redact arbitrary text in `action`/`error`. Current source callers log login
  events and login error codes, not sentence content; legacy queued records
  still need review before making a claim about every uploaded record.
- Vocabulary sync uploads meaningful personal labels. Photos are separate
  from vocabulary sync, but can be intentionally included in shared exports.

## Retention, security and deletion

`functions/index.js` shows no deliberate database persistence of AI images
or prompts. This does not prove provider retention or Cloud Logging behaviour.
Confirm deployed Vertex AI/Hugging Face configuration and processor terms
before selecting ephemeral processing or promising no retention.

Source defines daily pruning of `userLogs` entries older than 30 days. Its
deployment/success is unverified; it does not cover feedback, profile data,
provider records or all server logs. Do not promise universal 30-day retention.

Service URLs use HTTPS; backend checks Firebase tokens and applies best-effort
per-instance limits. Database rules restrict account paths to their owning
UID; deployment/negative-access tests remain necessary. AsyncStorage is not
an app-level encrypted vault. OS encryption/backup depends on device/build.

Local reset targets messages, words/photos, scenes, drafts, exports,
pronunciations and learning. Learning reset is narrower. Account deletion
must remove Auth and every database path, including feedback, and report
partial failures honestly. Test delayed save/import/sync operations cannot
recreate data. A signed-in local reset can be followed by vocabulary syncing
back from the account; it is not cloud deletion. External files and OS
backups are separate.

Account creation requires an in-app deletion path and a working external
request page identifying the app/developer and permitting requests without
reinstalling. State actual completion expectations and retention exceptions.
[Account deletion guidance][2]

## Before final submission

1. Record final binary configuration, SDKs, permissions and observed network
   destinations using synthetic fixtures.
2. Confirm categories, purposes, optionality, ephemeral status, sharing
   exceptions and provider retention for each flow.
3. Publish/verify accurate privacy and external deletion pages. A configured
   URL is not evidence of a working page.
4. Complete deletion failure/race checks and provider deletion process.
5. Declare actual age groups. Child/Adult presentation and edit lock do not
   establish age or parental consent. Review camera/authentication handling
   and API/SDK eligibility for the chosen audience. [Families policy][3]

[1]: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
[2]: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en
[3]: https://support.google.com/googleplay/android-developer/answer/9893335?hl=en
