# Physical-device test checklist (Android + iOS)

These checks need a real phone or tablet; they could not be run in the
build environment (no Android hardware acceleration, no macOS for iOS).
Record device model, OS version, TTS engine/voice, and pass/fail per item.

**Devices to cover (minimum):** one small Android phone (≤ 5.5", e.g. 720×1280
or 360×640 dp), one recent Android phone with gesture navigation, one iPhone
with a notch/Dynamic Island, one iPad or Android tablet.

**Before starting:** install the release build; turn off Wi-Fi and mobile data
for section A; note the installed TTS engine (Android: Settings › Accessibility
› Text-to-speech; iOS: Settings › Accessibility › Spoken Content › Voices).

## A. Startup without cloud (build without `EXPO_PUBLIC_FIREBASE_*`, or offline)
| # | Steps | Expected |
|---|---|---|
| A1 | Launch the app with no Firebase config in the build | App opens to the board; no crash, no blank screen |
| A2 | Tap *I want* › *more* › Speak | Words appear; speech plays |
| A3 | Open Profile, Login, Settings › AI section | A "cloud unavailable" notice appears only on these; board shows no cloud notice |
| A4 | Add a favourite, kill the app, relaunch | Favourite and history are still there |
| A5 | Turn Wi-Fi or mobile data back on first. Build WITH Firebase, sign in on device 1, change speech speed; sign in on device 2 that has different local settings | Device 2 keeps local-only settings (e.g. text size) that were never synced; no setting resets to default |

## B. Speech
| # | Steps | Expected |
|---|---|---|
| B1 | Settings › Speech Speed 0.5×, back to board, tap a word | Word is spoken noticeably slowly (not at normal speed) |
| B2 | Choose voice style *Calm*, speak a sentence | Slower and lower than B1 |
| B3 | Settings › Voice: pick a non-default voice; speak | Selected voice is used |
| B4 | Restore settings from another device/platform (or set `speechVoice` to an id that does not exist) and speak | Speech plays in the default voice (no silence) |
| B5 | Settings › Pronunciation: word "more", say it as "moor please"; on the board tap *more* | Hears "moor please"; screen still shows "more". Remove the entry → hears "more" again |
| B6 | Long text: in Sentence Builder or via history, speak a ~5,000-character message | Whole text is spoken in order with no silence (Android limit ~4,000 chars) |
| B7 | While a long message is speaking, tap Clear | Speech stops immediately and does not restart; Undo restores the message |
| B8 | Tap 6 words in under 2 seconds with "Speak each word" on | Each word spoken once, latest wins; no repeated or out-of-order speech |
| B9 | Tap Speak 5× rapidly | Sentence restarts each tap; never two overlapping voices |
| B10 | Android: disable/uninstall all TTS engines (or select an engine with no voice data); tap Speak | Within ~5 s a notice says no speech voice responded; message stays on screen; app stays responsive; Settings shows how to install a voice |
| B11 | iOS: silent switch ON, tap Speak | Document behaviour (expo-speech is silent in silent mode); message remains visible |
| B12 | Background the app mid-utterance, return, tap Speak | Speech works; no stuck state |

## C. Screen reader (TalkBack / VoiceOver)
| # | Steps | Expected |
|---|---|---|
| C1 | Enable TalkBack / VoiceOver; swipe through the board top to bottom | Order: sentence text → Speak → Delete → Clear → (standard: Favourites, History, Camera) → Undo → Add favourite → Show on screen → Quick phrases → voice styles → scan → suggestions → page row → words |
| C2 | Focus each of Speak, Delete, Clear, Undo | Each is a separate element with its own label; disabled ones announced as "dimmed"/"disabled" |
| C3 | Add a word | Sentence change is announced (live region) |
| C4 | Trigger B10 | The speech notice is announced |
| C5 | Settings › each switch row | Announced as switch with label and on/off state; double-tap toggles |
| C6 | Repeat C1–C2 with Compact layout on | Order: sentence → Speak → Delete → Clear → Undo → Quick phrases → More → suggestions → Home → Back → Find → Scan → Settings → words |

## D. Switch access
| # | Steps | Expected |
|---|---|---|
| D1 | Android Switch Access / iOS Switch Control with one switch (auto scan) | All board buttons reachable and selectable, including Speak/Delete/Clear/Undo |
| D2 | In-app scanning: tap Scan; auto mode | Highlight (orange ring; cyan in High Contrast) moves through words → suggestions → Speak, Delete, Clear, Undo |
| D3 | In-app scanning step mode (Settings › Switch scanning › Step) with compact layout | Next/Select strip appears at the bottom; grid does not move when scanning starts |
| D4 | Open Quick phrases while scanning, close it | Scanning hands back to the board |
| D5 | External Bluetooth switch/keyboard (Space/Enter) | **Known gap:** not bound globally on native; record what happens |

## E. Layout and small screens
| # | Steps | Expected |
|---|---|---|
| E1 | Small phone, defaults | Note number of full word rows (browser estimate at 320×640: 2) |
| E2 | Turn on Settings › Compact layout | About 5 full rows on 320×640-class screens; all buttons ≥ 44 pt; Settings reachable from the page row |
| E3 | Compact: build a long sentence, add/clear words, let suggestions appear, start scanning | First row of words never moves |
| E4 | Compact + Button text size Extra large | One full line of message visible (not cut in half); targets still ≥ 44 pt |
| E5 | Notch/Dynamic Island device, gesture navigation, landscape not required (portrait lock) | Nothing hidden under the status bar or home indicator; tab bar above the home indicator |
| E6 | OS font size at maximum | Text remains readable; no overlapping controls |
| E7 | Standard layout (compact off) on an existing install | Layout identical to the previous release (no moved buttons) |
| E8 | Build a sentence, open Android Settings › Display › Font size, change it, return to Voice | The sentence and page are still there; no text cut off; the app reloads once (a brief redraw) |

## F. Data preservation
| # | Steps | Expected |
|---|---|---|
| F1 | Install previous release, add favourites/history/custom words/settings; upgrade to this build | All data intact; compact layout off |
| F1b | After upgrading, add a pronunciation (new in this build), close and reopen the app | Pronunciation still there and still applied |
| F2 | Upgrade with Firebase unreachable | Same as F1 |

## G. Camera, gallery and permissions (added 02/10/2026)
| # | Steps | Expected |
|---|---|---|
| G1 | Open Camera from the board for the first time | Only the camera prompt appears. No "photos and media" or microphone prompt (Android 12 and older showed a storage prompt before this change) |
| G2 | Deny it, then tap Camera | "Camera permission needed" explanation; no crash |
| G3 | Allow it, take a photo | Preview, then a description; offline: "Could not describe this image — check your connection" |
| G4 | Gallery: pick a photo | The system picker opens with no permission prompt; the photo is processed as in G3 |
| G5 | Settings › Apps › Voice › Permissions | Camera only; no Microphone, Files or Media |

## Recorded results

Emulator runs, 02/10/2026. Full method and values:
`docs/audit/aac-usability-improvements-2026-10.md` (Phase 3).
- Emulators: Android 15 / API 35 Pixel 7 profile, and Android 11 / API 30 Pixel 4 profile.
- TTS: Google Speech Services.
- App: separate "Voice PR7 Test", offline, no Firebase config.

**"Emulator PASS" is not a device result.** No physical device has been tested yet.

| Item | Emulator result | Still needs a device or a person |
|---|---|---|
| A1, A2 (offline start, words) | PASS | Real phone |
| A3 cloud notice | Partly: the Settings AI section shows it and the board has no cloud notice; Profile and Login not opened | Yes |
| A4 favourites and history after restart | PASS | Real phone |
| A5 cloud sync | Not tested (test build has no Firebase) | Yes |
| B1 speed 0.5× | Setting applied; engine audio 1.36× longer than 1× | Listen: is it clearly slower? |
| B2, B3 voice style, chosen voice | Not tested | Listen |
| B4 missing voice id | Not tested natively | Yes |
| B5 pronunciation | Saved; the screen keeps the written word; the engine gets the request | Listen: do you hear the substitution? |
| B6 ~5,000 characters | 2 chunks, about 334 s of continuous engine audio | Listen for gaps or order |
| B7 Clear mid-speech, Undo | Audio stopped by the first sample (~0.2 s); Undo restores | Listen |
| B8 6 fast word taps | All added; never 2 TTS players at once | Listen |
| B9 5× Speak | Never 2 players at once | Listen |
| B10 no TTS engine | Notice after 6.9 s; message kept; app responsive | On the phone, only with a spare engine setting |
| B11 iOS silent mode | Not possible here | iPhone |
| B12 background mid-utterance | Not tested | Yes |
| C1 to C6 TalkBack and VoiceOver | **Not tested.** No screen reader was used | Yes |
| D1 to D5 switch access, external keys | **Not tested** | Yes |
| E1, E2 rows: standard 3, compact 7 (1080×2400) | PASS | S24 Ultra counts |
| E3 grid stable (standard and compact, and across pages) | PASS (after fix D2) | Yes |
| E4 compact + extra large button text | Not tested | Yes |
| E5 notch, gestures, status bar | Offline banner now below the status bar (after fix D3) | Real insets on the S24 |
| E6 maximum font | No overlapping controls at 2.0; chips fit (after fix D4); tab labels truncate with "…" | Yes |
| E8 change the system font size while Voice is open (added 03/10/2026) | Sentence and page kept; layout identical to a fresh start at 1.3, 2.0 and 1.0 (Android 15) and at 1.3 and 1.0 (Android 11); dark mode does not reload (after fix D5) | On the S24: One UI font size and font style, with TalkBack on and off |
| E7 standard layout unchanged | Grid top identical to baseline offline (y=1393) | Yes |
| F1, F1b upgrade in place | PASS for the test app (baseline → fixed, same test key) | Store app → release-key build |
| F2 | Not tested | Yes |
| G1 to G5 camera, gallery, permissions | PASS on Android 15 and Android 11 (G5 checked from the APK, not in Settings) | Real camera on the S24 |

## H. Voice 2 (new board, modes, learning) — build from `voice2-transformation`
| # | Steps | Expected |
|---|---|---|
| H1 | Fresh install, launch | Board is usable behind the Welcome sheet; "Start talking" or ✕ closes it at once; no account or consent needed |
| H2 | Upgrade from 1.2.0 / PR #7 build with saved favourites, history, custom words, settings | Classic board, everything intact; Settings › Board design shows "Classic"; nothing moved |
| H3 | Settings › Board design › New Voice, then back to Classic | Same message, favourites, history and custom words in both |
| H4 | New board: tap "Voice · Adult" › choose Child › Switch | Warm tiles, 3 across, picture symbols first (after download); every word still there |
| H5 | In Child set text Large; switch to Adult; switch back | Child keeps Large; Adult keeps its own size; voice/speed unchanged |
| H6 | Personalise › Picture symbols › Download (online), then airplane mode, relaunch | Symbols still shown offline; Remove deletes them; words still work without symbols |
| H7 | Build a long message, tap words rapidly, let suggestions appear and disappear | First row of the grid never moves; nothing above the grid changes height |
| H8 | Speak a long message, then tap Stop (same place as Speak) | Speech stops immediately, does not restart; Speak returns |
| H9 | Explain › "Say it another way" › pick option › Replace; then Undo | Preview shown before replace; Undo restores the original |
| H10 | Phrases › Work › tap a phrase | Spoken and shown in the message; Phrases remembers "Work"; board layout unchanged |
| H11 | Show › rotate button › Back to board | Large text, flips for a partner; same message on return; works with TTS disabled |
| H12 | Personalise › Learning OFF (default): speak "I want to see Grandma Zebedee" 5× | "Zebedee" is not suggested after "Grandma" |
| H13 | Turn Learning ON, repeat G12 | "Zebedee" suggested after "Grandma"; stats count messages; Delete what Voice has learned removes it |
| H14 | Long-press a suggestion › Don't suggest | It disappears after that word; still suggested elsewhere |
| H15 | More › Start modelling, build and speak a message | "MODELLING" tag shown; message not in Recent; nothing learned |
| H16 | Personalise › My words › type "Grandma", Take photo (deny camera permission) | Clear note; tile can still be saved without photo |
| H17 | Same with camera allowed, and with Choose photo | Preview shows the photo before saving; tile appears at the end of Home with the photo; photo not synced |
| H18 | Personalise › Lock this screen, leave and return | Settings disabled until press-and-hold; board, speech, phrases, Quick and "no" unaffected |
| H19 | TalkBack/VoiceOver on the new board | Order: mode, Find, More, Settings → message → Speak → Delete → Clear → Undo → Explain, Phrases, Saved, Show → suggestions → Home, Back → words. Sheets announce title and Close |
| H20 | System reduce motion / remove animations ON | No tile scale animation; press still shows a tint |
| H21 | Controls at bottom (Personalise) | Message and controls below the grid; thumb-reachable; grid still fixed |
| H22 | Tablet | Two panes: message + tools + recent left, grid right |
| H23 | New board › Type: type "I want to go to the par", tap the "park" chip, then Add and speak | The word completes; the message is spoken through the normal Speak path, and Stop works |
| H24 | Start switch scanning (step mode), open Phrases, then Explain, Saved and Show | A focus ring moves through the items inside each sheet; Next and Select are at the bottom of the sheet; closing a sheet resumes scanning on the board |
| H25 | Me › Delete my words and messages | History, favourites, your own words and their photos, pronunciations and learning are all gone; settings stay |
