# Voice — Brand Guide

## Brand Name
**Voice** — communication for everyone

## Colour Palette

### Primary
| Name | Hex | RGB | Use |
|------|-----|-----|-----|
| Teal | `#5BB5B5` | 91, 181, 181 | Icon bg, primary buttons, key accents |
| Teal Dark | `#3E8E8E` | 62, 142, 142 | Hover states, secondary text accents |

### Secondary Accents
| Name | Hex | RGB | Use |
|------|-----|-----|-----|
| Coral | `#F4A683` | 244, 166, 131 | Warm highlights, decorative pills |
| Lilac | `#B8A9D4` | 184, 169, 212 | Settings/personalisation accent |
| Green | `#7DC89E` | 125, 200, 158 | Success, offline/ready states |
| Sky | `#7CB9E8` | 124, 185, 232 | AI/smart feature accent |

### Neutrals
| Name | Hex | RGB | Use |
|------|-----|-----|-----|
| Cream | `#F8F6F3` | 248, 246, 243 | Page backgrounds, feature graphic bg |
| White | `#FFFFFF` | 255, 255, 255 | Card surfaces, icon text |
| Text Dark | `#3A3A4A` | 58, 58, 74 | Headings, primary text |
| Text Mid | `#78788C` | 120, 120, 140 | Subheadings, secondary text |
| Stroke | `#D4D0CC` | 212, 208, 204 | Borders, frame outlines |

## Visual Style

- **Shapes:** Rounded corners everywhere (radius 16–40dp). Vertical pill/capsule shapes as decorative motifs.
- **Feel:** Calm, soft, child-friendly but not childish. Approachable and modern.
- **Iconography:** Simple microphone + speech wave arcs. Clean, not busy.
- **Backgrounds:** White or cream. Never dark for promotional materials.
- **Shadows:** Subtle only (6px offset, 20% opacity black).
- **Typography:** Bold sans-serif for headings (DejaVu Sans Bold or equivalent). Regular weight for body.

## Icon System

| Asset | Size | File | Use |
|-------|------|------|-----|
| App icon source | 1024x1024 | `branding/logo/icon-1024.png` | Master source |
| App icon (Expo) | 512x512 | `assets/icon.png` | `app.json` → `icon` |
| Adaptive foreground | 1024x1024 | `assets/adaptive-icon.png` | `app.json` → `adaptiveIcon.foregroundImage` |
| Adaptive background | 1024x1024 | `assets/adaptive-icon-background.png` | `app.json` → `adaptiveIcon.backgroundImage` |
| Splash icon | 1024x1024 | `assets/splash-icon.png` | `app.json` → `splash.image` |
| Favicon | 48x48 | `assets/favicon.png` | `app.json` → `web.favicon` |

## Google Play Assets

| Asset | Size | File |
|-------|------|------|
| Feature graphic | 1024x500 | `branding/google-play/feature-graphic/feature-graphic-1024x500.png` |
| Screenshot template 1 | 1080x1920 | `branding/google-play/screenshots/screenshot-1-template.png` |
| Screenshot template 2 | 1080x1920 | `branding/google-play/screenshots/screenshot-2-template.png` |
| Screenshot template 3 | 1080x1920 | `branding/google-play/screenshots/screenshot-3-template.png` |
| Screenshot template 4 | 1080x1920 | `branding/google-play/screenshots/screenshot-4-template.png` |

## Screenshot Captions

| # | Headline | Subheading | Screen to capture |
|---|----------|-----------|-------------------|
| 1 | Tap. Build. Speak. | Colour-coded words make communication simple | AAC Board with words in sentence bar |
| 2 | Smart Suggestions | AI learns your patterns — entirely on your device | Sentence Builder with AI suggestions visible |
| 3 | Your Way, Your Voice | Themes, grid sizes, speech speed — fully adjustable | Settings screen |
| 4 | Works Everywhere | Full offline support — no internet needed to communicate | Emotion screen or AAC Board with offline banner |

## Regenerating Assets

```bash
python3 scripts/generate-brand-assets.py
```

This overwrites all PNGs from the master script. Edit the script to change colours, layout, or text.
