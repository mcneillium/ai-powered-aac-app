#!/usr/bin/env python3
"""Generate Voice brand assets for app + Google Play."""

from PIL import Image, ImageDraw, ImageFont
import math, os

# ── Brand palette ──
PAL = {
    "teal":       (91, 181, 181),
    "teal_dark":  (62, 142, 142),
    "coral":      (244, 166, 131),
    "lilac":      (184, 169, 212),
    "green":      (125, 200, 158),
    "sky":        (124, 185, 232),
    "cream":      (248, 246, 243),
    "white":      (255, 255, 255),
    "text_dark":  (58, 58, 74),
    "text_mid":   (120, 120, 140),
    "stroke":     (212, 208, 204),
}

OUT = "/home/user/ai-powered-aac-app/assets/branding"
ASSETS = "/home/user/ai-powered-aac-app/assets"
os.makedirs(f"{OUT}/logo", exist_ok=True)
os.makedirs(f"{OUT}/google-play/feature-graphic", exist_ok=True)
os.makedirs(f"{OUT}/google-play/screenshots", exist_ok=True)

def rounded_rect(draw, bbox, radius, fill, outline=None, width=0):
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = bbox
    r = min(radius, (x1-x0)//2, (y1-y0)//2)
    draw.rounded_rectangle(bbox, radius=r, fill=fill, outline=outline, width=width)

def pill(draw, cx, cy, w, h, fill, outline=None, width=0):
    """Draw a vertical pill (capsule) centered at cx, cy."""
    r = w // 2
    bbox = (cx - w//2, cy - h//2, cx + w//2, cy + h//2)
    draw.rounded_rectangle(bbox, radius=r, fill=fill, outline=outline, width=width)

def gradient_bg(img, color_top, color_bot):
    """Fill image with a vertical gradient."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    for y in range(h):
        t = y / h
        r = int(color_top[0] + (color_bot[0] - color_top[0]) * t)
        g = int(color_top[1] + (color_bot[1] - color_top[1]) * t)
        b = int(color_top[2] + (color_bot[2] - color_top[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

def draw_mic_icon(draw, cx, cy, scale, color):
    """Draw a simple microphone icon using basic shapes."""
    s = scale
    # Mic body (rounded rect / pill)
    pill(draw, cx, cy - int(6*s), int(14*s), int(28*s), fill=color)
    # Arc below mic (half circle)
    arc_bbox = (cx - int(12*s), cy - int(14*s), cx + int(12*s), cy + int(10*s))
    draw.arc(arc_bbox, start=0, end=180, fill=color, width=max(1, int(2.5*s)))
    # Stem
    draw.line([(cx, cy + int(10*s)), (cx, cy + int(18*s))], fill=color, width=max(1, int(2.5*s)))
    # Base
    draw.line([(cx - int(6*s), cy + int(18*s)), (cx + int(6*s), cy + int(18*s))], fill=color, width=max(1, int(2.5*s)))

def draw_speech_waves(draw, cx, cy, scale, color):
    """Draw 2 concentric speech wave arcs to the right of a point."""
    s = scale
    for i, offset in enumerate([12, 22]):
        r = int(offset * s)
        bbox = (cx - r, cy - r, cx + r, cy + r)
        draw.arc(bbox, start=-40, end=40, fill=color, width=max(1, int(2.5*s)))

def draw_text_centered(draw, text, cx, cy, font, fill):
    """Draw text centered at cx, cy."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw//2, cy - th//2), text, font=font, fill=fill)

def get_font(size):
    """Get a font, falling back gracefully."""
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


# ════════════════════════════════════════════
# 1. APP ICON — 1024x1024
# ════════════════════════════════════════════
def create_app_icon():
    size = 1024
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)

    # Background: rounded square with soft teal
    rounded_rect(draw, (0, 0, size, size), 220, fill=PAL["teal"])

    # Decorative: 3 vertical pills at bottom-left, faded
    pill_color = (255, 255, 255, 50)
    # Use overlay for semi-transparent pills
    overlay = Image.new("RGBA", (size, size), (0,0,0,0))
    odraw = ImageDraw.Draw(overlay)
    pill(odraw, 180, 750, 60, 200, fill=(255,255,255,35))
    pill(odraw, 270, 700, 60, 260, fill=(255,255,255,25))
    pill(odraw, 360, 770, 60, 180, fill=(255,255,255,20))
    # Top-right decorative pills
    pill(odraw, 780, 250, 50, 160, fill=(255,255,255,25))
    pill(odraw, 860, 200, 50, 200, fill=(255,255,255,20))
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    # Central: microphone icon
    draw_mic_icon(draw, 512, 380, 12, PAL["white"])

    # Speech wave arcs
    draw_speech_waves(draw, 570, 360, 10, PAL["white"])

    # "Voice" text below
    font = get_font(140)
    draw_text_centered(draw, "Voice", 512, 600, font, PAL["white"])

    # Small tagline
    font_sm = get_font_regular(42)
    draw_text_centered(draw, "communication for everyone", 512, 700, font_sm, (255, 255, 255, 200))

    img.save(f"{OUT}/logo/icon-1024.png", "PNG")
    print("  ✓ icon-1024.png")

    # Also save as the main app icon (512x512 for app.json)
    icon_512 = img.resize((512, 512), Image.LANCZOS)
    icon_512.save(f"{ASSETS}/icon.png", "PNG")
    print("  ✓ assets/icon.png (512x512)")

    return img


# ════════════════════════════════════════════
# 2. ADAPTIVE ICON — foreground + background
# ════════════════════════════════════════════
def create_adaptive_icon():
    # Android adaptive icon: 108dp at xxxhdpi = 432px, but standard source is 1024
    # Foreground: icon content in center 66% safe zone (on 1024 canvas)
    size = 1024

    # BACKGROUND: solid teal
    bg = Image.new("RGBA", (size, size), PAL["teal"])
    bg.save(f"{OUT}/logo/adaptive-icon-background.png", "PNG")
    # Also save to assets/ for app.json
    bg.save(f"{ASSETS}/adaptive-icon-background.png", "PNG")
    print("  ✓ adaptive-icon-background.png")

    # FOREGROUND: mic + text on transparent, centered in safe zone
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fg)

    # Mic icon centered, slightly above middle
    draw_mic_icon(draw, 512, 400, 10, PAL["white"])
    draw_speech_waves(draw, 565, 385, 8, PAL["white"])

    # "Voice" text
    font = get_font(120)
    draw_text_centered(draw, "Voice", 512, 580, font, PAL["white"])

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

    # Mic icon
    draw_mic_icon(draw, 512, 380, 12, PAL["teal"])
    draw_speech_waves(draw, 570, 360, 10, PAL["teal"])

    # "Voice" text
    font = get_font(140)
    draw_text_centered(draw, "Voice", 512, 580, font, PAL["teal"])

    font_sm = get_font_regular(42)
    draw_text_centered(draw, "communication for everyone", 512, 680, font_sm, PAL["text_mid"])

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
# 5. FEATURE GRAPHIC — 1024x500
# ════════════════════════════════════════════
def create_feature_graphic():
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), PAL["white"])

    # Soft gradient background: cream to white
    gradient_bg(img, (235, 245, 245), PAL["cream"])
    draw = ImageDraw.Draw(img)

    # Decorative vertical pills across the background
    overlay = Image.new("RGBA", (w, h), (0,0,0,0))
    odraw = ImageDraw.Draw(overlay)

    # Left cluster of pills
    pills_left = [
        (80, 320, 40, 140, PAL["coral"] + (40,)),
        (140, 280, 40, 180, PAL["lilac"] + (35,)),
        (200, 340, 40, 120, PAL["green"] + (40,)),
        (260, 300, 40, 160, PAL["sky"] + (30,)),
    ]
    for cx, cy, pw, ph, c in pills_left:
        pill(odraw, cx, cy, pw, ph, fill=c)

    # Right cluster of pills
    pills_right = [
        (w-260, 310, 40, 150, PAL["sky"] + (35,)),
        (w-200, 280, 40, 180, PAL["green"] + (30,)),
        (w-140, 330, 40, 130, PAL["coral"] + (35,)),
        (w-80, 290, 40, 170, PAL["lilac"] + (30,)),
    ]
    for cx, cy, pw, ph, c in pills_right:
        pill(odraw, cx, cy, pw, ph, fill=c)

    # Subtle circle accents
    for (cx, cy, r, c) in [
        (120, 100, 25, PAL["teal"] + (25,)),
        (900, 120, 20, PAL["coral"] + (30,)),
        (180, 430, 15, PAL["lilac"] + (25,)),
        (850, 400, 18, PAL["green"] + (25,)),
    ]:
        odraw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=c)

    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    draw = ImageDraw.Draw(img_rgba)

    # Central mic icon
    draw_mic_icon(draw, 512, 150, 5, PAL["teal"])
    draw_speech_waves(draw, 540, 142, 4.5, PAL["teal"])

    # "Voice" large text
    font_big = get_font(96)
    draw_text_centered(draw, "Voice", 512, 260, font_big, PAL["text_dark"])

    # Tagline
    font_tag = get_font_regular(32)
    draw_text_centered(draw, "A calm, friendly AAC communication app", 512, 340, font_tag, PAL["text_mid"])

    # Sub-tagline
    font_sub = get_font_regular(24)
    draw_text_centered(draw, "Works offline  •  Learns on-device  •  Built for accessibility", 512, 400, font_sub, PAL["teal_dark"])

    final = img_rgba.convert("RGB")
    final.save(f"{OUT}/google-play/feature-graphic/feature-graphic-1024x500.png", "PNG")
    print("  ✓ feature-graphic-1024x500.png")


# ════════════════════════════════════════════
# 6. SCREENSHOT TEMPLATES — 1080x1920 × 4
# ════════════════════════════════════════════
SCREENSHOT_DATA = [
    {
        "id": 1,
        "headline": "Tap. Build. Speak.",
        "subheading": "Colour-coded words make communication simple",
        "bg_accent": PAL["teal"],
        "screen": "AAC Board",
    },
    {
        "id": 2,
        "headline": "Smart Suggestions",
        "subheading": "AI learns your patterns — entirely on your device",
        "bg_accent": PAL["sky"],
        "screen": "Sentence Builder with AI strip",
    },
    {
        "id": 3,
        "headline": "Your Way, Your Voice",
        "subheading": "Themes, grid sizes, speech speed — fully adjustable",
        "bg_accent": PAL["lilac"],
        "screen": "Settings",
    },
    {
        "id": 4,
        "headline": "Works Everywhere",
        "subheading": "Full offline support — no internet needed to communicate",
        "bg_accent": PAL["green"],
        "screen": "Emotion / Communication",
    },
]

def create_screenshot_template(data):
    w, h = 1080, 1920
    img = Image.new("RGB", (w, h), PAL["cream"])
    draw = ImageDraw.Draw(img)

    accent = data["bg_accent"]
    # Soft accent band at top
    light_accent = tuple(min(255, c + 160) for c in accent)
    for y in range(500):
        t = y / 500
        r = int(light_accent[0] + (PAL["cream"][0] - light_accent[0]) * t)
        g = int(light_accent[1] + (PAL["cream"][1] - light_accent[1]) * t)
        b = int(light_accent[2] + (PAL["cream"][2] - light_accent[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Headline
    font_h = get_font(72)
    draw_text_centered(draw, data["headline"], w//2, 180, font_h, PAL["text_dark"])

    # Subheading
    font_s = get_font_regular(36)
    draw_text_centered(draw, data["subheading"], w//2, 280, font_s, PAL["text_mid"])

    # Screenshot placeholder area (phone frame mock)
    frame_x = 90
    frame_y = 400
    frame_w = w - 180
    frame_h = 1400
    # Shadow
    rounded_rect(draw, (frame_x+6, frame_y+6, frame_x+frame_w+6, frame_y+frame_h+6),
                 40, fill=(0,0,0,20))
    # Frame
    rounded_rect(draw, (frame_x, frame_y, frame_x+frame_w, frame_y+frame_h),
                 40, fill=PAL["white"], outline=PAL["stroke"], width=3)

    # Placeholder text inside frame
    font_p = get_font_regular(32)
    draw_text_centered(draw, f"[ {data['screen']} screenshot ]", w//2, frame_y + frame_h//2 - 20, font_p, PAL["stroke"])
    font_p2 = get_font_regular(24)
    draw_text_centered(draw, "Capture from device and paste here", w//2, frame_y + frame_h//2 + 30, font_p2, PAL["stroke"])

    # Small Voice branding at bottom
    font_b = get_font(28)
    draw_text_centered(draw, "Voice", w//2, h - 50, font_b, accent)

    fname = f"screenshot-{data['id']}-template.png"
    img.save(f"{OUT}/google-play/screenshots/{fname}", "PNG")
    print(f"  ✓ {fname}")


# ════════════════════════════════════════════
# RUN ALL
# ════════════════════════════════════════════
print("Generating Voice brand assets...\n")

print("[1/6] App icon")
icon = create_app_icon()

print("[2/6] Adaptive icon")
create_adaptive_icon()

print("[3/6] Splash icon")
create_splash()

print("[4/6] Favicon")
create_favicon(icon)

print("[5/6] Feature graphic")
create_feature_graphic()

print("[6/6] Screenshot templates")
for s in SCREENSHOT_DATA:
    create_screenshot_template(s)

print("\nDone. All assets in assets/ and assets/branding/")
