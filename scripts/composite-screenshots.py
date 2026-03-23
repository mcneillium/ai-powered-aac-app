#!/usr/bin/env python3
"""
Composite real screenshots into Voice Play Store templates.

USAGE:
  1. Capture 4 screenshots from your device/emulator at any resolution
  2. Save them as:
       assets/branding/google-play/screenshots/raw/raw-1.png  (AAC Board)
       assets/branding/google-play/screenshots/raw/raw-2.png  (Sentence Builder)
       assets/branding/google-play/screenshots/raw/raw-3.png  (Settings)
       assets/branding/google-play/screenshots/raw/raw-4.png  (Emotion)
  3. Run: python3 scripts/composite-screenshots.py
  4. Final outputs appear at:
       assets/branding/google-play/screenshots/final-1.png
       assets/branding/google-play/screenshots/final-2.png
       assets/branding/google-play/screenshots/final-3.png
       assets/branding/google-play/screenshots/final-4.png

  Alternatively, capture via ADB:
    adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png raw-1.png
"""

from PIL import Image, ImageDraw, ImageFont
import os, sys

# ── Paths ──
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS = os.path.join(BASE, "assets", "branding", "google-play", "screenshots")
RAW_DIR = os.path.join(SCREENSHOTS, "raw")

# ── Brand palette ──
PAL = {
    "teal":      (91, 181, 181),
    "sky":       (124, 185, 232),
    "lilac":     (184, 169, 212),
    "green":     (125, 200, 158),
    "cream":     (248, 246, 243),
    "white":     (255, 255, 255),
    "text_dark": (58, 58, 74),
    "text_mid":  (120, 120, 140),
    "stroke":    (212, 208, 204),
}

SCREENSHOT_DATA = [
    {
        "id": 1,
        "headline": "Tap. Build. Speak.",
        "subheading": "Colour-coded words make communication simple",
        "bg_accent": PAL["teal"],
    },
    {
        "id": 2,
        "headline": "Smart Suggestions",
        "subheading": "AI learns your patterns — entirely on your device",
        "bg_accent": PAL["sky"],
    },
    {
        "id": 3,
        "headline": "Your Way, Your Voice",
        "subheading": "Themes, grid sizes, speech speed — fully adjustable",
        "bg_accent": PAL["lilac"],
    },
    {
        "id": 4,
        "headline": "Works Everywhere",
        "subheading": "Full offline support — no internet needed to communicate",
        "bg_accent": PAL["green"],
    },
]

# ── Helpers ──
def get_font(size):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def get_font_regular(size):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def draw_text_centered(draw, text, cx, cy, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw//2, cy - th//2), text, font=font, fill=fill)

def rounded_rect(draw, bbox, radius, fill, outline=None, width=0):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

def create_rounded_mask(size, radius):
    """Create a rounded rectangle mask for cropping screenshots."""
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def composite_screenshot(data, raw_path):
    """Create a final Play Store screenshot with real app capture composited in."""
    w, h = 1080, 1920
    img = Image.new("RGB", (w, h), PAL["cream"])
    draw = ImageDraw.Draw(img)

    accent = data["bg_accent"]

    # Soft accent gradient at top
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

    # Phone frame area
    frame_x = 90
    frame_y = 400
    frame_w = w - 180  # 900
    frame_h = 1400
    frame_r = 40

    # Shadow
    rounded_rect(draw, (frame_x+6, frame_y+6, frame_x+frame_w+6, frame_y+frame_h+6),
                 frame_r, fill=(200, 200, 200))

    # White frame background
    rounded_rect(draw, (frame_x, frame_y, frame_x+frame_w, frame_y+frame_h),
                 frame_r, fill=PAL["white"], outline=PAL["stroke"], width=2)

    # Load and resize the raw screenshot to fit inside the frame
    padding = 8
    inner_w = frame_w - (padding * 2)
    inner_h = frame_h - (padding * 2)

    raw = Image.open(raw_path).convert("RGB")
    # Resize maintaining aspect ratio, then crop to fill
    raw_ratio = raw.width / raw.height
    target_ratio = inner_w / inner_h

    if raw_ratio > target_ratio:
        # Raw is wider — fit by height, crop width
        new_h = inner_h
        new_w = int(new_h * raw_ratio)
    else:
        # Raw is taller — fit by width, crop height
        new_w = inner_w
        new_h = int(new_w / raw_ratio)

    raw = raw.resize((new_w, new_h), Image.LANCZOS)

    # Center crop
    left = (new_w - inner_w) // 2
    top = (new_h - inner_h) // 2
    raw = raw.crop((left, top, left + inner_w, top + inner_h))

    # Apply rounded corners to the screenshot
    mask = create_rounded_mask((inner_w, inner_h), frame_r - padding)
    # Create a white background and paste with mask
    screenshot_layer = Image.new("RGB", (inner_w, inner_h), PAL["white"])
    screenshot_layer.paste(raw, (0, 0), mask)

    img.paste(screenshot_layer, (frame_x + padding, frame_y + padding))

    # Voice branding at bottom
    font_b = get_font(28)
    draw = ImageDraw.Draw(img)
    draw_text_centered(draw, "Voice", w//2, h - 50, font_b, accent)

    return img


# ── Main ──
def main():
    os.makedirs(RAW_DIR, exist_ok=True)

    found = 0
    missing = []
    for data in SCREENSHOT_DATA:
        raw_path = os.path.join(RAW_DIR, f"raw-{data['id']}.png")
        if os.path.exists(raw_path):
            found += 1
        else:
            missing.append(f"raw-{data['id']}.png")

    if found == 0:
        print("No raw screenshots found.")
        print(f"\nPlace your screenshots in:\n  {RAW_DIR}/\n")
        print("Expected files:")
        print("  raw-1.png  →  AAC Board (with words in sentence bar)")
        print("  raw-2.png  →  Sentence Builder (with AI suggestions visible)")
        print("  raw-3.png  →  Settings screen")
        print("  raw-4.png  →  Emotion screen (with an emotion selected)")
        print("\nCapture via ADB:")
        print("  adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png raw-1.png")
        sys.exit(1)

    if missing:
        print(f"Found {found}/4 screenshots. Missing: {', '.join(missing)}")
        print("Compositing available screenshots...\n")

    for data in SCREENSHOT_DATA:
        raw_path = os.path.join(RAW_DIR, f"raw-{data['id']}.png")
        if not os.path.exists(raw_path):
            print(f"  ⊘ Skipping screenshot {data['id']} (raw-{data['id']}.png not found)")
            continue

        result = composite_screenshot(data, raw_path)
        out_path = os.path.join(SCREENSHOTS, f"final-{data['id']}.png")
        result.save(out_path, "PNG")
        print(f"  ✓ final-{data['id']}.png  ({data['headline']})")

    print(f"\nDone. {found} screenshot(s) composited.")
    print(f"Output: {SCREENSHOTS}/final-*.png")
    if missing:
        print(f"\nStill needed: {', '.join(missing)}")


if __name__ == "__main__":
    main()
