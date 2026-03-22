# Play Store Assets Checklist — CommAI v1.1.0

All assets required for Google Play Store submission.

---

## App Icon (High-res)

| Requirement | Current state | Status |
|-------------|--------------|--------|
| 512 x 512 px, 32-bit PNG with alpha | `assets/icon.png` is **512 x 512**, RGBA | **OK** |
| Adaptive icon foreground | `assets/adaptive-icon.png` is 1024 x 1024 | OK |
| Adaptive icon background | `app.json:35` → `"backgroundColor": "#ffffff"` | OK |

Resized from `assets/adaptive-icon.png` (1024x1024) using Lanczos resampling.

---

## Feature Graphic

| Requirement | Current state | Status |
|-------------|--------------|--------|
| 1024 x 500 px, JPEG or 24-bit PNG (no alpha) | Does not exist | **BLOCKER** |

**Action:** Create in Figma/Canva using brand colours (#4CAF50, #2196F3).
Suggested content: CommAI logo + tagline "Communication for everyone" + AAC board screenshot.

---

## Phone Screenshots

| Requirement | Current state | Status |
|-------------|--------------|--------|
| Minimum 2, max 8 | None captured | **BLOCKER** |
| Dimensions: 1080x1920 recommended (9:16 portrait) | — | — |

Recommended captures (install on device/emulator at 1080x1920):

- [ ] AAC board with words in the sentence bar
- [ ] AI suggestions strip visible with word predictions
- [ ] Emotion screen with an emotion selected
- [ ] Settings screen showing theme + AI personalisation options
- [ ] Onboarding first slide
- [ ] (Optional) Sentence builder with pictograms
- [ ] (Optional) Dark theme or high-contrast mode

Capture method:
```bash
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png ./screenshots/
```

---

## Tablet Screenshots (optional)

- [ ] Determine if 7-inch and 10-inch tablet screenshots are needed
- App supports tablets (`app.json:24` → `"supportsTablet": true`)

---

## Listing Text

| Item | Max | Current state | Status |
|------|-----|--------------|--------|
| App name | 30 chars | `CommAI` (6 chars) | **Done** — `app.json:3` |
| Short description | 80 chars | Drafted in `play-store-listing-draft.md` (71 chars) | **Done** |
| Full description | 4000 chars | Drafted in `play-store-listing-draft.md` | **Done** |
| Release notes | 500 chars | Drafted in `play-store-listing-draft.md` | **Done** |

---

## URLs and Policies

| Item | Current state | Status |
|------|--------------|--------|
| Privacy policy URL | `src/theme.js:15` → `REPLACE-ME` placeholder | **BLOCKER** |
| Support email | `src/theme.js:16` → `REPLACE-ME` placeholder | **BLOCKER** |
| Developer website | Not set | Optional |

---

## Play Console Forms

| Form | Status |
|------|--------|
| Content rating (IARC) | Not yet completed — expected rating: Everyone |
| Data safety | Draft prepared at `docs/release/data-safety-draft.md` — enter in Play Console |
| Target audience | Declare: people who use AAC for communication |
| App category | Recommended: Medical or Education |

---

## Summary of Blockers

| # | Blocker | Action | Runbook step |
|---|---------|--------|-------------|
| 1 | Feature graphic missing | Create 1024x500 graphic | — |
| 2 | Phone screenshots missing | Capture min 2 at 1080x1920 | — |
| 3 | Privacy policy URL placeholder | Host page, replace in `src/theme.js` | Step 5 |
| 4 | Support email placeholder | Replace in `src/theme.js` | Step 5 |
