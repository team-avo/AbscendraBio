"""Simulate the real LandingPage hero: image in right 60%, object-cover object-right,
   under linear-gradient(to right,#F9FBFF 0%,#F9FBFF 38%,rgba(249,251,255,0) 70%)."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np

VW, VH = 1440, 830
hero = Image.open('hero-vials-new.png').convert('RGB')

def compose(src, out):
    page = Image.new('RGB', (VW, VH), (249, 251, 255))
    cw, ch = int(VW * 0.60), VH                      # lg:w-[60%] h-full
    s = max(cw / src.width, ch / src.height)         # object-cover
    im = src.resize((int(src.width * s), int(src.height * s)), Image.LANCZOS)
    left = im.width - cw                             # object-right
    top = (im.height - ch) // 2
    page.paste(im.crop((left, top, left + cw, top + ch)), (VW - cw, 0))

    # gradient overlay across the FULL width
    g = np.zeros((VH, VW, 4), np.uint8)
    x = np.arange(VW) / VW
    a = np.clip((0.70 - x) / (0.70 - 0.38), 0, 1) * 255
    g[:, :, 0], g[:, :, 1], g[:, :, 2] = 249, 251, 255
    g[:, :, 3] = a[None, :].astype(np.uint8)
    page = Image.alpha_composite(page.convert('RGBA'), Image.fromarray(g, 'RGBA')).convert('RGB')

    d = ImageDraw.Draw(page)
    try:
        big = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 76)
        sm  = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 20)
    except Exception:
        big = sm = ImageFont.load_default()
    d.text((96, 250), 'Advanced', font=big, fill=(4, 48, 97))
    d.text((96, 335), 'Peptides', font=big, fill=(90, 154, 218))
    d.text((96, 445), 'Research-grade purity, COA-verified, shipped in 24 hours.', font=sm, fill=(70, 95, 125))
    d.rectangle([96, 500, 300, 556], fill=(4, 48, 97))
    d.text((130, 518), 'Shop Peptides', font=sm, fill=(255, 255, 255))
    page.save(out)
    print('wrote', out)

compose(hero, 'preview_new.png')
compose(Image.open('/Users/abhinavverma/Documents/Development/AdvertOut/Projects/AscendraBio/nextjs-frontend/public/hero-vials.png').convert('RGB'), 'preview_old.png')
