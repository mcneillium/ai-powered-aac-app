# Voice — Wave identity

Updated 2026-10-04 following the owner's preference for the sound-wave idea
and softer lettering. A seven-bar waveform with a gently asymmetric rhythm replaces the speech-bubble
concept. Nunito 600 provides a rounded, lighter wordmark; secondary lettering
uses Nunito 450. All lettering is outlined in the SVG masters.

## Palette

Ink #14233F; Blue #2B65EF; Iris #6576FF; Mint #79E8C5; Paper #F5F7FC.
On light backgrounds the waveform uses blue/iris with a small mint endpoint.
On dark backgrounds it uses brighter periwinkle (#8AB4FF to #B6AEFF) to
improve separation from ink. The wordmark gap is optically balanced; the
preview app icons use the same artwork scale as their actual exports.
Artwork colours do not change the AAC control palette or category colours.

## Masters and PNG exports

Editable masters are in assets/branding/logo: voice-logo.svg,
voice-logo-light.svg, voice-mark.svg, voice-mark-mono.svg, voice-app-icon.svg,
voice-adaptive-foreground.svg, voice-adaptive-monochrome.svg,
voice-adaptive-background.svg and voice-brand-preview.svg.
Launch master: assets/branding/splash/voice-splash.svg.
Feature graphic master:
assets/branding/google-play/feature-graphic/voice-feature-graphic.svg.

Generated exports include opaque 1024-square Expo/iOS and 512-square Play
icons, 1024-square adaptive foreground/background/themed icons, 48-square
favicon, transparent 256-square in-app mark, transparent launch logo,
1024×500 RGB feature graphic and 1600×1000 brand preview.

Regenerate PNGs with: python3 scripts/generate-brand-assets.py
Requires Inkscape and Pillow. No installed font or network is required.
The platform supplies the outer app-icon mask. Foreground alpha must remain
inside the central Android circular safe area; the render workflow checks it.
Screenshots/templates are historical placeholders, not final store images.

## Recreate the outlined SVG masters

scripts/create-wave-masters.py accepts the pinned official Nunito font as
a build-time argument and verifies its Git blob hash before outlining.
It requires FontTools. The font is never copied into the app assets.
The rendering workflow downloads the pinned source, creates outlines, renders,
checks alpha/opacity/dimensions/metadata, and runs the app lint/test/export gate.
Only generated artwork is committed, only to codex/voice-brand-refresh; it does
not merge, sign an APK, deploy production or release the app.

Font source revision: 604936664fd62c14271209b51f98e7f495dd1a3e
Font Git blob SHA: 2ec1f4b0676c83ef33049db87b311171699e9192
https://github.com/google/fonts/blob/604936664fd62c14271209b51f98e7f495dd1a3e/ofl/nunito/Nunito%5Bwght%5D.ttf

Waveform starting geometry:
https://github.com/lucide-icons/lucide/blob/27c0a136cdced32c9e2ba1e969a27dbca42a9d3f/icons/audio-lines.svg
The unchanged source is retained in assets/branding/sources/lucide-audio-lines.svg.
Modifications: seven-bar rhythm, revised amplitudes, gradient and
mint endpoint; custom Voice composition and layout.

Lucide ISC and Nunito SIL OFL 1.1 notices are retained under
assets/branding/licenses, in SVG/PNG metadata and in the app's credits.
Original composition follows the repository's declared 0BSD licence;
upstream works retain their licences. No trademark clearance is asserted.
