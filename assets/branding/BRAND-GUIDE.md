# Voice — Brand Guide v2

## Brand Name
**Voice** — communication for everyone

## Design Direction
Calm, soft, child-friendly but not babyish. Rounded shapes, warm colours, accessible contrast. Suitable for AAC users, caregivers, educators, and families.

## Colour Palette

### Primary
| Name | Hex | Use |
|------|-----|-----|
| Teal | `#4AADA8` | Primary buttons, icon bg, key accents |
| Teal Dark | `#37827E` | Pressed / hover states |
| Teal Soft | `#D6EDEC` | Muted teal tint, backgrounds |

### Secondary Accents
| Name | Hex | Use |
|------|-----|-----|
| Coral | `#E8A070` | Warm highlights, warning, offline banner |
| Coral Soft | `#F8DECE` | Coral tint |
| Lilac | `#B0A2CC` | Settings / personalisation accent |
| Lilac Soft | `#E6E0F2` | Lilac tint |
| Green | `#6BBF90` | Success, offline/ready states |
| Green Soft | `#D8F1E3` | Green tint |
| Sky | `#6BB3D9` | AI / smart feature accent |
| Sky Soft | `#D6EAF6` | Sky tint |

### Neutrals
| Name | Hex | Use |
|------|-----|-----|
| Cream | `#FAFAF8` | Page backgrounds |
| Warm Cream | `#F4F2EF` | Surface / card backgrounds |
| White | `#FFFFFF` | Card surfaces, button text |
| Text Dark | `#2E2E3A` | Headings, primary text |
| Text Mid | `#6E6E82` | Subheadings, secondary text |
| Stroke | `#DDD9D4` | Borders, frame outlines |

## Design Tokens (in `src/theme.js`)

### Spacing
| Token | Value |
|-------|-------|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 20 |
| `xxl` | 32 |

### Border Radius
| Token | Value |
|-------|-------|
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 24 |
| `pill` | 999 |

### Shadows
| Token | Use |
|-------|-----|
| `card` | Cards and surfaces — subtle 2px elevation |
| `raised` | Buttons and modals — 4px elevation |

## Visual Style

- **Shapes:** Rounded corners everywhere (radius 12–24dp). Soft ellipses and organic blobs as decorative motifs.
- **Feel:** Calm, soft, warm. Approachable and modern. Not clinical, not childish.
- **Iconography:** Simple microphone + speech wave arcs. Clean, not busy.
- **Backgrounds:** Cream (#FAFAF8) or white. Never dark for promotional materials.
- **Shadows:** Subtle only (2–4px offset, 8–12% opacity).
- **Typography:** Bold sans-serif for headings (DejaVu Sans Bold or system). Regular weight for body.

## Icon System

| Asset | Size | File | Use |
|-------|------|------|-----|
| App icon source | 1024x1024 | `branding/logo/icon-1024.png` | Master source |
| App icon (Expo) | 512x512 | `assets/icon.png` | `app.json` → `icon` |
| Adaptive foreground | 1024x1024 | `assets/adaptive-icon.png` | `app.json` → `adaptiveIcon.foregroundImage` |
| Adaptive background | 1024x1024 | `assets/adaptive-icon-background.png` | `app.json` → `adaptiveIcon.backgroundImage` |
| Splash icon | 1024x1024 | `assets/splash-icon.png` | `app.json` → `splash.image` |
| Favicon | 48x48 | `assets/favicon.png` | `app.json` → `web.favicon` |
| Brand mark | 256x256 | `branding/logo/brand-mark-256.png` | Small badge / watermark |

## Google Play Assets

| Asset | Size | File |
|-------|------|------|
| Feature graphic | 1024x500 | `branding/google-play/feature-graphic/feature-graphic-1024x500.png` |
| Screenshot template 1 | 1080x1920 | `branding/google-play/screenshots/screenshot-1-template.png` |
| Screenshot template 2 | 1080x1920 | `branding/google-play/screenshots/screenshot-2-template.png` |
| Screenshot template 3 | 1080x1920 | `branding/google-play/screenshots/screenshot-3-template.png` |
| Screenshot template 4 | 1080x1920 | `branding/google-play/screenshots/screenshot-4-template.png` |

## Screenshot Captions

| # | Headline | Subheading | Screen |
|---|----------|-----------|--------|
| 1 | Tap. Build. Speak. | Colour-coded words make communication simple | AAC Board with words in sentence bar |
| 2 | Smart Suggestions | AI learns your patterns — entirely on your device | Sentence Builder with AI suggestions visible |
| 3 | Your Way, Your Voice | Themes, grid sizes, speech speed — fully adjustable | Settings screen |
| 4 | Works Everywhere | Full offline support — no internet needed to communicate | Emotion screen |

## Motif Assets

| File | Size | Use |
|------|------|-----|
| `branding/motifs/soft-blobs-512.png` | 512x512 | Decorative blob cluster for marketing |

## Regenerating Assets

```bash
python3 scripts/generate-brand-assets.py
```

This overwrites all PNGs from the master script. Edit the script to change colours, layout, or text.
