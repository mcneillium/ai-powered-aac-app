# Current release gates

Reviewed 2026-10-04, release-readiness branch based on
`8a04b4c8181883970b629b1935e96281fe5a8284` (PR #15). Older "GO", "DONE",
signing and submission documents are historical; they do not certify this
integrated source or a regenerated native project. Record final source and
artifact evidence before closing these gates.

JavaScript export is not an installable APK. Unit tests are not phone,
screen-reader, listening or cloud-operation evidence.

## Installable Android test build

| Gate | Completion evidence | Owner |
|---|---|---|
| Final source checks | Final SHA, clean build checkout; lint, full Jest and Android export results; integrated diff review | Coordinator |
| Native APK | Successful final-source build; package/name/version, ABI, signing-certificate SHA-256, APK checksum, manifest permissions | Native QA |
| Test identity | Verified reusable test key for update, or separate package/name if unavailable. Do not uninstall the communication app to solve a mismatch | Coordinator/native QA |
| Install/launch | Install exact APK; cold launch offline, board/message/speech, Stop/Clear/Undo, restart persistence | Record emulator and phone evidence separately |
| Delivery | Extracted APK, `SHA256SUMS.txt`, `BUILD-NOTES.md`: SHA, identity/version/certificate, install steps, performed/unperformed checks | Owner's `AAC/Builds/YYYY-MM-DD_<commit>/`; update `Latest/` after verification; checksum every copy |

## Public Android release

| Gate | Concrete remaining evidence | Owner |
|---|---|---|
| Consent/guest networking | No unsolicited anonymous sign-in; device-only AI/photo/learning choices; remote settings cannot grant consent; explicit ARASAAC lookup disclosure/action; no guest account sync. Test fresh/old settings and remote snapshots | Engineer/privacy review |
| Account deletion | Remove Auth and `users`, `userSettings`, `userLogs`, `userSync`, `customVocab`, `vocabRequests`, `feedback`; failed/recent-login cases report no success. Pending local writes/imports/diagnostics/feedback/cloud sync cannot recreate data after deletion/restart | Engineer/isolated cloud QA |
| Cloud operations | Intended Firebase/function configuration; deployed owner-only rules and negative-access tests; synthetic successful AI responses, auth rejection/rate handling; verified diagnostic pruning/provider retention | Publisher/backend owner |
| Privacy/deletion pages | Configured `https://paulmartinmcneill.com/commai/privacy-policy` was verified to return HTTP 404 during this preparation. Verify public access, accurate inventory and external account deletion request path/provider deletion process | Publisher |
| Data Safety/audience | Complete corrected draft against binary/SDK and operational evidence, including UID/session diagnostics, vocabulary, optional prompts/photos/feedback/exports. Declare actual age groups/content rating | Publisher |
| Child audience decision | Child/Adult presentation is not an age screen/parental consent. Review API/SDK terms and camera/authentication data for the chosen child/mixed audience; implement applicable Families requirements | Publisher |
| Native communication | Final build checklist H–I and relevant A–G: modes, learned positions, fonts/insets, camera denial, Stop/rapid speech, learning pause/reset, upgrade preservation/deletion races | Authorized device tester; old PR7 emulator results are historical |
| New workflows | Native photo scenes, drafts/repair, conversation workspace, import preview, JSON/PDF sharing, every readable paper page and external files after chooser closes; edit lock/accessibility of confirmations | Native QA/human reviewer |
| Human accessibility/usability | Actual TalkBack/intended OS and in-app switch navigation, TTS listening, intended-user/partner task outcomes | Human testers; mocks/screenshots do not certify these |
| Production artifact/update | Inspect actual signed production AAB, version code/upload certificate, data-preserving upgrade; revalidate generated Gradle signing behaviour | Publisher/native QA |
| Store materials | Final-source screenshots/description, support contact, verified URLs, accurate platform/function claims and applicable asset credits | Publisher |

## Asset decisions

| Item | Concrete source gap | Completion evidence |
|---|---|---|
| ARASAAC | Runtime download/search; in-app Sergio Palao/ARASAAC/Government of Aragón/CC BY-NC-SA credit. Official terms exclude commercial product/publication use | Document intended non-commercial use or applicable permission; retain credits in app/materials showing pictograms. Downloading at runtime does not settle usage conditions; licence version unconfirmed |
| Voice artwork | Shipped icon/adaptive/splash files described as designer-provided without documented rights | Record actual creator/licence/assignment |
| Native notices | JS/icon-font notices exist; native Gradle/CocoaPods graph not covered by inventory | Review final native dependencies and include required notices |
| Old model/tokenizer | `assets/tf_model/` remains; current predictor uses `src/services/prediction/baseModel.json`; historical inventory contradicts itself about shipping | Inspect final export/APK asset list; document provenance/rights or exclude any shipped legacy assets. Repository/evaluation distribution remains a separate provenance question |
| Changed dependencies | Notice generator/regression test exist; final versions come from lockfile | Regenerate/review notices after dependency changes |

## Primary sources checked 2026-10-04

- [ARASAAC terms](https://arasaac.org/terms-of-use): official indexed terms
  confirm credit/non-commercial restrictions; raw HTML requires JavaScript;
  no licence version established by this check.
- [Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en):
  off-device/SDK collection, local-processing exclusion, sharing exceptions.
- [Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en):
  external request resource and in-app path for account-creation apps;
  service-provider data belongs in deletion review.
- [Play Families](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en):
  child/mixed audience API/SDK and sensitive-data requirements.

iOS is separate: no current signed iOS build/device/submission evidence is
established here. No merge, production deployment or store submission is
authorized by this checklist. This records facts and open gates; it does
not declare legal compliance.
