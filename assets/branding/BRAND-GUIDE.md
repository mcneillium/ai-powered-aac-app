# Voice — Brand Guide v3

## Brand Name
**Voice** — communication for everyone

## Icon Design
5 vertical blue pills spelling V-O-I-C-E in an equalizer/soundwave pattern.
A small microphone sits above the centre I pill. White on blue. White background.

## Colour Palette

### Primary
| Name | Hex | Use |
|------|-----|-----|
| Blue | `#2979FF` | Primary buttons, icon bg, key accents |
| Blue Dark | `#195AC8` | Pressed / hover states |
| Blue Soft | `#DCEAFF` | Muted tint, selected backgrounds |
| Blue Mid | `#448AFF` | Secondary accent, AI features |

### Secondary Accents
| Name | Hex | Use |
|------|-----|-----|
| Coral | `#E8A070` | Warm highlights, warning |
| Green | `#6BBF90` | Success, ready states |
| Lilac | `#7C8FCC` | Secondary accent, camera button |

### Neutrals
| Name | Hex | Use |
|------|-----|-----|
| Page BG | `#FAFAFA` | Page backgrounds |
| Surface | `#F2F4F7` | Cards, panels |
| White | `#FFFFFF` | Tab bar, inputs, button text on blue |
| Text Dark | `#2E2E3A` | Headings |
| Text Mid | `#6E6E82` | Subheadings |
| Stroke | `#DDD9D4` | Borders |

## Visual Style
- **Shapes:** Rounded pills, soft corners (8–24dp radius)
- **Feel:** Calm, friendly, accessible. Not childish, not clinical.
- **Icon motif:** Vertical pill equalizer with letters
- **Backgrounds:** White or light grey for app, light blue tint for promo
- **Shadows:** Subtle 2–4px, 8–12% opacity

## Icon System

| Asset | Size | File |
|-------|------|------|
| App icon source | 1024x1024 | `branding/logo/icon-1024.png` |
| App icon (Expo) | 512x512 | `assets/icon.png` |
| Adaptive foreground | 1024x1024 | `assets/adaptive-icon.png` |
| Adaptive background | 1024x1024 | `assets/adaptive-icon-background.png` |
| Splash icon | 1024x1024 | `assets/splash-icon.png` |
| Favicon | 48x48 | `assets/favicon.png` |
| Brand mark | 256x256 | `branding/logo/brand-mark-256.png` |

## Regenerating Assets

```bash
python3 scripts/generate-brand-assets.py
```
