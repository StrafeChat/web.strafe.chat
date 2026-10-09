#!/usr/bin/env python3
"""
Builds every icon from the turtle (strafe-turtle.png, transparent) on a background in the
app's own theme: the dark surface the client is drawn on, lit by the brand green.

    python3 branding/make-icons.py            # writes icon-1024.png + public/icons/*
    npx tauri icon branding/icon-1024.png -o src-tauri/icons   # then the desktop set

Needs Pillow. Colours mirror src/index.css: background hsl(220 12% 7%), card
hsl(220 10% 10%), primary hsl(142 32% 46%).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "branding" / "strafe-turtle.png"
OUT_MASTER = ROOT / "branding" / "icon-1024.png"
PUBLIC = ROOT / "public" / "icons"

S = 1024
BG_TOP = (29, 33, 40)       # a little above the card surface, so the top catches light
BG_BOTTOM = (14, 16, 21)    # the app background
GREEN = (80, 155, 107)      # --color-primary
AA = 4                      # supersampling for the rounded mask and strokes


def rounded_mask(size: int, radius: int, inset: int = 0) -> Image.Image:
    big = Image.new("L", (size * AA, size * AA), 0)
    d = ImageDraw.Draw(big)
    d.rounded_rectangle(
        (inset * AA, inset * AA, (size - inset) * AA - 1, (size - inset) * AA - 1),
        radius=radius * AA,
        fill=255,
    )
    return big.resize((size, size), Image.LANCZOS)


def vertical_gradient(size: int, top, bottom) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        c = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
        for x in range(size):
            px[x, y] = c
    return img


def radial_glow(size: int, center, radius: float, color, peak_alpha: float) -> Image.Image:
    """A soft disc of `color` fading to nothing, for the green light on the surface."""
    glow = Image.new("RGBA", (size, size), color + (0,))
    px = glow.load()
    cx, cy = center
    for y in range(size):
        for x in range(size):
            dx, dy = (x - cx) / radius, (y - cy) / radius
            d = (dx * dx + dy * dy) ** 0.5
            if d < 1:
                a = (1 - d) ** 2 * peak_alpha
                px[x, y] = color + (round(255 * a),)
    return glow


def background(size: int, inset: int, radius: int, ring: bool = True) -> Image.Image:
    base = vertical_gradient(size, BG_TOP, BG_BOTTOM)
    base.alpha_composite(radial_glow(size, (size * 0.32, size * 0.22), size * 0.95, GREEN, 0.42))
    base.alpha_composite(radial_glow(size, (size * 0.78, size * 0.9), size * 0.6, GREEN, 0.16))
    if ring:
        # The thin primary ring the app puts on active rows and glass panels.
        big = Image.new("RGBA", (size * AA, size * AA), (0, 0, 0, 0))
        d = ImageDraw.Draw(big)
        w = max(2, round(size * 0.012))
        d.rounded_rectangle(
            (inset * AA + w * AA // 2, inset * AA + w * AA // 2, (size - inset) * AA - 1 - w * AA // 2, (size - inset) * AA - 1 - w * AA // 2),
            radius=(radius - w // 2) * AA,
            outline=GREEN + (120,),
            width=w * AA,
        )
        base.alpha_composite(big.resize((size, size), Image.LANCZOS))
    if inset or radius:
        base.putalpha(rounded_mask(size, radius, inset))
    return base


def turtle(width: int) -> Image.Image:
    im = Image.open(SRC).convert("RGBA")
    im = im.crop(im.getbbox())
    scale = width / im.width
    out = im.resize((width, round(im.height * scale)), Image.LANCZOS)
    # The source is small (192 px); a touch of sharpening keeps the outline crisp after the
    # upscale without ringing on the flat fills.
    rgb = out.convert("RGB").filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
    rgb.putalpha(out.getchannel("A"))
    return rgb


def compose(size: int, inset: int, radius: int, turtle_frac: float, ring: bool = True) -> Image.Image:
    bg = background(size, inset, radius, ring)
    t = turtle(round(size * turtle_frac))
    x = (size - t.width) // 2
    y = (size - t.height) // 2 + round(size * 0.02)
    # A soft shadow under the turtle lifts it off the surface.
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 120), (x, y + round(size * 0.025)), t.getchannel("A"))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.02))
    bg.alpha_composite(shadow)
    bg.alpha_composite(t, (x, y))
    return bg


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    # Desktop master: rounded square with a transparent margin, as macOS expects; the
    # Tauri CLI derives the .icns/.ico and every PNG size from it.
    master = compose(S, inset=64, radius=210, turtle_frac=0.74)
    master.save(OUT_MASTER)
    # Web: favicon and PWA icons share the look.
    for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("favicon-32.png", 32)):
        compose(size, inset=round(size * 0.0625), radius=round(size * 0.205), turtle_frac=0.74).save(PUBLIC / name)
    # Maskable: full-bleed, the turtle inside the safe zone (inner 80%).
    compose(512, inset=0, radius=0, turtle_frac=0.58, ring=False).save(PUBLIC / "icon-maskable-512.png")
    # Apple touch icon: full-bleed, iOS rounds it.
    compose(180, inset=0, radius=0, turtle_frac=0.66, ring=False).save(PUBLIC / "apple-touch-icon.png")
    # The bare turtle, for the title bar.
    turtle(64).save(PUBLIC / "strafe-mark.png")
    print("wrote", OUT_MASTER.relative_to(ROOT), "and", PUBLIC.relative_to(ROOT))


if __name__ == "__main__":
    main()
