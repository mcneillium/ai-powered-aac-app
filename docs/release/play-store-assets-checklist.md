# Play Store Assets Checklist — Voice v1.1.0

**Updated:** 2026-03-23

---

## App Icon

| Requirement | File | Status |
|-------------|------|--------|
| 512x512 RGBA PNG | `assets/icon.png` | **DONE** |
| Adaptive foreground 1024x1024 | `assets/adaptive-icon.png` | **DONE** |
| Adaptive background 1024x1024 | `assets/adaptive-icon-background.png` | **DONE** |
| 1024x1024 master source | `assets/branding/logo/icon-1024.png` | **DONE** |

---

## Feature Graphic

| Requirement | File | Status |
|-------------|------|--------|
| 1024x500 RGB PNG (no alpha) | `assets/branding/google-play/feature-graphic/feature-graphic-1024x500.png` | **DONE** |

---

## Phone Screenshots

| Requirement | Status |
|-------------|--------|
| Minimum 2, max 8 at 1080x1920 | **TODO — capture 4 raw, run compositing script** |

| # | Headline | Raw file | Final file | Screen to capture |
|---|----------|----------|------------|-------------------|
| 1 | Tap. Build. Speak. | `raw/raw-1.png` | `final-1.png` | AAC Board with words in sentence bar |
| 2 | Smart Suggestions | `raw/raw-2.png` | `final-2.png` | Sentence Builder with AI suggestions |
| 3 | Your Way, Your Voice | `raw/raw-3.png` | `final-3.png` | Settings screen |
| 4 | Works Everywhere | `raw/raw-4.png` | `final-4.png` | Emotion screen with selection |

Capture guide: `docs/release/final-screenshot-capture-guide.md`
Compositing: `python3 scripts/composite-screenshots.py`

---

## Listing Text

| Item | Status |
|------|--------|
| App name: "Voice" | **DONE** |
| Short description (76 chars) | **DONE** — `play-store-listing-draft.md` |
| Full description | **DONE** — `play-store-listing-draft.md` |
| Release notes | **DONE** — `play-store-listing-draft.md` |

---

## URLs and Policies

| Item | Value | Status |
|------|-------|--------|
| Privacy policy URL | `https://paulmartinmcneill.com/commai/privacy-policy` | **DONE** |
| Support email | `support@paulmartinmcneill.com` | **DONE** |

---

## Play Console Forms

| Form | Status |
|------|--------|
| Content rating (IARC) | TODO — complete in Console |
| Data safety | Draft ready at `docs/release/data-safety-draft.md` — enter in Console |
| Target audience | TODO — declare in Console |
| App category | Education or Medical |

---

## Summary

| Asset | Status |
|-------|--------|
| App icon | DONE |
| Adaptive icon (fg + bg) | DONE |
| Feature graphic | DONE |
| Screenshot templates | DONE |
| Screenshot compositing script | DONE |
| Raw screenshots | TODO — capture from device |
| Final composited screenshots | TODO — run script after capture |
| Listing text | DONE |
| Privacy policy URL | DONE |
| Voice-branded AAB | TODO — run EAS build |
