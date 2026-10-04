#!/usr/bin/env python3
"""Render the checked-in Voice SVG masters. Requires Inkscape and Pillow.

Run from any directory: python3 scripts/generate-brand-assets.py
No font installation, download, absolute checkout path or runtime dependency.
Never edits screenshot captures/templates or the AAC board palette.
"""

from pathlib import Path
import shutil
import subprocess
from PIL import Image, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
BRAND = ASSETS / 'branding'
INKSCAPE = shutil.which('inkscape')


def render(source, destination, width, height, opaque=False):
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        INKSCAPE, str(source), '--export-type=png',
        f'--export-filename={destination}', f'--export-width={width}',
        f'--export-height={height}',
    ], check=True, stdout=subprocess.DEVNULL)
    with Image.open(destination) as original:
        image = original.convert('RGB' if opaque else 'RGBA')
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text('Description', 'Voice Wave identity. Rounded waveform adapted from Lucide audio-lines; soft Nunito 600 outlined lettering.')
    metadata.add_text('Copyright', (BRAND / 'licenses' / 'LUCIDE-LICENSE.txt').read_text() + '\n' + (BRAND / 'licenses' / 'NUNITO-OFL.txt').read_text())
    image.save(destination, pnginfo=metadata)
    print(destination.relative_to(ROOT))


def main():
    if not INKSCAPE:
        raise SystemExit('Install Inkscape to render the checked-in SVG masters.')
    logo = BRAND / 'logo'
    render(logo / 'voice-app-icon.svg', logo / 'icon-1024.png', 1024, 1024, True)
    render(logo / 'voice-app-icon.svg', logo / 'icon-512.png', 512, 512, True)
    render(logo / 'voice-app-icon.svg', ASSETS / 'icon.png', 1024, 1024, True)
    render(logo / 'voice-app-icon.svg', ASSETS / 'favicon.png', 48, 48, True)
    render(logo / 'voice-mark.svg', logo / 'brand-mark-256.png', 256, 256)
    render(logo / 'voice-adaptive-foreground.svg', ASSETS / 'adaptive-icon.png', 1024, 1024)
    render(logo / 'voice-adaptive-monochrome.svg', ASSETS / 'adaptive-icon-monochrome.png', 1024, 1024)
    render(logo / 'voice-adaptive-background.svg', ASSETS / 'adaptive-icon-background.png', 1024, 1024, True)
    shutil.copyfile(ASSETS / 'adaptive-icon.png', logo / 'adaptive-icon-foreground.png')
    shutil.copyfile(ASSETS / 'adaptive-icon-background.png', logo / 'adaptive-icon-background.png')
    render(BRAND / 'splash' / 'voice-splash.svg', ASSETS / 'splash-icon.png', 1024, 1024)
    shutil.copyfile(ASSETS / 'splash-icon.png', BRAND / 'splash' / 'splash-icon.png')
    render(BRAND / 'google-play' / 'feature-graphic' / 'voice-feature-graphic.svg',
           BRAND / 'google-play' / 'feature-graphic' / 'feature-graphic-1024x500.png', 1024, 500, True)
    render(logo / 'voice-brand-preview.svg', logo / 'voice-brand-preview.png', 1600, 1000, True)


if __name__ == '__main__':
    main()
