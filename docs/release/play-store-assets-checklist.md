# Play Store Assets Checklist — CommAI v1.1.0

**Updated:** 2026-03-23

All assets required for Google Play Store submission.

---

## App Icon (High-res)

| Requirement | Current state | Status |
|-------------|--------------|--------|
| 512 x 512 px, 32-bit PNG with alpha | `assets/icon.png` is **512 x 512**, RGBA | **DONE** |
| Adaptive icon foreground | `assets/adaptive-icon.png` is 1024 x 1024 | **DONE** |
| Adaptive icon background | `app.json:35` → `"backgroundColor": "#ffffff"` | **DONE** |

---

## Feature Graphic

| Requirement | Current state | Status |
|-------------|--------------|--------|
| 1024 x 500 px, JPEG or 24-bit PNG (no alpha) | Does not exist | **TODO** |

**Action:** Create in Figma/Canva using brand colours (#4CAF50, #2196F3).
Suggested content: CommAI logo + tagline "Communication for everyone" + AAC board screenshot.

---

## Phone Screenshots

| Requirement | Current state | Status |
|-------------|--------------|--------|
| Minimum 2, max 8 | None captured | **TODO** |
| Dimensions: 1080x1920 recommended (9:16 portrait) | — | — |

Recommended captures (install AAB on device/emulator at 1080x1920):

1. AAC board with words in the sentence bar
2. AI suggestions strip visible with word predictions
3. (Optional) Settings screen showing theme + AI personalisation options
4. (Optional) Onboarding first slide
5. (Optional) Dark theme or high-contrast mode

Capture method:
```bash
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png ./screenshots/
```

---

## Listing Text

| Item | Max | Current state | Status |
|------|-----|--------------|--------|
| App name | 30 chars | `CommAI` (6 chars) | **DONE** |
| Short description | 80 chars | Drafted in `play-store-listing-draft.md` (71 chars) | **DONE** |
| Full description | 4000 chars | Drafted in `play-store-listing-draft.md` | **DONE** |
| Release notes | 500 chars | Drafted in `play-store-listing-draft.md` | **DONE** |

---

## URLs and Policies

| Item | Current state | Status |
|------|--------------|--------|
| Privacy policy URL | `src/theme.js:15` → `https://paulmartinmcneill.com/commai/privacy-policy` | **DONE** |
| Support email | `src/theme.js:16` → `support@paulmartinmcneill.com` | **DONE** |
| Developer website | Not set | Optional |

**Action required:** Verify that `https://paulmartinmcneill.com/commai/privacy-policy` returns a valid page before Play Console submission.

---

## Play Console Forms

| Form | Status |
|------|--------|
| Content rating (IARC) | Not yet completed — expected rating: Everyone |
| Data safety | Draft prepared at `docs/release/data-safety-draft.md` — enter in Play Console |
| Target audience | Declare: people who use AAC for communication |
| App category | Recommended: Medical or Education |

---

## Production AAB

| Item | Status |
|------|--------|
| EAS production build | **DONE** — artifact: `b3SUx6vPMMNBFteQjM1scg.aab` |
| Signing | Remote keystore managed by EAS |

---

## Summary

| Item | Status |
|------|--------|
| App icon | DONE |
| Feature graphic | TODO — create 1024x500 |
| Phone screenshots | TODO — capture min 2 |
| Listing text | DONE |
| Privacy policy URL | DONE — verify it loads |
| Support email | DONE |
| Production AAB | DONE |
| Play Console forms | TODO — complete in Console |
