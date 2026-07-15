"""Compose the Ascendra homepage hero from the real branded vial renders."""
from PIL import Image, ImageFilter, ImageDraw, ImageChops
import numpy as np
from extract import extract

S = 1600                      # square: the hero box is ~1:1 on desktop, centre-cropped on mobile
BASE_Y   = int(S * 0.815)     # where the vials stand
CENTRE_X = int(S * 0.575)     # cluster sits right-of-centre; the left 40% carries the headline

# Non-GLP cast only: these names are settled in both the sheet and /pricing, so there
# is no rebrand risk and no GLP-on-a-public-homepage question.
CAST = [
    ('GLUTATHIONE-1500MG', -2.00, 0.86, 2.8),
    ('GHK-CU-100MG',       -1.04, 0.93, 1.3),
    ('BPC-157-10MG',        0.00, 1.00, 0.0),   # flagship, front & centre
    ('NAD-500MG',           1.04, 0.93, 1.3),
    ('GLOW-70MG',           2.00, 0.86, 2.8),
]
VIAL_H, STEP = 1000, 238

def background():
    y, x = np.mgrid[0:S, 0:S]
    xn, yn = x / S, y / S
    # near-white at the left so it melts into the page's #F9FBFF, cool studio grey right
    t = np.clip((xn - 0.02) / 0.70, 0, 1) ** 0.9
    r = 250 - 24 * t - 7 * yn
    g = 252 - 22 * t - 7 * yn
    b = 255 - 17 * t - 5 * yn
    d = np.sqrt(((x - CENTRE_X) / (S * 0.54)) ** 2 + ((y - S * 0.50) / (S * 0.48)) ** 2)
    glow = np.clip(1 - d, 0, 1) ** 2
    r += glow * 6; g += glow * 8; b += glow * 12
    floor = np.clip((y - BASE_Y) / (S * 0.22), 0, 1) ** 1.3
    r -= floor * 13; g -= floor * 11; b -= floor * 8
    im = np.clip(np.dstack([r, g, b]), 0, 255).astype(np.uint8)
    return Image.fromarray(im, 'RGB').filter(ImageFilter.GaussianBlur(2))

def main():
    canvas  = background().convert('RGBA')
    shadows = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    refl    = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    front   = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    for sku, slot, scale, blur in sorted(CAST, key=lambda c: -abs(c[1])):   # outer vials behind
        v = extract(sku, grad_t=10)
        h = int(VIAL_H * scale)
        w = int(v.width * h / v.height)
        v = v.resize((w, h), Image.LANCZOS)
        if blur:
            v = v.filter(ImageFilter.GaussianBlur(blur))     # depth of field
        cx = int(CENTRE_X + slot * STEP)
        x, y = cx - w // 2, BASE_Y - h

        sh = Image.new('L', (S, S), 0)
        ImageDraw.Draw(sh).ellipse(
            [cx - int(w * 0.60), BASE_Y - int(h * 0.028), cx + int(w * 0.60), BASE_Y + int(h * 0.050)],
            fill=int(104 * scale))
        sh = sh.filter(ImageFilter.GaussianBlur(24))
        shadows = ImageChops.lighter(shadows, Image.merge('RGBA', (
            Image.new('L', (S, S), 24), Image.new('L', (S, S), 40), Image.new('L', (S, S), 66), sh)))

        m = v.transpose(Image.FLIP_TOP_BOTTOM)
        fade = Image.linear_gradient('L').resize((w, h)).transpose(Image.FLIP_TOP_BOTTOM)
        m.putalpha(ImageChops.multiply(m.getchannel('A'),
                   fade.point(lambda p: int((p / 255) ** 2.6 * 255 * 0.26))))
        m = m.filter(ImageFilter.GaussianBlur(9))
        refl.alpha_composite(m, (x, BASE_Y))
        front.alpha_composite(v, (x, y))

    canvas.alpha_composite(shadows)
    canvas.alpha_composite(refl)
    canvas.alpha_composite(front)
    canvas.convert('RGB').save('hero-vials-new.png', optimize=True)
    print('wrote hero-vials-new.png', canvas.size)

main()
