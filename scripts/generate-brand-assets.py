#!/usr/bin/env python3
"""Generate Voice brand assets for app + Google Play.

Voice icon design: 5 vertical blue pills spelling V-O-I-C-E
in an equalizer/soundwave pattern, with a small mic above the I pill.
Primary blue: #2979FF

Run: python3 scripts/generate-brand-assets.py
"""

from PIL import Image, ImageDraw, ImageFont
import math, os

# ── Brand Palette (matching icon blue) ──
PAL = {
    "blue":        (41, 121, 255),    # #2979FF — primary
    "blue_dark":   (25, 90, 200),     # #195AC8 — pressed
    "blue_soft":   (220, 234, 255),   # #DCEAFF — muted tint
    "blue_mid":    (68, 138, 255),    # #448AFF — accent
    "coral":       (232, 160, 112),   # #E8A070 — warm accent
    "green":       (107, 191, 144),   # #6BBF90 — success
    "lilac":       (124, 143, 204),   # #7C8FCC — secondary accent
    "cream":       (250, 250, 250),   # #FAFAFA — page bg
    "surface":     (242, 244, 247),   # #F2F4F7 — surface
    "white":       (255, 255, 255),
    "text_dark":   (46, 46, 58),      # #2E2E3A
    "text_mid":    (110, 110, 130),   # #6E6E82
    "stroke":      (221, 217, 212),   # #DDD9D4
}

OUT = "/home/user/ai-powered-aac-app/assets/branding"
ASSETS = "/home/user/ai-powered-aac-app/assets"
os.makedirs(f"{OUT}/logo", exist_ok=True)
os.makedirs(f"{OUT}/google-play/feature-graphic", exist_ok=True)
os.makedirs(f"{OUT}/google-play/screenshots", exist_ok=True)
os.makedirs(f"{OUT}/splash", exist_ok=True)
os.makedirs(f"{OUT}/motifs", exist_ok=True)

def pill(draw, cx, cy, w, h, fill, outline=None, width=0):
    r = w // 2
    bbox = (cx - w//2, cy - h//2, cx + w//2, cy + h//2)
    draw.rounded_rectangle(bbox, radius=r, fill=fill, outline=outline, width=width)

def soft_ellipse(draw, cx, cy, rx, ry, fill):
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=fill)

def gradient_bg(img, color_top, color_bot):
    draw = ImageDraw.Draw(img)
    w, h = img.size
    for y in range(h):
        t = y / h
        r = int(color_top[0] + (color_bot[0] - color_top[0]) * t)
        g = int(color_top[1] + (color_bot[1] - color_top[1]) * t)
        b = int(color_top[2] + (color_bot[2] - color_top[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

def draw_mic_icon(draw, cx, cy, scale, color):
    s = scale
    pill(draw, cx, cy - int(5*s), int(13*s), int(30*s), fill=color)
    arc_bbox = (cx - int(11*s), cy - int(12*s), cx + int(11*s), cy + int(12*s))
    draw.arc(arc_bbox, start=0, end=180, fill=color, width=max(1, int(2.8*s)))
    draw.line([(cx, cy + int(12*s)), (cx, cy + int(20*s))], fill=color, width=max(1, int(2.8*s)))
    base_y = cy + int(20*s)
    draw.line([(cx - int(7*s), base_y), (cx + int(7*s), base_y)], fill=color, width=max(1, int(2.8*s)))

def draw_text_centered(draw, text, cx, cy, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw//2, cy - th//2), text, font=font, fill=fill)

def get_font(size):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def get_font_regular(size):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def draw_voice_pills(draw, cx, cy, scale, blue, white):
    """Draw the VOICE pill-letter equalizer pattern.
    5 pills of varying height, each containing a letter, forming a wave shape.
    """
    s = scale
    letters = ['V', 'O', 'I', 'C', 'E']
    # Heights form a wave: V=medium, O=tall, I=tallest, C=tall, E=medium
    heights = [int(h * s) for h in [140, 180, 200, 180, 140]]
    pw = int(50 * s)  # pill width
    gap = int(12 * s)  # gap between pills
    total_w = len(letters) * pw + (len(letters) - 1) * gap
    start_x = cx - total_w // 2 + pw // 2

    font = get_font(int(32 * s))

    for i, (letter, h) in enumerate(zip(letters, heights)):
        px = start_x + i * (pw + gap)
        # All pills bottom-aligned, varying top
        pill_cy = cy - h // 2 + int(100 * s) // 2  # shift down so wave is centered
        pill(draw, px, pill_cy, pw, h, fill=blue)
        draw_text_centered(draw, letter, px, pill_cy, font, white)

    # Small mic icon above the I pill (center pill)
    mic_x = start_x + 2 * (pw + gap)
    mic_y = cy - heights[2] // 2 + int(100 * s) // 2 - heights[2] // 2 - int(20 * s)
    draw_mic_icon(draw, mic_x, mic_y, 1.5 * s, blue)


# ════════════════════════════════════════════
# 1. APP ICON — 1024x1024
# ════════════════════════════════════════════
def create_app_icon():
    size = 1024
    img = Image.new("RGBA", (size, size), PAL["white"])
    draw = ImageDraw.Draw(img)

    # Draw the VOICE pill pattern centered
    draw_voice_pills(draw, 512, 480, 2.8, PAL["blue"], PAL["white"])

    img.save(f"{OUT}/logo/icon-1024.png", "PNG")
    print("  ✓ icon-1024.png")

    # 512x512 for app.json
    icon_512 = img.resize((512, 512), Image.LANCZOS)
    icon_512.save(f"{ASSETS}/icon.png", "PNG")
    print("  ✓ assets/icon.png (512x512)")

    return img


# ════════════════════════════════════════════
# 2. ADAPTIVE ICON — foreground + background
# ════════════════════════════════════════════
def create_adaptive_icon():
    size = 1024

    # BACKGROUND: white
    bg = Image.new("RGBA", (size, size), PAL["white"])
    bg.save(f"{OUT}/logo/adaptive-icon-background.png", "PNG")
    bg.save(f"{ASSETS}/adaptive-icon-background.png", "PNG")
    print("  ✓ adaptive-icon-background.png")

    # FOREGROUND: VOICE pills on transparent, within 66% safe zone
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fg)
    draw_voice_pills(draw, 512, 480, 2.4, PAL["blue"], PAL["white"])

    fg.save(f"{OUT}/logo/adaptive-icon-foreground.png", "PNG")
    fg.save(f"{ASSETS}/adaptive-icon.png", "PNG")
    print("  ✓ adaptive-icon-foreground.png")
    print("  ✓ assets/adaptive-icon.png")


# ════════════════════════════════════════════
# 3. SPLASH ICON — 1024x1024
# ════════════════════════════════════════════
def create_splash():
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw_voice_pills(draw, 512, 400, 2.2, PAL["blue"], PAL["white"])

    # Tagline below
    font_sm = get_font_regular(36)
    draw_text_centered(draw, "communication for everyone", 512, 720, font_sm, PAL["text_mid"])

    img.save(f"{ASSETS}/splash-icon.png", "PNG")
    img.save(f"{OUT}/splash/splash-icon.png", "PNG")
    print("  ✓ splash-icon.png")


# ════════════════════════════════════════════
# 4. FAVICON — 48x48
# ════════════════════════════════════════════
def create_favicon(icon_1024):
    fav = icon_1024.resize((48, 48), Image.LANCZOS)
    fav.save(f"{ASSETS}/favicon.png", "PNG")
    print("  ✓ favicon.png (48x48)")


# ════════════════════════════════════════════
# 5. BRAND MARK — 256x256
# ════════════════════════════════════════════
def create_brand_mark():
    size = 256
    img = Image.new("RGBA", (size, size), PAL["white"])
    draw = ImageDraw.Draw(img)
    draw_voice_pills(draw, 128, 120, 0.6, PAL["blue"], PAL["white"])
    img.save(f"{OUT}/logo/brand-mark-256.png", "PNG")
    print("  ✓ brand-mark-256.png")


# ════════════════════════════════════════════
# 6. FEATURE GRAPHIC — 1024x500
# ════════════════════════════════════════════
def create_feature_graphic():
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), PAL["white"])
    gradient_bg(img, (235, 242, 255), PAL["cream"])
    draw = ImageDraw.Draw(img)

    # Decorative soft shapes
    overlay = Image.new("RGBA", (w, h), (0,0,0,0))
    odraw = ImageDraw.Draw(overlay)
    soft_ellipse(odraw, 80, 350, 35, 60, PAL["blue_soft"] + (50,))
    soft_ellipse(odraw, 160, 300, 30, 70, PAL["lilac"] + (40,))
    soft_ellipse(odraw, 240, 360, 30, 50, PAL["green"] + (40,))
    soft_ellipse(odraw, w-240, 330, 30, 60, PAL["blue_soft"] + (40,))
    soft_ellipse(odraw, w-160, 300, 30, 70, PAL["coral"] + (35,))
    soft_ellipse(odraw, w-80, 350, 30, 55, PAL["lilac"] + (35,))

    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    draw = ImageDraw.Draw(img_rgba)

    # VOICE pills — smaller, centered
    draw_voice_pills(draw, 512, 180, 0.9, PAL["blue"], PAL["white"])

    # Tagline
    font_tag = get_font_regular(30)
    draw_text_centered(draw, "A calm, friendly AAC communication app", 512, 340, font_tag, PAL["text_mid"])

    font_sub = get_font_regular(22)
    draw_text_centered(draw, "Works offline  ·  Learns on-device  ·  Built for accessibility", 512, 400, font_sub, PAL["blue_dark"])

    final = img_rgba.convert("RGB")
    final.save(f"{OUT}/google-play/feature-graphic/feature-graphic-1024x500.png", "PNG")
    print("  ✓ feature-graphic-1024x500.png")


# ════════════════════════════════════════════
# 7. SCREENSHOT TEMPLATES — 1080x1920 × 4
# ════════════════════════════════════════════
SCREENSHOT_DATA = [
    {"id": 1, "headline": "Tap. Build. Speak.", "subheading": "Colour-coded words make communication simple",
     "bg_accent": PAL["blue"], "bg_soft": PAL["blue_soft"], "screen": "AAC Board"},
    {"id": 2, "headline": "Smart Suggestions", "subheading": "AI learns your patterns — entirely on your device",
     "bg_accent": PAL["blue_mid"], "bg_soft": (220, 230, 255), "screen": "Sentence Builder with AI strip"},
    {"id": 3, "headline": "Your Way, Your Voice", "subheading": "Themes, grid sizes, speech speed — fully adjustable",
     "bg_accent": PAL["lilac"], "bg_soft": (230, 230, 245), "screen": "Settings"},
    {"id": 4, "headline": "Works Everywhere", "subheading": "Full offline support — no internet needed to communicate",
     "bg_accent": PAL["green"], "bg_soft": (220, 240, 230), "screen": "Emotion / Communication"},
]

def create_screenshot_template(data):
    w, h = 1080, 1920
    img = Image.new("RGB", (w, h), PAL["cream"])
    draw = ImageDraw.Draw(img)

    accent_soft = data["bg_soft"]
    accent = data["bg_accent"]

    # Soft gradient band at top
    for y in range(480):
        t = (y / 480) ** 2
        r = int(accent_soft[0] + (PAL["cream"][0] - accent_soft[0]) * t)
        g = int(accent_soft[1] + (PAL["cream"][1] - accent_soft[1]) * t)
        b = int(accent_soft[2] + (PAL["cream"][2] - accent_soft[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Headline
    font_h = get_font(72)
    draw_text_centered(draw, data["headline"], w//2, 170, font_h, PAL["text_dark"])

    # Subheading
    font_s = get_font_regular(34)
    draw_text_centered(draw, data["subheading"], w//2, 268, font_s, PAL["text_mid"])

    # Phone frame
    frame_x, frame_y = 90, 380
    frame_w, frame_h = w - 180, 1400

    # Shadow layers
    overlay = Image.new("RGBA", (w, h), (0,0,0,0))
    odraw = ImageDraw.Draw(overlay)
    for off, alpha in [(8, 12), (4, 18)]:
        odraw.rounded_rectangle(
            (frame_x+off, frame_y+off, frame_x+frame_w+off, frame_y+frame_h+off),
            radius=36, fill=(0,0,0,alpha))
    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    draw = ImageDraw.Draw(img_rgba)

    # Frame
    draw.rounded_rectangle(
        (frame_x, frame_y, frame_x+frame_w, frame_y+frame_h),
        radius=36, fill=PAL["white"], outline=PAL["stroke"], width=2)

    # Placeholder
    font_p = get_font_regular(30)
    draw_text_centered(draw, f"[ {data['screen']} screenshot ]", w//2, frame_y + frame_h//2 - 20, font_p, PAL["stroke"])

    # Voice branding
    font_b = get_font(26)
    draw_text_centered(draw, "Voice", w//2, h - 48, font_b, accent)

    fname = f"screenshot-{data['id']}-template.png"
    final = img_rgba.convert("RGB")
    final.save(f"{OUT}/google-play/screenshots/{fname}", "PNG")
    print(f"  ✓ {fname}")


# ════════════════════════════════════════════
# RUN ALL
# ════════════════════════════════════════════
print("Generating Voice brand assets (blue pill icon)\n")

print("[1/7] App icon")
icon = create_app_icon()

print("[2/7] Adaptive icon")
create_adaptive_icon()

print("[3/7] Splash icon")
create_splash()

print("[4/7] Favicon")
create_favicon(icon)

print("[5/7] Brand mark")
create_brand_mark()

print("[6/7] Feature graphic")
create_feature_graphic()

print("[7/7] Screenshot templates")
for s in SCREENSHOT_DATA:
    create_screenshot_template(s)

print("\nDone. All assets regenerated.")
