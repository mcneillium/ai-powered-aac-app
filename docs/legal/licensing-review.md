# Licensing review — Voice (com.elpabloawakens.aipoweredaacapp) v1.2.0

Reviewed 2026-10-02 against the repository at HEAD, `node_modules` as installed, and primary licence sources.
This is a factual inventory, not legal advice. Items that could not be confirmed are marked **UNVERIFIED**.

Intended distribution: free app on Google Play (possibly the iOS App Store), no ads, no in-app purchases (IAP).

## Summary table

| Component | Licence | Source | Bundled / runtime | Obligations | Status |
|---|---|---|---|---|---|
| ARASAAC pictograms | CC BY-NC-SA (version not stated on arasaac.org; see Unverified) | arasaac.org Terms of Use (strings `app.components.licenseP1..P9` in https://arasaac.org/main.eb2f1395722f4150e4cd.js) | **Runtime only.** Fetched from `api.arasaac.org` / `static.arasaac.org`, not stored in the repo | Credit author, owner, origin and licence. Non-commercial use only. Derived works must use the same licence | Attribution present in Settings > About. Store screenshots need checking |
| Emotion emoji (`src/screens/EmotionScreen.js`) | n/a (Unicode characters) | `EmotionScreen.js` lines 24-39 and 236/259 render `<Text>{e.emoji}</Text>` | The OS font draws them. No emoji image or font is bundled | None for the app (the OS vendor licenses its own font) | OK |
| `@expo/vector-icons` 15.1.1 | MIT | `node_modules/@expo/vector-icons/LICENSE` (Joel Arvidsson 2015, 650 Industries 2020) | Bundled (JS and font) | Include the copyright and permission notice | No licence screen |
| Ionicons font | MIT | https://github.com/ionic-team/ionicons/blob/main/LICENSE | Bundled TTF (`build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf`) | Include the MIT notice | No licence screen |
| MaterialIcons font | Apache-2.0 | https://github.com/google/material-design-icons/blob/master/LICENSE. README: "We'd love attribution … but it's not required" | Bundled TTF | Apache-2.0 §4(a): give recipients a copy of the licence | No licence screen |
| App icon, splash, favicon, adaptive icon | Not stated (assumed to be owned by the developer) | git: introduced by commit `fefc293` (2026-03-30, "Resize icon assets…"). `assets/branding/BRAND-GUIDE.md` calls them "designer-provided" | Bundled | Confirm ownership or assignment from the designer | **UNVERIFIED** |
| Play Store graphics and templates, motif | Not stated (generated) | `scripts/generate-brand-assets.py` (PIL, draws text with system DejaVu or Liberation fonts). git `be2ff48`, `3ac7a24` | Store listing only (not used by the app) | DejaVu and Liberation licences permit rendering into images | OK (low risk) |
| `assets/icon_1.png` | Expo template placeholder | git `b72d37e` (2025-03-05). Not referenced anywhere | Not referenced in code or `app.json` | — | Unused |
| LSTM model (`model.json`, `group1-shard1of1.bin`) | Not stated (developer's own) | blobs date from `b72d37e` (2025-03-05). 21-token vocabulary | Bundled | None known. The training data is not in the repo | **UNVERIFIED** (training data) |
| `tokenizer.json` (5,000-word vocabulary) | Likely derived from CHILDES (CC BY-NC-SA 3.0) | blob from `6fd1c4f` (2025-03-10). Contains CHAT transcription codes `xxx` (#10) and `yyy` (#614). `docs/audit/production-readiness-audit-2026-08.md:64` says "trained on CHILDES data" | Bundled (`src/services/improvedModelLoader.js:9`) | CHILDES: non-commercial use, citation (MacWhinney 2000 and the specific corpus), ShareAlike for derived data | **Inferred, not documented.** No CHILDES citation in the app or repo |
| npm production dependencies (35 direct, 834 in the tree including build tools) | MIT, ISC, BSD, Apache-2.0, 0BSD, BlueOak, CC0, Unlicense | `node_modules/*/package.json` | Bundled JS and native code | Include the licence and copyright notices | No licence screen |
| Firebase JS SDK 11.10.0 | Apache-2.0 | `node_modules/firebase/package.json`. Upstream LICENSE at https://github.com/firebase/firebase-js-sdk (no NOTICE file) | Bundled | Apache-2.0 §4(a) and (c) | No licence screen |
| TensorFlow.js 4.16 / 4.22 | Apache-2.0 (tfjs-layers: "Apache-2.0 AND MIT") | `node_modules/@tensorflow/*/package.json`. Upstream LICENSE at https://github.com/tensorflow/tfjs (no NOTICE file) | Bundled | Apache-2.0 §4(a) and (c) | No licence screen |
| App source code | 0BSD (`package.json` `"license"`) | `package.json`. There is no root LICENSE file | — | None | Repo has no LICENSE file |

## 1. Symbols and pictograms

### ARASAAC
- **Usage.** The app calls `GET https://api.arasaac.org/v1/pictograms/{lang}/search/{text}` (`src/services/arasaacService.js:4,17`). It shows images from `https://static.arasaac.org/pictograms/{id}/{id}_500.png` (`src/screens/EasySentenceBuilderScreen.js:141,157`). The images are shown unmodified in a plain `<Image>`.
- **No bundling.** No file under `assets/` is an ARASAAC image: all PNGs are branding, icons or templates (see §2). `src/data/coreVocabulary.js` declares an optional `arasaacId` field in a typedef only (line 27), and no vocabulary entry uses it. The code has no explicit persistent cache: no `FileSystem` download and no AsyncStorage of images. The only caching is React Native's default HTTP image cache. `docs/release/v1.2.0-release-notes.md:101` lists an "Offline pictogram cache" as future work.
- **Licence text** (arasaac.org Terms of Use, English strings taken from the site bundle above):
  - P2: "Resources offered on the website (pictograms, images, locutions or videos), as well as the materials based on them, are published under Creative Commons License BY-NC-SA, authorizing their use for non-profit purposes providing the source and the author, and are shared under the same license."
  - P3: "Therefore, the use of these resources within any product or publication for commercial purposes is excluded."
  - P5: "Any work derived from the resources … must be distributed with the same [licence]. The author (Sergio Palao), the owner (Gobierno de Aragón), their origin (ARASAAC) and the license … must be cited."
  - P7, the first of two attribution forms: "The pictographic symbols used are the property of the Government of Aragón and have been created by Sergio Palao for ARASAAC, that distributes them under Creative Commons License BY-NC-SA."
  - The second form is built from the site's labels "Pictograms author:", "Origin:", "License:". It matches the app's current text.
  - P1: "ARASAAC is a brand of the Government of Aragon (Spain), registered in the Spanish Patent and Trademark Office." The name and logo are trademarks.
- **Current attribution in the app.** `src/screens/SettingsScreen.js:489` shows: "Pictograms' author: Sergio Palao. Origin: ARASAAC (https://arasaac.org). License: CC (BY-NC-SA). Owner: Government of Aragón (Spain)." This covers author, owner, origin and licence. It is shown only in Settings > About. It has no link to the licence deed, which CC BY-NC-SA 4.0 §3(a)(1) expects "where reasonably practicable".
- **What "non-commercial" means.** ARASAAC's terms say "non-profit purposes" and exclude "any product or publication for commercial purposes". The CC BY-NC-SA 4.0 legal code (https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en §1(k)) defines NonCommercial as "not primarily intended for or directed towards commercial advantage or monetary compensation".
  - A free app with no ads and no IAP fits this.
  - Any of the following would make the app a "product … for commercial purposes": a paid app, a subscription, IAP, ads, or bundling into a paid product or service. ARASAAC's terms say other uses need written authorisation (P4, P8d "contact us").
  - Neither source says anything specific about a commercial company publishing a free, non-monetised app. **UNVERIFIED**: ask ARASAAC if the developer account is a company.
- **ShareAlike.**
  - Displaying pictograms unmodified is not an adaptation.
  - Cropping, recolouring, compositing (for example board printouts or exports), or storing modified copies would create "Adapted Material". That material must be shared under BY-NC-SA (CC 4.0 §3(b)).
  - A future offline cache of unmodified images is redistribution of the original. It requires the attribution and licence to stay in the app, but it does not create an adaptation.
  - ShareAlike does not reach the app's own code, which is a separate work (see §4).
- **Store listing.** `docs/release/final-screenshot-capture-guide.md:29` plans screenshots that show "pictogram results". Screenshots containing ARASAAC pictograms reproduce them, so the listing text should carry the same attribution.
- **Options for symbols, described only.** Familiar symbols matter to AAC users, and switching sets has a real cost for them. Possible paths:
  - Keep ARASAAC under its terms.
  - Ask ARASAAC for written authorisation if monetisation is ever planned.
  - Offer an additional symbol set with different terms, alongside ARASAAC rather than replacing it.

### Emoji
`EmotionScreen.js` stores the emoji as string literals (lines 24-39, for example `'😊'`). It renders them in `<Text>` (lines 236, 259). The repo contains no emoji image files and no emoji font. The device's system font (Noto Color Emoji on Android, Apple Color Emoji on iOS) draws them, under the OS vendor's licence.

### Icons
The code imports only `Ionicons` and `MaterialIcons` from `@expo/vector-icons` (16 import lines in `src/`).
- `node_modules/@expo/vector-icons/LICENSE`: MIT.
- Upstream react-native-vector-icons README: "Any bundled fonts are copyright to their respective authors and mostly under MIT or SIL OFL" (https://github.com/oblador/react-native-vector-icons).
- Ionicons: MIT, "Copyright (c) 2015-present Ionic" (https://github.com/ionic-team/ionicons/blob/main/LICENSE). The notice must be included with copies.
- Material Icons: Apache-2.0 (https://github.com/google/material-design-icons/blob/master/LICENSE). The README says attribution in an About screen is welcome "but it's not required". The Apache-2.0 §4(a) requirement to supply the licence text still applies.

## 2. Bundled assets (`assets/`)

| Path | Provenance (`git log`, first commit with this exact blob via `--find-object`) | Notes |
|---|---|---|
| `icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`, `branding/logo/icon-1024.png` | `fefc293` 2026-03-30 (Claude session): "Resize icon assets…" | The "VOICE" bar logo. The source artwork is not in the repo. BRAND-GUIDE.md says these files are "designer-provided". **UNVERIFIED** who drew it and whether rights were assigned |
| `adaptive-icon-background.png`, `branding/logo/*` (others), `branding/splash/*`, `branding/google-play/**` | `be2ff48` 2026-03-25 | Generated by `scripts/generate-brand-assets.py` (PIL shapes, DejaVu or Liberation system fonts) |
| `branding/motifs/soft-blobs-512.png` | `3ac7a24` 2026-03-24 | Generated |
| `icon_1.png` | `b72d37e` 2025-03-05 (Paul Martin McNeill) | Expo blank-template placeholder (grid and circles). Not referenced anywhere |
| `tf_model/word_prediction_tfjs/model.json`, `group1-shard1of1.bin` | `b72d37e` 2025-03-05 (Paul Martin McNeill) | Keras 2.15 LSTM, embedding `input_dim` 21. The training vocabulary is the 20-word map `{"i","to","want",…,"home"}` from `git show b72d37e:assets/tf_model/tokenizer.json`. The training data and script are not in the repo, so **UNVERIFIED**. The 20-word vocabulary suggests a small hand-written sentence set |
| `tf_model/word_prediction_tfjs/tokenizer.json` | `6fd1c4f` 2025-03-10 (Paul Martin McNeill) | 5,000-word frequency-ranked vocabulary (`"." → 1, "?" → 2, "you" → 3 …`). Contains CHILDES/CHAT codes `xxx` (unintelligible) and `yyy` (phonological coding), plus `mhm` and `mummy`. These strongly suggest a CHILDES transcript source |
| `branding/BRAND-GUIDE.md` | `1ca8f28` etc. | Documentation |
| no font files | — | The app bundles no custom fonts other than the vector-icon TTFs in `node_modules` |

**Model training history.**
- `train_aac_model.py` (2025-07-20, `780f72d`; deleted in `dcffc07`) loaded `willwade/AACConversations`. That Hugging Face dataset is gated and licensed `cc-by-4.0` (https://huggingface.co/datasets/willwade/AACConversations). It postdates the bundled weights, so it did not produce them.
- `.github/workflows/train-model.yml` still calls `train_aac_model.py`, which no longer exists. `requirements-train.txt` lists `tensorflow`, `tensorflowjs`, `datasets`, `numpy`.
- Notebooks trained on "merged CHiLDES corpora" (`f2213f2`, `75b2a0d`, 2025-10-19). A 138 MB `assets/childes_model/` was added in `272865f` and removed in `194a416`. None of these are in the current build.

**CHILDES / TalkBank terms** (https://talkbank.org/0share/rules.html, https://talkbank.org/0share/citation.html; `/share/rules.html` returns 404):
- Copyright: "the use of TalkBank data is governed by the Creative Commons CC BY-NC-SA 3.0 copyright license". This "precludes the incorporation of the data in commercial products, including systems such as large language models (LLMs)". Commercial entities "may use the data for the development of algorithms … but the data themselves cannot be included in models."
- Citation: cite MacWhinney, B. (2000), *The CHILDES Project: Tools for analyzing talk*, 3rd ed., Lawrence Erlbaum, and the reference for each corpus used. Acknowledge grant "NICHD HD082736".
- Implication for the shipped `tokenizer.json`: if it is a CHILDES-derived word list, a free non-commercial app is within NC. ShareAlike and attribution would apply to that derived data, so the app should credit CHILDES/TalkBank and state the licence.
  - The citation rules are written for "published articles". The credit itself comes from the CC BY-NC-SA 3.0 Attribution clause.
  - Whether a bare word-frequency list is copyrightable at all is a legal question. **UNVERIFIED**.
  - Which CHILDES corpora were used is **UNVERIFIED**, so corpus-specific citations cannot be written yet.

## 3. npm production dependencies

Method: a Node script walks `dependencies`, `optionalDependencies` and installed `peerDependencies` from the root `package.json` and reads each `package.json` `license` field. `npx license-checker` was not used.

Direct dependencies:
- **MIT**: `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `@react-native-picker/picker`, all four `@react-navigation/*`, `an-array-of-english-words`, `axios`, `expo` and every `expo-*` package, `react`, `react-native`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens`.
- **ISC**: `idb`.
- **Apache-2.0**: `firebase` and all `@tensorflow/*` (installed `@tensorflow/tfjs` is 4.22.0; the others are pinned to 4.16.0). `@tensorflow/tfjs-layers` is "Apache-2.0 AND MIT".

Full tree, 834 packages: MIT 611, Apache-2.0 75, ISC 61, BSD-3-Clause 32, BlueOak-1.0.0 32, BSD-2-Clause 9, MPL-2.0 3, 0BSD 2, Unlicense 2, (MIT OR CC0-1.0) 2, CC-BY-4.0 1, Python-2.0 1, (BSD-3-Clause OR GPL-2.0) 1, (BSD-2-Clause OR MIT OR Apache-2.0) 1.

Licences flagged as not plainly permissive, all reached through `expo` → `@expo/cli` / `@expo/metro-config` (`npm ls`):

| Package | Licence | Path | Shipped in app binary? |
|---|---|---|---|
| `lightningcss` (+ linux binaries) | MPL-2.0 | `@expo/metro-config` | No. Build-time CSS tool |
| `caniuse-lite` | CC-BY-4.0 | `@expo/metro-config` → `browserslist` | No. Build-time data |
| `node-forge` | BSD-3-Clause OR GPL-2.0 | `@expo/cli`, `@expo/code-signing-certificates` | No (CLI). BSD can be chosen anyway |
| `type-fest` | MIT OR CC0-1.0 | build tooling | No (types only) |

No GPL-only, LGPL, AGPL, SSPL, CC-BY-NC, CC-BY-SA, UNLICENSED or unknown licences were found.

125 packages ship no LICENSE file in `node_modules`, including `firebase`, `@firebase/*`, `@tensorflow/*`, `expo` and `expo-*`, and `metro`. For these the `license` field is the only on-disk record. Upstream repositories do have LICENSE files: tfjs and firebase-js-sdk were checked.

- **`an-array-of-english-words` 2.0.0**: MIT (`node_modules/an-array-of-english-words/license`, © 2014 Zeke Sikelianos). Its data comes from the Letterpress word list, which is CC0 1.0 (https://github.com/lorenbrichter/Words/blob/master/LICENSE). Nothing in `src/` or `App.js` imports it, so Metro does not bundle it. It is an unused dependency, added in `5793e60` (2025-03-18).
- **Native third-party code** ships via React Native: RCT-Folly, boost, glog, fmt, DoubleConversion, fast_float (`node_modules/react-native/third-party-podspecs/`). Their licences were not individually checked. **UNVERIFIED** (believed to be permissive: Apache-2.0, BSL-1.0, BSD, MIT).

## 4. The app's own licence (0BSD)

`package.json` declares `"license": "0BSD"` and `"private": true`. There is no root LICENSE file, and the README has no licence section.

0BSD covers only the developer's own code and original assets. It does not and cannot relicense third-party material:
- ARASAAC pictograms stay CC BY-NC-SA.
- The CHILDES-derived vocabulary, if confirmed, stays CC BY-NC-SA 3.0.
- Dependencies keep their own licences.

The pictograms are fetched at runtime and shown unmodified, so the app is not an adaptation of them. ShareAlike therefore does not require the code to be CC BY-NC-SA, and a permissive code licence is compatible. If ARASAAC-derived images or CHILDES-derived data are committed to the repo, they should be labelled with their own licence so that 0BSD is not read as covering them.

## 5. Apache-2.0 obligations (Firebase JS SDK, TensorFlow.js, Material Icons)

Apache-2.0 §4 (https://www.apache.org/licenses/LICENSE-2.0) requires the following when distributing in any form, including object or binary form:
- (a) give recipients a copy of the licence;
- (b) mark modified files;
- (c) keep copyright and attribution notices;
- (d) if the work includes a NOTICE file, include its attribution notices in a readable form (for example "within a display generated by the Derivative Works").

NOTICE files:
- None ship in `node_modules/@tensorflow/*`, `node_modules/firebase` or `node_modules/@firebase/*` (`find … -iname '*notice*'` found nothing).
- Upstream `tensorflow/tfjs` and `firebase/firebase-js-sdk` have no root NOTICE file (both return 404 on raw.githubusercontent.com).
- The only NOTICE in the tree is in `xcode`, a build-time CLI package.

So §4(d) currently adds nothing for these packages, but §4(a) still requires the Apache-2.0 text to reach users.

The `@license` headers in the dist files (for example `@tensorflow/tfjs-core/dist/index.js`) may survive minification, because Terser's default keeps `@license` comments. Whether Hermes bytecode keeps them is **UNVERIFIED**, and a header inside the bundle is not a licence copy users can read. The usual way to meet §4(a) is an in-app "Open-source licences" screen or a bundled text file.

## Conditions for the intended distribution model (free Play/App Store app)

1. **ARASAAC.** Use is within the terms if the app stays free with no ads, IAP or subscriptions, and attribution stays visible. The current Settings > About text meets the wording requirement. Recommended additions:
   - a link to the CC BY-NC-SA licence deed;
   - the same credit in the store description, if screenshots show pictograms;
   - not using the ARASAAC logo or name as branding (it is a registered trademark).
2. **CHILDES-derived `tokenizer.json`** (if confirmed). Non-commercial use is fine. Attribution to CHILDES/TalkBank (MacWhinney 2000) and a licence statement are needed. The app has neither.
3. **Open-source notices.** MIT, BSD and ISC require the copyright and permission notice to be included with copies, and Apache-2.0 requires the licence text. The app has no licence or notices screen and no bundled notices file. This is not met.
4. **App store terms.** Google Play and Apple accept CC BY-NC-SA content in free apps as long as the licensor's terms are followed. Neither store imposes a licence screen, but the licences above do.
5. **Developer-owned assets.** Confirm rights to the "VOICE" icon artwork (**UNVERIFIED**).

## What would change if monetised

- **Ads, IAP, subscription, a paid app, or a paid "pro" tier**: the app becomes a commercial product.
  - ARASAAC P3 excludes this. Written authorisation from the Government of Aragón/ARASAAC would be needed (P4, P8d), or pictograms would have to be absent from the paid product.
  - CHILDES (CC BY-NC-SA 3.0) also precludes commercial products. TalkBank explicitly says the data "cannot be included in models" by commercial users. The tokenizer would need non-CHILDES provenance.
  - `willwade/AACConversations` (CC BY-4.0) allows commercial use with attribution, if it were used in a future retrain.
- **Donations or sponsorship** are not addressed by ARASAAC's text. **UNVERIFIED**: ask ARASAAC.
- **npm dependencies** (MIT, BSD, ISC, Apache-2.0) and the icon fonts (MIT, Apache-2.0) allow commercial use, so no change is needed beyond the notices.
- **Symbol options if monetisation is ever considered** (described only, no recommendation). Familiar symbols matter to AAC users, and continuity for existing users is a real cost. The options are:
  - negotiate a licence with ARASAAC;
  - keep ARASAAC in a free non-commercial edition;
  - offer an additional, commercially licensed or permissively licensed set as an option.

## Unverified items

- Which CC BY-NC-SA version ARASAAC applies. The extracted site strings say only "Creative Commons License BY-NC-SA". It is often cited as 4.0 elsewhere, but this was not confirmed on arasaac.org.
- Whether ARASAAC treats a free, ad-free app published by a company, or one accepting donations, as non-commercial.
- The training data for the bundled 21-token LSTM weights (`b72d37e`). No script or data is in the repo.
- The source of `tokenizer.json`: CHILDES is inferred from CHAT codes and audit doc line 64, and the specific corpora are unknown. Whether a word-frequency list attracts copyright or database rights is also unresolved.
- Who created the "VOICE" icon artwork and whether rights were transferred.
- Licences of React Native's native third-party libraries (Folly, boost, glog, fmt, double-conversion, fast_float).
- Whether `@license` comments survive into the Hermes production bundle.
- `talkbank.org/share/rules.html` (the URL given in the task) returns 404. The rules were read at `talkbank.org/0share/rules.html`.
