# Asset and data source/licence inventory — Voice v1.2.0

Compiled 2026-10-03 from:
- `docs/legal/licensing-review.md` (2026-10-02);
- `assets/branding/BRAND-GUIDE.md`;
- `src/screens/LicensesScreen.js`;
- `src/data/thirdPartyNotices.json` (summary only);
- `src/services/arasaacService.js`;
- the `assets/` tree;
- `assets/tf_model/word_prediction_tfjs/`.

> **Not legal advice.** This inventory comes from a code and repository review. A coding review records what the code does and what the files say. It does not establish legal compliance, ownership of rights, or whether a licence condition is met. Items marked **Unresolved** need an owner decision, and where noted, qualified legal review, before release.

## Inventory

| # | Asset / data | Source | Licence | Where used | Status | Decision needed before release |
|---|---|---|---|---|---|---|
| 1 | ARASAAC pictograms | `api.arasaac.org/v1` search and `static.arasaac.org/pictograms/{id}/{id}_{res}.png` (`src/services/arasaacService.js:4,17,45`). Fetched at runtime; none bundled | CC BY-NC-SA. arasaac.org gives **no version number** (checked again 2026-10-03). API is "only available for non-commercial applications" | Pictogram search and display, e.g. `EasySentenceBuilderScreen.js`. Credit in `LicensesScreen.js:15-17` | Verified (usage and credit). **Unresolved**: whether the publisher's purpose counts as non-commercial | Confirm non-commercial status, or get written confirmation from ARASAAC. Add credit to the store listing if screenshots show pictograms |
| 2 | `tokenizer.json` (5,000-word vocabulary) | Blob from commit `6fd1c4f` (2025-03-10). Contains CHAT codes `xxx`, `yyy` | Probably CC BY-NC-SA 3.0, **if** derived from CHILDES/TalkBank | `src/services/improvedModelLoader.js:9` (on-device prediction). Hedged credit in `LicensesScreen.js:21-24` | **Unresolved**. CHILDES origin is *suspected*, not documented | Confirm the source and which CHILDES corpora were used. Add corpus citations, or replace with a vocabulary under a clear licence |
| 3 | LSTM model `model.json` + `group1-shard1of1.bin` (~88 KB) | Commit `b72d37e` (2025-03-05). Keras 2.15, 21-token embedding. No training data or script in repo | Not stated (assumed the developer's own) | Bundled; loaded with `bundleResourceIO` | **Unresolved** (training-data provenance) | Record the training data and its licence, or retrain on data you document |
| 4 | "VOICE" icon artwork: `icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`, `branding/logo/icon-1024.png` | Commit `fefc293` (2026-03-30). BRAND-GUIDE calls them "designer-provided". Source artwork not in repo | Not stated | App icon, splash, store listing | **Unresolved** | Get written assignment or licence from the designer, and keep the source file |
| 5 | Generated brand assets: `adaptive-icon-background.png`, `branding/logo/brand-mark-256.png`, `adaptive-icon-foreground.png`, `branding/splash/*`, `branding/google-play/**`, `branding/motifs/soft-blobs-512.png` | `scripts/generate-brand-assets.py` (PIL with system DejaVu/Liberation fonts). Commits `be2ff48`, `3ac7a24` | Developer's own output. Font licences allow rendering into images | Store listing and adaptive icon background | Verified (low risk) | None |
| 6 | `assets/icon_1.png` | Expo template placeholder (`b72d37e`) | Expo template | Not referenced | Verified (unused) | Optional: delete |
| 7 | Emotion emoji | Unicode characters drawn by the OS font (`EmotionScreen.js`) | n/a; OS vendor's font licence | Emotion screen | Verified | None |
| 8 | Ionicons / Material Icons fonts (via `@expo/vector-icons` 15.1.1) | `node_modules` | MIT / Apache-2.0 | UI icons. Credited in `LicensesScreen.js:29-30` | Verified | None (texts are in the notices) |
| 9 | npm packages in the JS bundle (96 entries) | `src/data/thirdPartyNotices.json`, generated 2026-10-02 by `scripts/generate-third-party-notices.js` | MIT 73, Apache-2.0 16, "Apache-2.0 AND MIT" 1, ISC 2, BSD-3-Clause 2, BSD-2-Clause 1, 0BSD 1 | Settings › About › Credits & open-source licences | Verified (guarded by `src/__tests__/thirdPartyNotices.test.js`) | Re-run the generator after dependency changes |
| 10 | Native-only libraries (Android/iOS), e.g. OkHttp, Fresco, SoLoader, Folly, boost, glog, fmt, DoubleConversion; native parts of Expo modules | Gradle / CocoaPods via RN and Expo | Believed permissive (Apache-2.0, MIT, BSD, BSL-1.0). **Not individually checked** | Compiled into the binary | **Unresolved** | Generate native notices, e.g. with Google's OSS-licences plugin or an equivalent, and include them, or show they are covered |
| 11 | `an-array-of-english-words` 2.0.0 | npm (MIT; data from Letterpress word list, CC0) | MIT / CC0 | Not imported, so not bundled | Verified (unused) | Optional: remove the dependency |
| 12 | App source code | This repo | 0BSD (`package.json`); no LICENSE file | — | Verified (declared) | Optional: add a LICENSE file. 0BSD does not cover items 1–3 |
| 13 | Firebase JS SDK, TensorFlow.js | npm | Apache-2.0; no NOTICE files found | Bundled | Verified | None beyond item 9 |

## Unresolved items (owner decisions)

1. **Tokenizer and model provenance** (items 2–3).
   - The CHAT codes `xxx` and `yyy` suggest CHILDES, so CC BY-NC-SA 3.0 would apply, with the MacWhinney (2000) citation and per-corpus citations.
   - TalkBank says commercial use excludes including the data in models.
   - The model weights' training data is undocumented.
   - Options: (a) document the source and add citations; (b) replace with a vocabulary and training data under a clear, ideally permissive, licence.
2. **"VOICE" icon artwork rights** (item 4). Who drew it, and has copyright been assigned or licensed? Needed before the icon ships as the store identity.
3. **Native-only library notices** (item 10). The generated notices list covers only JS packages. Native code needs its own notices.
4. **ARASAAC non-commercial status** (item 1). Free, no ads and no IAP is necessary but may not be enough. Confirm the publisher's purpose, or ask ARASAAC.
5. **Store-listing attribution.** If screenshots or the feature graphic show ARASAAC pictograms, the listing needs the ARASAAC credit.

## Notes

- Any future symbol set (Mulberry CC BY-SA 4.0, OpenMoji CC BY-SA 4.0, Sclera CC BY-NC 2.0, sets on Global Symbols) would need its own row here and per-symbol attribution metadata. See `docs/research/aac-landscape-2026-10.md` Part 2c. No replacement of ARASAAC is recommended.
- Adding `expo-haptics` (MIT) would add an npm row (item 9) and the Android `VIBRATE` permission.
