"""Builds Strafe's default avatars: the turtle mark in white on eight background colours.

The mark is lifted from desktop/branding/icon-1024.png: the turtle's body is far brighter than
the dark tile behind it and than its own outline, eyes and smile, so a soft brightness threshold
keeps the body as solid white and leaves the lines as cut-outs in the background colour.
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else '../desktop/branding/icon-1024.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/avatars/default'

# Index = (user_id >> 22) % 8. Order matters: it is part of the contract, never reorder.
COLORS = [
    ('green',  '#3F8A5A'),
    ('teal',   '#2A7C84'),
    ('blue',   '#2F6CAE'),
    ('violet', '#6A4FA3'),
    ('pink',   '#B0446F'),
    ('red',    '#B9443B'),
    ('orange', '#B8641A'),
    ('slate',  '#56626F'),
]

def mark_mask():
    src = Image.open(SRC).convert('RGB')
    box = (225, 300, 820, 720)  # the turtle, inside the tile's border
    crop = src.crop(box)
    lum = crop.convert('L')  # ITU-R 601 luma, close enough here
    lo, hi = 80, 104         # 0.31..0.41: below is tile/outline/eyes, above is body
    mask = lum.point(lambda v: 0 if v <= lo else 255 if v >= hi else int((v - lo) * 255 / (hi - lo)))
    mask = mask.filter(ImageFilter.MedianFilter(3))
    bbox = mask.getbbox()
    return mask.crop(bbox)

def render(mask, color, size):
    s = size * 4  # supersample, then downscale for clean edges
    bg = Image.new('RGBA', (s, s), color)
    w = int(s * 0.62)
    h = int(mask.height * w / mask.width)
    m = mask.resize((w, h), Image.LANCZOS)
    white = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    bg.paste(white, ((s - w) // 2, (s - h) // 2 + int(s * 0.02)), m)
    return bg.resize((size, size), Image.LANCZOS)

if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    mask = mark_mask()
    # mask.save(f'{OUT}/mark-mask.png')  # handy when tuning the threshold
    for i, (name, hexc) in enumerate(COLORS):
        # A 32-colour palette keeps every edge shade and cuts each file to about 5 KB.
        img = render(mask, hexc, 256).convert('RGB')
        img.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f'{OUT}/{i}.png', optimize=True)
    # preview sheet: squares and circles
    sheet = Image.new('RGB', (8 * 140 + 20, 300), '#101114')
    d = ImageDraw.Draw(sheet)
    for i, (name, hexc) in enumerate(COLORS):
        a = Image.open(f'{OUT}/{i}.png').resize((128, 128), Image.LANCZOS)
        sheet.paste(a, (20 + i * 140, 20))
        circ = Image.new('L', (128, 128), 0); ImageDraw.Draw(circ).ellipse((0, 0, 127, 127), fill=255)
        sheet.paste(a, (20 + i * 140, 160), circ)
    sheet.save('/tmp/strafe-default-avatars-preview.png')
    print('ok')
