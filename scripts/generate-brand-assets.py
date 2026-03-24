#!/usr/bin/env python3
"""Generate Voice brand assets for app + Google Play.

Refined Voice visual identity — soft, calm, child-friendly, accessible.
Run: python3 scripts/generate-brand-assets.py
"""

from PIL import Image, ImageDraw, ImageFont
import math, os

# ── Refined Brand Palette ──
PAL = {
    "teal":        (74, 173, 168),    # #4AADA8 — primary, warmer and softer
    "teal_soft":   (214, 237, 236),   # #D6EDEC — muted teal tint
    "teal_dark":   (55, 130, 126),    # #37827E — pressed / hover
    "coral":       (232, 160, 112),   # #E8A070 — warm accent
    "coral_soft":  (248, 222, 206),   # #F8DECE — coral tint
    "lilac":       (176, 162, 204),   # #B0A2CC — personalisation accent
    "lilac_soft":  (230, 224, 242),   # #E6E0F2 — lilac tint
    "green":       (107, 191, 144),   # #6BBF90 — success / ready
    "green_soft":  (216, 241, 227),   # #D8F1E3 — green tint
    "sky":         (107, 179, 217),   # #6BB3D9 — AI / smart accent
    "sky_soft":    (214, 234, 246),   # #D6EAF6 — sky tint
    "cream":       (250, 250, 248),   # #FAFAF8 — page bg
    "warm_cream":  (244, 242, 239),   # #F4F2EF — surface
    "white":       (255, 255, 255),
    "text_dark":   (46, 46, 58),      # #2E2E3A — headings
    "text_mid":    (110, 110, 130),   # #6E6E82 — subheadings
    "stroke":      (221, 217, 212),   # #DDD9D4 — borders
}

OUT = "/home/user/ai-powered-aac-app/assets/branding"
ASSETS = "/home/user/ai-powered-aac-app/assets"
os.makedirs(f"{OUT}/logo", exist_ok=True)
os.makedirs(f"{OUT}/google-play/feature-graphic", exist_ok=True)
os.makedirs(f"{OUT}/google-play/screenshots", exist_ok=True)
os.makedirs(f"{OUT}/splash", exist_ok=True)
os.makedirs(f"{OUT}/motifs", exist_ok=True)

def rounded_rect(draw, bbox, radius, fill, outline=None, width=0):
    x0, y0, x1, y1 = bbox
    r = min(radius, (x1-x0)//2, (y1-y0)//2)
    draw.rounded_rectangle(bbox, radius=r, fill=fill, outline=outline, width=width)

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
    # Mic body — slightly taller, more refined proportions
    pill(draw, cx, cy - int(5*s), int(13*s), int(30*s), fill=color)
    # Arc below mic
    arc_bbox = (cx - int(11*s), cy - int(12*s), cx + int(11*s), cy + int(12*s))
    draw.arc(arc_bbox, start=0, end=180, fill=color, width=max(1, int(2.8*s)))
    # Stem
    draw.line([(cx, cy + int(12*s)), (cx, cy + int(20*s))], fill=color, width=max(1, int(2.8*s)))
    # Base — rounded ends
    base_y = cy + int(20*s)
    draw.line([(cx - int(7*s), base_y), (cx + int(7*s), base_y)], fill=color, width=max(1, int(2.8*s)))

def draw_speech_waves(draw, cx, cy, scale, color):
    s = scale
    for offset in [13, 24]:
        r = int(offset * s)
        bbox = (cx - r, cy - r, cx + r, cy + r)
        draw.arc(bbox, start=-45, end=45, fill=color, width=max(1, int(2.8*s)))

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


# ════════════════════════════════════════════
# 1. APP ICON — 1024x1024
# ════════════════════════════════════════════
def create_app_icon():
    size = 1024
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)

    # Background: rounded square with refined teal
    rounded_rect(draw, (0, 0, size, size), 224, fill=PAL["teal"])

    # Soft decorative blobs (organic circles, not just pills)
    overlay = Image.new("RGBA", (size, size), (0,0,0,0))
    odraw = ImageDraw.Draw(overlay)

    # Bottom-left cluster — soft rounded shapes
    soft_ellipse(odraw, 160, 780, 55, 90, (255,255,255,28))
    soft_ellipse(odraw, 270, 720, 50, 110, (255,255,255,22))
    soft_ellipse(odraw, 370, 800, 45, 75, (255,255,255,18))

    # Top-right cluster
    soft_ellipse(odraw, 790, 240, 40, 70, (255,255,255,22))
    soft_ellipse(odraw, 870, 190, 45, 85, (255,255,255,16))

    # Subtle large circle behind icon area for depth
    soft_ellipse(odraw, 512, 440, 240, 240, (255,255,255,12))

    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    # Central microphone icon — slightly larger
    draw_mic_icon(draw, 500, 360, 13, PAL["white"])
    draw_speech_waves(draw, 570, 340, 10, PAL["white"])

    # "Voice" text
    font = get_font(148)
    draw_text_centered(draw, "Voice", 512, 600, font, PAL["white"])

    # Tagline
    font_sm = get_font_regular(40)
    draw_text_centered(draw, "communication for everyone", 512, 710, font_sm, (255,255,255,180))

    img.save(f"{OUT}/logo/icon-1024.png", "PNG")
    print("  ✓ icon-1024.png")

    # App icon for app.json (512x512)
    icon_512 = img.resize((512, 512), Image.LANCZOS)
    icon_512.save(f"{ASSETS}/icon.png", "PNG")
    print("  ✓ assets/icon.png (512x512)")

    return img


# ════════════════════════════════════════════
# 2. ADAPTIVE ICON — foreground + background
# ════════════════════════════════════════════
def create_adaptive_icon():
    size = 1024

    # BACKGROUND: solid teal
    bg = Image.new("RGBA", (size, size), PAL["teal"])
    # Add very subtle radial lighter center
    overlay = Image.new("RGBA", (size, size), (0,0,0,0))
    odraw = ImageDraw.Draw(overlay)
    soft_ellipse(odraw, 512, 480, 320, 320, (255,255,255,15))
    bg = Image.alpha_composite(bg, overlay)

    bg.save(f"{OUT}/logo/adaptive-icon-background.png", "PNG")
    bg.save(f"{ASSETS}/adaptive-icon-background.png", "PNG")
    print("  ✓ adaptive-icon-background.png")

    # FOREGROUND: mic + text on transparent, in 66% safe zone
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fg)

    draw_mic_icon(draw, 500, 380, 11, PAL["white"])
    draw_speech_waves(draw, 565, 365, 8.5, PAL["white"])

    font = get_font(124)
    draw_text_centered(draw, "Voice", 512, 570, font, PAL["white"])

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

    # Subtle circle behind the icon
    soft_ellipse(draw, 512, 420, 180, 180, PAL["teal_soft"] + (80,))

    draw_mic_icon(draw, 500, 370, 12, PAL["teal"])
    draw_speech_waves(draw, 570, 350, 10, PAL["teal"])

    font = get_font(148)
    draw_text_centered(draw, "Voice", 512, 580, font, PAL["teal"])

    font_sm = get_font_regular(40)
    draw_text_centered(draw, "communication for everyone", 512, 690, font_sm, PAL["text_mid"])

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
# 5. BRAND MARK — 256x256 (small badge)
# ════════════════════════════════════════════
def create_brand_mark():
    size = 256
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    rounded_rect(draw, (0, 0, size, size), 56, fill=PAL["teal"])
    draw_mic_icon(draw, 124, 100, 3.2, PAL["white"])
    draw_speech_waves(draw, 142, 94, 2.5, PAL["white"])
    font = get_font(44)
    draw_text_centered(draw, "Voice", 128, 175, font, PAL["white"])
    img.save(f"{OUT}/logo/brand-mark-256.png", "PNG")
    print("  ✓ brand-mark-256.png")


# ════════════════════════════════════════════
# 6. FEATURE GRAPHIC — 1024x500
# ════════════════════════════════════════════
def create_feature_graphic():
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), PAL["white"])

    # Soft gradient background
    gradient_bg(img, (228, 242, 241), PAL["cream"])
    draw = ImageDraw.Draw(img)

    # Decorative elements via overlay
    overlay = Image.new("RGBA", (w, h), (0,0,0,0))
    odraw = ImageDraw.Draw(overlay)

    # Left organic blobs
    soft_ellipse(odraw, 70, 340, 40, 65, PAL["coral"] + (35,))
    soft_ellipse(odraw, 140, 290, 35, 80, PAL["lilac"] + (30,))
    soft_ellipse(odraw, 210, 350, 35, 55, PAL["green"] + (35,))
    soft_ellipse(odraw, 280, 310, 35, 70, PAL["sky"] + (28,))

    # Right organic blobs
    soft_ellipse(odraw, w-280, 320, 35, 65, PAL["sky"] + (30,))
    soft_ellipse(odraw, w-210, 290, 35, 80, PAL["green"] + (28,))
    soft_ellipse(odraw, w-140, 340, 35, 55, PAL["coral"] + (30,))
    soft_ellipse(odraw, w-70, 300, 35, 75, PAL["lilac"] + (25,))

    # Subtle large circle behind center
    soft_ellipse(odraw, 512, 220, 160, 160, PAL["teal_soft"] + (30,))

    # Tiny accent circles
    for (cx, cy, r, c) in [
        (130, 90, 20, PAL["teal"] + (20,)),
        (890, 100, 16, PAL["coral"] + (25,)),
        (190, 440, 12, PAL["lilac"] + (20,)),
        (840, 420, 14, PAL["green"] + (22,)),
    ]:
        soft_ellipse(odraw, cx, cy, r, r, c)

    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    draw = ImageDraw.Draw(img_rgba)

    # Mic icon
    draw_mic_icon(draw, 512, 130, 5, PAL["teal"])
    draw_speech_waves(draw, 540, 124, 4.5, PAL["teal"])

    # "Voice" title
    font_big = get_font(100)
    draw_text_centered(draw, "Voice", 512, 250, font_big, PAL["text_dark"])

    # Tagline
    font_tag = get_font_regular(30)
    draw_text_centered(draw, "A calm, friendly AAC communication app", 512, 335, font_tag, PAL["text_mid"])

    # Sub-tagline
    font_sub = get_font_regular(22)
    draw_text_centered(draw, "Works offline  ·  Learns on-device  ·  Built for accessibility", 512, 395, font_sub, PAL["teal_dark"])

    final = img_rgba.convert("RGB")
    final.save(f"{OUT}/google-play/feature-graphic/feature-graphic-1024x500.png", "PNG")
    print("  ✓ feature-graphic-1024x500.png")


# ════════════════════════════════════════════
# 7. SCREENSHOT TEMPLATES — 1080x1920 × 4
# ════════════════════════════════════════════
SCREENSHOT_DATA = [
    {
        "id": 1,
        "headline": "Tap. Build. Speak.",
        "subheading": "Colour-coded words make communication simple",
        "bg_accent": PAL["teal"],
        "bg_soft": PAL["teal_soft"],
        "screen": "AAC Board",
    },
    {
        "id": 2,
        "headline": "Smart Suggestions",
        "subheading": "AI learns your patterns — entirely on your device",
        "bg_accent": PAL["sky"],
        "bg_soft": PAL["sky_soft"],
        "screen": "Sentence Builder with AI strip",
    },
    {
        "id": 3,
        "headline": "Your Way, Your Voice",
        "subheading": "Themes, grid sizes, speech speed — fully adjustable",
        "bg_accent": PAL["lilac"],
        "bg_soft": PAL["lilac_soft"],
        "screen": "Settings",
    },
    {
        "id": 4,
        "headline": "Works Everywhere",
        "subheading": "Full offline support — no internet needed to communicate",
        "bg_accent": PAL["green"],
        "bg_soft": PAL["green_soft"],
        "screen": "Emotion / Communication",
    },
]

def create_screenshot_template(data):
    w, h = 1080, 1920
    img = Image.new("RGB", (w, h), PAL["cream"])
    draw = ImageDraw.Draw(img)

    accent = data["bg_accent"]
    accent_soft = data["bg_soft"]

    # Softer gradient band at top
    for y in range(480):
        t = y / 480
        # Ease out curve for smoother transition
        t = t * t
        r = int(accent_soft[0] + (PAL["cream"][0] - accent_soft[0]) * t)
        g = int(accent_soft[1] + (PAL["cream"][1] - accent_soft[1]) * t)
        b = int(accent_soft[2] + (PAL["cream"][2] - accent_soft[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Subtle decorative circle in header area
    overlay = Image.new("RGBA", (w, h), (0,0,0,0))
    odraw = ImageDraw.Draw(overlay)
    soft_ellipse(odraw, w//2, 180, 200, 200, accent + (12,))
    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, overlay)
    draw = ImageDraw.Draw(img_rgba)

    # Headline
    font_h = get_font(72)
    draw_text_centered(draw, data["headline"], w//2, 170, font_h, PAL["text_dark"])

    # Subheading
    font_s = get_font_regular(34)
    draw_text_centered(draw, data["subheading"], w//2, 268, font_s, PAL["text_mid"])

    # Screenshot phone frame
    frame_x = 90
    frame_y = 380
    frame_w = w - 180
    frame_h = 1400

    # Soft shadow (two layers)
    for off, alpha in [(8, 12), (4, 18)]:
        shadow = Image.new("RGBA", (w, h), (0,0,0,0))
        sdraw = ImageDraw.Draw(shadow)
        rounded_rect(sdraw, (frame_x+off, frame_y+off, frame_x+frame_w+off, frame_y+frame_h+off),
                     36, fill=(0,0,0,alpha))
        img_rgba = Image.alpha_composite(img_rgba, shadow)
    draw = ImageDraw.Draw(img_rgba)

    # Frame
    rounded_rect(draw, (frame_x, frame_y, frame_x+frame_w, frame_y+frame_h),
                 36, fill=PAL["white"], outline=PAL["stroke"], width=2)

    # Placeholder text inside frame
    font_p = get_font_regular(30)
    draw_text_centered(draw, f"[ {data['screen']} screenshot ]", w//2, frame_y + frame_h//2 - 20, font_p, PAL["stroke"])
    font_p2 = get_font_regular(22)
    draw_text_centered(draw, "Capture from device and paste here", w//2, frame_y + frame_h//2 + 25, font_p2, PAL["stroke"])

    # Small Voice branding at bottom
    font_b = get_font(26)
    draw_text_centered(draw, "Voice", w//2, h - 48, font_b, accent)

    fname = f"screenshot-{data['id']}-template.png"
    final = img_rgba.convert("RGB")
    final.save(f"{OUT}/google-play/screenshots/{fname}", "PNG")
    print(f"  ✓ {fname}")


# ════════════════════════════════════════════
# 8. MOTIF — soft blob decoration (reusable)
# ════════════════════════════════════════════
def create_motif():
    """A small set of soft blob shapes for in-app or marketing use."""
    size = 512
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)

    # Cluster of soft blobs
    soft_ellipse(draw, 160, 260, 60, 100, PAL["teal"] + (40,))
    soft_ellipse(draw, 260, 200, 55, 110, PAL["lilac"] + (35,))
    soft_ellipse(draw, 350, 280, 50, 85, PAL["coral"] + (40,))
    soft_ellipse(draw, 250, 360, 55, 80, PAL["green"] + (35,))
    soft_ellipse(draw, 150, 380, 40, 60, PAL["sky"] + (30,))

    img.save(f"{OUT}/motifs/soft-blobs-512.png", "PNG")
    print("  ✓ motifs/soft-blobs-512.png")


# ════════════════════════════════════════════
# RUN ALL
# ════════════════════════════════════════════
print("Generating Voice brand assets (v2 — refined)\n")

print("[1/8] App icon")
icon = create_app_icon()

print("[2/8] Adaptive icon")
create_adaptive_icon()

print("[3/8] Splash icon")
create_splash()

print("[4/8] Favicon")
create_favicon(icon)

print("[5/8] Brand mark")
create_brand_mark()

print("[6/8] Feature graphic")
create_feature_graphic()

print("[7/8] Screenshot templates")
for s in SCREENSHOT_DATA:
    create_screenshot_template(s)

print("[8/8] Motif assets")
create_motif()

print("\nDone. All assets regenerated in assets/ and assets/branding/")
