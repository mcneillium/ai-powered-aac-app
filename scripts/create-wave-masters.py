#!/usr/bin/env python3
"""Create Voice waveform SVG masters from a verified Nunito build-time font.

Requires FontTools. Supply the official pinned font path as the sole argument.
Normal PNG regeneration uses generate-brand-assets.py and requires no font.
"""
from pathlib import Path
from html import escape
import hashlib
import json
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / 'assets' / 'branding'
LOGO = BRAND / 'logo'
FONT_BLOB = '2ec1f4b0676c83ef33049db87b311171699e9192'
FONT_REVISION = '604936664fd62c14271209b51f98e7f495dd1a3e'
ICON_REVISION = '27c0a136cdced32c9e2ba1e969a27dbca42a9d3f'
font_path = Path(sys.argv[1])
font_bytes = font_path.read_bytes()
blob = hashlib.sha1(b'blob ' + str(len(font_bytes)).encode() + b'\0' + font_bytes).hexdigest()
if blob != FONT_BLOB:
    raise SystemExit('Nunito source does not match the pinned upstream blob')
variable = TTFont(font_path)
fonts = {weight: instantiateVariableFont(variable, {'wght': weight}, inplace=False) for weight in (450, 600)}
lucide = (BRAND / 'licenses' / 'LUCIDE-LICENSE.txt').read_text()
nunito = (BRAND / 'licenses' / 'NUNITO-OFL.txt').read_text()


def lettering(text, x, baseline, size, color='#14233F', weight=600, tracking=0):
    font = fonts[weight]
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    em = font['head'].unitsPerEm
    result = []
    cursor = 0
    for character in text:
        name = cmap[ord(character)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        if pen.getCommands():
            result.append(f'<path transform="translate({x+cursor:.4f} {baseline}) scale({size/em:.8f} {-size/em:.8f})" fill="{color}" d="{pen.getCommands()}"/>')
        cursor += font['hmtx'].metrics[name][0] * size / em + tracking
    return ''.join(result)


def mark(x=0, y=0, scale=1, mono=None, on_dark=False):
    # Lucide audio-lines: rounded vertical strokes, recast into a centred
    # seven-bar waveform. No tiny letters or microphone detail.
    heights = [3, 7, 14, 19, 11, 6, 3]
    stroke = mono or ('url(#voice-luminous)' if on_dark else 'url(#voice-blue)')
    paths = []
    for index, height in enumerate(heights):
        cx = 3 + 3 * index
        paths.append(f'<path d="M{cx} {12-height/2}v{height}" fill="none" stroke="{stroke}" stroke-width="2" stroke-linecap="round"/>')
    if not mono:
        paths.append('<circle cx="12" cy="2.5" r="1" fill="#79E8C5"/>')
    return f'<g transform="translate({x} {y}) scale({scale})"><g transform="translate(8 8) scale(10)">' + ''.join(paths) + '</g></g>'


def lockup(x=0, y=0, scale=1, light=False):
    return f'<g transform="translate({x} {y}) scale({scale})">' + mark(on_dark=light) + lettering('Voice', 272, 187, 200, '#FFFFFF' if light else '#14233F', tracking=-2) + '</g>'


def write_svg(path, width, height, body, title):
    path.parent.mkdir(parents=True, exist_ok=True)
    definitions = '<defs><linearGradient id="voice-blue" gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="24" y2="12"><stop stop-color="#2B65EF"/><stop offset="1" stop-color="#6576FF"/></linearGradient><linearGradient id="voice-luminous" gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="24" y2="12"><stop stop-color="#8AB4FF"/><stop offset="1" stop-color="#B6AEFF"/></linearGradient><linearGradient id="voice-ink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#14233F"/><stop offset="1" stop-color="#253D64"/></linearGradient></defs>'
    notice = f'Voice Wave identity. Rounded waveform adapted from Lucide audio-lines; Nunito 600 wordmark / 450 secondary lettering, outlined. Lucide source: https://github.com/lucide-icons/lucide/blob/{ICON_REVISION}/icons/audio-lines.svg. Font source: https://github.com/google/fonts/blob/{FONT_REVISION}/ofl/nunito/Nunito%5Bwght%5D.ttf.\n{lucide}\n{nunito}'
    path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title"><title id="title">{escape(title)}</title><metadata>{escape(notice).replace(chr(10), "&#10;")}</metadata>{definitions}{body}</svg>\n')


write_svg(LOGO / 'voice-mark.svg', 256, 256, mark(), 'Voice rounded waveform mark')
write_svg(LOGO / 'voice-mark-mono.svg', 256, 256, mark(mono='#14233F'), 'Voice monochrome waveform')
write_svg(LOGO / 'voice-logo.svg', 860, 256, lockup(), 'Voice waveform logo with soft Nunito lettering')
write_svg(LOGO / 'voice-logo-light.svg', 860, 256, lockup(light=True), 'Voice waveform logo for dark backgrounds')
write_svg(LOGO / 'voice-app-icon.svg', 1024, 1024, '<rect width="1024" height="1024" fill="url(#voice-ink)"/>' + mark(176, 176, 2.625, on_dark=True), 'Voice waveform app icon')
write_svg(LOGO / 'voice-adaptive-foreground.svg', 1024, 1024, mark(228, 228, 568/256, on_dark=True), 'Voice waveform adaptive foreground')
write_svg(LOGO / 'voice-adaptive-monochrome.svg', 1024, 1024, mark(228, 228, 568/256, mono='#FFFFFF'), 'Voice waveform themed icon')
write_svg(LOGO / 'voice-adaptive-background.svg', 1024, 1024, '<rect width="1024" height="1024" fill="url(#voice-ink)"/>', 'Voice ink adaptive background')
write_svg(BRAND / 'splash' / 'voice-splash.svg', 1024, 1024, lockup(135, 388, .88), 'Voice waveform launch logo')
feature = '<rect width="1024" height="500" fill="#14233F"/><circle cx="1010" cy="20" r="280" fill="#1F3456"/><circle cx="1010" cy="20" r="184" fill="#29466E"/>' + lockup(90, 68, .94, True) + lettering('Your words. Your way.', 110, 365, 40, '#FFFFFF', weight=450)
write_svg(BRAND / 'google-play' / 'feature-graphic' / 'voice-feature-graphic.svg', 1024, 500, feature, 'Voice waveform feature graphic')
preview = '<rect width="1600" height="1000" fill="#F5F7FC"/>' + lettering('VOICE / WAVE IDENTITY', 80, 75, 19, '#64738A', tracking=2) + lockup(75, 205, 1.18) + lettering('Your words. Your way.', 396, 478, 30, '#64738A', weight=450) + '<rect x="1120" y="130" width="390" height="430" rx="40" fill="#E8EDF6"/><rect x="1170" y="180" width="290" height="290" rx="64" fill="url(#voice-ink)"/>' + mark(1219.84375, 229.84375, .743408203125, on_dark=True) + lettering('APP ICON', 1242, 520, 17, '#64738A', tracking=2) + '<rect x="80" y="640" width="720" height="260" rx="28" fill="#14233F"/>' + lockup(122, 680, .78, True) + lettering('LIGHT / DARK / MONOCHROME', 866, 660, 15, '#64738A', tracking=1) + mark(850, 690, .47) + mark(1030, 690, .47, mono='#14233F') + '<rect x="1207" y="692" width="120" height="120" rx="60" fill="#14233F"/>' + mark(1212.96, 697.96, .42542613636, on_dark=True) + '<rect x="1390" y="700" width="48" height="48" rx="11" fill="url(#voice-ink)"/>' + mark(1398.25, 708.25, .123046875, on_dark=True) + lettering('48 px', 1390, 781, 14, '#64738A')
for index, (color, label) in enumerate([('#14233F', 'INK'), ('#2B65EF', 'BLUE'), ('#6576FF', 'IRIS'), ('#79E8C5', 'MINT')]):
    preview += f'<rect x="{866+index*158}" y="850" width="132" height="18" rx="9" fill="{color}"/>' + lettering(label, 866+index*158, 895, 13, '#64738A', tracking=1)
write_svg(LOGO / 'voice-brand-preview.svg', 1600, 1000, preview, 'Voice waveform identity with rounded Nunito wordmark')
