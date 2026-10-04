# Voice — Flow identity (2026-10-04)

A speech bubble with an open, flowing V. The small mint endpoint adds warmth.
The mark works for both Child and Adult modes; it does not imply microphone
input or promise a clinical outcome.

## Colour and typography

| Colour | Hex | Brand use |
|---|---|---|
| Ink | `#14233F` | App icon background; dark lockups |
| Blue | `#2B65EF` | Speech-bubble gradient start |
| Iris | `#6576FF` | Speech-bubble gradient end |
| Mint | `#79E8C5` | V endpoint accent |
| Paper | `#F5F7FC` | Launch background |

These are artwork colours. The AAC control palette and Fitzgerald category
colours remain governed by the existing accessible design tokens.

The Voice wordmark is outlined DejaVu Sans Bold, with adjusted spacing.
SVGs use paths, with no external fonts, scripts, images or remote resources.

## Masters and exports

All masters are in `assets/branding/logo/` unless noted.

| Purpose | Master | Export |
|---|---|---|
| Primary lockup | `voice-logo.svg` | Editable SVG |
| Dark-background lockup | `voice-logo-light.svg` | Editable SVG |
| Symbol | `voice-mark.svg`, `voice-mark-mono.svg` | `brand-mark-256.png` |
| iOS / Expo icon | `voice-app-icon.svg` | `assets/icon.png`, `icon-1024.png` (1024 square, opaque) |
| Play icon | `voice-app-icon.svg` | `icon-512.png` (512 square, opaque) |
| Android adaptive foreground | `voice-adaptive-foreground.svg` | `assets/adaptive-icon.png` (transparent) |
| Android themed icon | `voice-adaptive-monochrome.svg` | `assets/adaptive-icon-monochrome.png` (white alpha silhouette) |
| Adaptive background | `voice-adaptive-background.svg` | `assets/adaptive-icon-background.png` (opaque) |
| Favicon | `voice-app-icon.svg` | `assets/favicon.png` (48 square) |
| Launch logo | `../splash/voice-splash.svg` | `assets/splash-icon.png` |
| Store feature graphic | `../google-play/feature-graphic/voice-feature-graphic.svg` | 1024 × 500 RGB PNG |
| Brand preview | `voice-brand-preview.svg` | `voice-brand-preview.png` |

The app icon has no baked-in outer rounded corners: the platform applies its
own mask. Android foreground artwork is inside the central circular safe area.
Keep at least one quarter of the symbol width as space around standalone marks.
Use the monochrome version when colour cannot be reproduced.

Regenerate PNGs from the checked-in SVG masters:

```bash
python3 scripts/generate-brand-assets.py
```

Requires Inkscape and Pillow. Paths resolve relative to the script, so the
checkout can be anywhere. No fonts need to be installed for regeneration.
The script does not rewrite historical screenshot templates or captures.
Those are placeholders and must be replaced by current app screenshots.

## Provenance and notices

Speech-bubble geometry adapted from Lucide `message-circle.svg`, source revision
`95f5ecacad69025777c76d9458e6dec9a17fafff`:
https://github.com/lucide-icons/lucide/blob/95f5ecacad69025777c76d9458e6dec9a17fafff/icons/message-circle.svg

The unchanged upstream SVG is retained in `../sources/lucide-message-circle.svg`.
Modifications: filled shape, gradient, custom V and mint endpoint; Voice layout
and platform exports. Lucide attribution and its full licence are retained in
`../licenses/LUCIDE-LICENSE.txt`, SVG metadata, PNG metadata and the in-app
credits. Lucide permits modification/distribution under ISC.

The wordmark is rendered from DejaVu Sans Bold; no font file is bundled.
See `../licenses/DEJAVU-LICENSE.txt` and the in-app notice.
Original Voice composition/V artwork follows the repository’s declared 0BSD
licence; upstream parts retain their own licences. No exclusivity or trademark
clearance is asserted.

This identity replaces the previously undocumented designer-provided launcher,
adaptive, splash and favicon artwork. Old artwork remains in Git history and
historical screenshot templates; those are not current release masters.
