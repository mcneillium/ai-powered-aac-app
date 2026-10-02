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
| A5 | Build WITH Firebase, sign in on device 1, change speech speed; sign in on device 2 that has different local settings | Device 2 keeps local-only settings (e.g. text size) that were never synced; no setting resets to default |

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

## F. Data preservation
| # | Steps | Expected |
|---|---|---|
| F1 | Install previous release, add favourites/history/custom words/pronunciations/settings; upgrade to this build | All data intact; compact layout off |
| F2 | Upgrade with Firebase unreachable | Same as F1 |
