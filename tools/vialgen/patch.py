"""Patch label text on an existing vial render.

The original generator that produced the 35 renders is gone, so this rebuilds
only the part we need: overwrite the text fields on a finished bottle photo and
leave every other pixel alone. That is deliberate -- the logo, PURITY box,
captions, footer bar, glass and lighting all come straight from the source
image, so a patched vial cannot drift from the set the way a from-scratch
re-render would.

Reads .webp, never .png -- the .png masters are gitignored, stale, and carry the
pre-fix bottleneck necks on 8 SKUs. See tools/herogen/extract.py.

Field boxes were measured off EPI-10MG by colour-segmenting the label
(blue captions vs dark values vs white-on-blue footer) and hold for the whole
set, which shares one bottle photo and one label layout.

Text is drawn flat. The label wraps a cylinder, but across the right-hand panel
the tangential compression is small enough not to read -- verified by patching a
known name and comparing. Do not reuse these boxes for the far-left column
without re-checking: curvature grows toward the label edge.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

VIALS = ("/Users/abhinavverma/Documents/Development/AdvertOut/Projects/"
         "AscendraBio/nextjs-frontend/public/vial-mockups")
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

# (y0, y1, x0, x1) in the 1080x1340 render
BOX = {
    "name":     (728, 780, 475, 714),
    "strength": (845, 888, 476, 651),
    "formula":  (629, 657, 325, 437),
    "cas":      (764, 784, 325, 426),
    "mw":       (911, 934, 325, 412),
    "lot":      (1058, 1083, 368, 578),
}
NAME_MAX_X = 771          # right edge of the panel, from the PURITY box


def find_name_box(a):
    """Locate the product-name glyphs in *this* image rather than assuming EPI's.

    The boxes differ per SKU because the text differs: "Epithalon" is lowercase
    and sits at x-height, "ION-3R" is all-caps and reaches higher. Reusing one
    SKU's box leaves the taller original ghosting out from behind the patch.

    There are two label templates: most SKUs have a left column (FORMULA/CAS/MW)
    behind a vertical divider, but ION3R-50/60 have neither and sit their name
    further left. So the x window cannot be fixed -- it must be wide enough for
    the no-divider layout, which means it also catches the left column's blue
    captions on the divider layout.

    Disambiguate by ink, not position: the name is set large and bold, so it
    always has far more pixels than a "CAS" or "MW" caption in the same rows.
    """
    from scipy import ndimage
    R, G, B = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    blue = (B > R + 25) & (R < 150)
    band = np.zeros_like(blue)
    band[695:800, 340:800] = True          # below the logo, above the strength
    m = ndimage.binary_dilation(blue & band, np.ones((5, 15)))
    lab, n = ndimage.label(m)
    if not n:
        return None
    best, best_area = None, 0
    for i, sl in enumerate(ndimage.find_objects(lab)):
        area = (lab[sl] == (i + 1)).sum()
        if area > best_area:
            best, best_area = sl, area
    return (best[0].start, best[0].stop, best[1].start, best[1].stop)


def _ink(a, box):
    """Median colour of the existing glyphs, so patched text matches exactly."""
    y0, y1, x0, x1 = box
    c = a[y0:y1, x0:x1].astype(int)
    m = (c[:, :, 2] > c[:, :, 0] + 25) & (c[:, :, 0] < 150)
    if m.sum() < 30:
        m = (c[:, :, 0] < 130) & (c[:, :, 1] < 130)
    return tuple(int(v) for v in np.median(c[m], axis=0))


def _erase(a, box, pad=14):
    """Rebuild the box by blending the clean rows above and below it.

    The panel carries a soft vertical shading gradient, so a flat white fill
    leaves a visible rectangle; interpolating the neighbouring rows keeps it.
    """
    y0, y1, x0, x1 = box
    above = a[y0 - pad:y0, x0:x1].astype(float).mean(axis=0)
    below = a[y1:y1 + pad, x0:x1].astype(float).mean(axis=0)
    h = y1 - y0
    for i in range(h):
        t = i / max(h - 1, 1)
        a[y0 + i, x0:x1] = (above * (1 - t) + below * t).astype(np.uint8)


def _fit(text, font_path, target_h, max_w, lo=20, hi=80):
    """Largest size whose cap-height matches the original and still fits."""
    best = None
    for s in range(lo, hi):
        f = ImageFont.truetype(font_path, s)
        b = f.getbbox(text)
        w, h = b[2] - b[0], b[3] - b[1]
        if w > max_w:
            break
        if best is None or abs(h - target_h) < best[0]:
            best = (abs(h - target_h), s, w, h)
    return best[1] if best else lo


def patch(sku, name=None, strength=None, formula=None, cas=None, mw=None,
          lot=None, out=None):
    im = Image.open(f"{VIALS}/{sku}.webp").convert("RGB")
    a = np.asarray(im).astype(np.uint8).copy()

    boxes = dict(BOX)
    if name is not None:
        found = find_name_box(a)
        if found is None:
            raise SystemExit(f"{sku}: could not locate the product-name glyphs")
        # pad: erase must swallow the original's antialiased fringe, or it ghosts
        y0, y1, x0, x1 = found
        boxes["name"] = (y0 - 3, y1 + 3, x0 - 3, max(x1 + 3, x0 + 40))

    jobs = []
    if name is not None:
        jobs.append(("name", name, BOLD, NAME_MAX_X))
    if strength is not None:
        jobs.append(("strength", strength, BOLD, NAME_MAX_X))
    if formula is not None:
        jobs.append(("formula", formula, REG, BOX["formula"][3] + 110))
    if cas is not None:
        jobs.append(("cas", cas, REG, BOX["cas"][3] + 110))
    if mw is not None:
        jobs.append(("mw", mw, REG, BOX["mw"][3] + 110))

    for field, text, font_path, max_x in jobs:
        box = boxes[field]
        ink = _ink(a, box)
        _erase(a, box)
        y0, y1, x0, _ = box
        size = _fit(text, font_path, y1 - y0, max_x - x0)
        f = ImageFont.truetype(font_path, size)
        img = Image.fromarray(a)
        # getbbox offsets so the drawn glyphs land on the original baseline
        b = f.getbbox(text)
        ImageDraw.Draw(img).text((x0 - b[0], y0 - b[1]), text, fill=ink, font=f)
        a = np.asarray(img).astype(np.uint8).copy()

    Image.fromarray(a).save(out or f"/tmp/{sku}-patched.png")
    return out or f"/tmp/{sku}-patched.png"
