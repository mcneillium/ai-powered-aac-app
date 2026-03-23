# Voice — Screenshot Capture Guide

## Quick summary

1. Install the Voice AAB on a device or emulator (1080x1920 resolution)
2. Capture 4 screenshots and save them with the exact filenames below
3. Run one command to generate the final Play Store screenshots

---

## Step 1 — Capture these 4 screenshots

### Screenshot 1: AAC Board
| | |
|---|---|
| **Screen:** | AAC Board (main home tab) |
| **State:** | Tap 2–3 words so the sentence bar at the top shows them (e.g. "I want drink") |
| **Visible:** | Colour-coded word grid, sentence bar with words, AI suggestion strip below bar |
| **Not visible:** | Keyboard, any error/loading state |
| **Save as:** | `raw-1.png` |
| **Headline:** | Tap. Build. Speak. |
| **Subheading:** | Colour-coded words make communication simple |

### Screenshot 2: Sentence Builder
| | |
|---|---|
| **Screen:** | Easy Sentence Builder tab |
| **State:** | Search for a word (e.g. "food"), have 1–2 words in the sentence chips, AI suggestions visible |
| **Visible:** | Word chips at top, category carousel, pictogram results, AI suggestions section |
| **Not visible:** | Empty state, keyboard covering the content |
| **Save as:** | `raw-2.png` |
| **Headline:** | Smart Suggestions |
| **Subheading:** | AI learns your patterns — entirely on your device |

### Screenshot 3: Settings
| | |
|---|---|
| **Screen:** | Settings tab |
| **State:** | Default state, scrolled to show theme options and AI personalisation toggle |
| **Visible:** | Theme selector (Light/Dark/High Contrast), grid size options, speech controls, AI toggle |
| **Not visible:** | Nothing specific to hide — just show the full settings |
| **Save as:** | `raw-3.png` |
| **Headline:** | Your Way, Your Voice |
| **Subheading:** | Themes, grid sizes, speech speed — fully adjustable |

### Screenshot 4: Emotion Screen
| | |
|---|---|
| **Screen:** | Emotion tab |
| **State:** | Tap one emotion (e.g. "Happy" or "Calm") so it shows as selected |
| **Visible:** | Emotion grid with emoji icons, selected emotion highlighted, speak button |
| **Not visible:** | No error states |
| **Save as:** | `raw-4.png` |
| **Headline:** | Works Everywhere |
| **Subheading:** | Full offline support — no internet needed to communicate |

---

## Step 2 — Place raw screenshots in the correct folder

```
assets/branding/google-play/screenshots/raw/raw-1.png
assets/branding/google-play/screenshots/raw/raw-2.png
assets/branding/google-play/screenshots/raw/raw-3.png
assets/branding/google-play/screenshots/raw/raw-4.png
```

**ADB capture method:**
```bash
adb shell screencap -p /sdcard/screen.png
adb pull /sdcard/screen.png assets/branding/google-play/screenshots/raw/raw-1.png
```

Repeat for each screenshot, changing the filename.

---

## Step 3 — Generate final screenshots

```bash
python3 scripts/composite-screenshots.py
```

**Or on Windows:**
```powershell
python scripts/composite-screenshots.py
```

This composites each raw screenshot into the branded template with headline, subheading, phone frame, and Voice branding.

**Requires:** Python 3 + Pillow (`pip install Pillow`)

---

## Step 4 — Upload to Google Play

The final files for upload are:

| Play Store order | File | Headline |
|------------------|------|----------|
| 1 | `assets/branding/google-play/screenshots/final-1.png` | Tap. Build. Speak. |
| 2 | `assets/branding/google-play/screenshots/final-2.png` | Smart Suggestions |
| 3 | `assets/branding/google-play/screenshots/final-3.png` | Your Way, Your Voice |
| 4 | `assets/branding/google-play/screenshots/final-4.png` | Works Everywhere |

All outputs are 1080x1920 RGB PNG — ready for Play Console upload.

---

## Notes

- Screenshots can be any resolution — the compositing script resizes and crops to fit
- You can re-run the script any time to regenerate with updated captures
- The template backgrounds, headlines, and subheadings are defined in `scripts/composite-screenshots.py`
- To regenerate the empty templates: `python3 scripts/generate-brand-assets.py`
