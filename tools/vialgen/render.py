"""Render the missing vials on the chemistry-free label template.

WHY NO CHEMISTRY. The obvious build -- copy a donor that has a FORMULA/CAS/MW
column and overwrite its values from lot-management.json -- is not safe:

  * AOD-9604-5MG's LIVE label prints "C11H17N5O4S" (~283 Da) directly above its
    own "MW 1815.08 Da". The label contradicts itself, so the shipped render is
    already wrong for a peptide we sell.
  * KPV-10MG's render and its record disagree on formula AND CAS AND MW. Each is
    internally self-consistent, so they describe different molecules; one source
    is simply wrong.
  * Existing labels carry 2-decimal MWs (1419.55); records are 1-decimal
    (~1419.5). SEMAX renders 813.92 where its record says 813.93 -- a flat
    contradiction, not rounding.

So lot-management.json cannot be trusted to print onto a research-chemical
label, and a wrong CAS is a real-world problem rather than a cosmetic one.
ION3R-50MG / ION3R-60MG use a template with NO chemistry column, already
shipped and accepted. Building on it states nothing we cannot stand behind, and
it also unblocks 5-amino-1MQ and B12, which have no record at all.

Fix the chemistry source, then a later pass can add the column back.

UNIFORM TYPE. Sizes are constants, not per-donor measurements. The 7 ION renders
relabelled earlier drifted (names 277-300px where the text differs by ~5px),
which shows when a product's options sit side by side. Every name here is drawn
at one size, every strength at one size.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage

VIALS = ("/Users/abhinavverma/Documents/Development/AdvertOut/Projects/"
         "AscendraBio/nextjs-frontend/public/vial-mockups")
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
DONOR = "ION3R-50MG"          # no divider, no chemistry column

NAME_SIZE = 54
STRENGTH_SIZE = 46


def _fit_h(text, font_path, target_h, max_w, lo=12, hi=60):
    """Largest size whose glyph box matches target_h and still fits max_w."""
    best, bestd = lo, 1e9
    for sz in range(lo, hi):
        f = ImageFont.truetype(font_path, sz)
        b = f.getbbox(text)
        if (b[2] - b[0]) > max_w:
            break
        d = abs((b[3] - b[1]) - target_h)
        if d < bestd:
            best, bestd = sz, d
    return best
PANEL_RIGHT = 800             # label edge on this template; names may not cross it


def _blueness(a):
    return a[:, :, 2].astype(int) - a[:, :, 0].astype(int)


def _find(a, y0, y1, x0, x1, lo, hi, dark_max=170, min_h=30, max_h=60):
    """Largest glyph blob in a band, selected by ink blueness.

    Name ink is markedly bluer (B-R ~105-110) than the strength line (~41-64);
    a single "navy" mask merges the two and then picks whichever fragment wins.
    Selecting on blueness separates them cleanly.
    """
    b = _blueness(a)
    lum = a.mean(axis=2)
    m = (b >= lo) & (b <= hi) & (lum < dark_max)
    band = np.zeros_like(m)
    band[y0:y1, x0:x1] = True
    m = ndimage.binary_dilation(m & band, np.ones((5, 17)))
    lab, n = ndimage.label(m)
    if not n:
        return None
    # UNION every qualifying blob, never just the largest. A name breaks into
    # several blobs at word gaps wider than the dilation ("Ascendra" / "3-R"),
    # so taking the biggest erases one fragment and leaves the rest ghosting --
    # this is what produced "Ascendra 1-S-R" and "5010 mg/vial".
    ys0, ys1, xs0, xs1 = [], [], [], []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        h = sl[0].stop - sl[0].start
        if h > max_h or h < min_h:
            continue                       # the PURITY box border, a rule, speckle
        if (lab[sl] == (i + 1)).sum() < 120:
            continue
        ys0.append(sl[0].start); ys1.append(sl[0].stop)
        xs0.append(sl[1].start); xs1.append(sl[1].stop)
    if not ys0:
        return None
    return (min(ys0), max(ys1), min(xs0), max(xs1))


def _ink(a, box):
    y0, y1, x0, x1 = box
    c = a[y0:y1, x0:x1].reshape(-1, 3)
    lum = c.mean(axis=1)
    core = c[lum <= np.percentile(lum, 12)]     # darkest core, excludes fringe
    return tuple(int(v) for v in np.median(core, axis=0))


def _erase(a, box, pad=16):
    """Rebuild a box by blending the clean rows above and below.

    The panel has a soft vertical shading gradient; a flat fill leaves a
    visible rectangle.
    """
    y0, y1, x0, x1 = box
    above = np.median(a[max(y0 - pad, 0):y0, x0:x1].astype(float), axis=0)
    below = np.median(a[y1:y1 + pad, x0:x1].astype(float), axis=0)
    h = y1 - y0
    for i in range(h):
        t = i / max(h - 1, 1)
        a[y0 + i, x0:x1] = (above * (1 - t) + below * t).astype(np.uint8)


def _draw(a, box, text, size, font_path, ink, max_x=None, softness=0.6):
    """Draw text on the original baseline, softened to match photographed print.

    `box` must be the UNPADDED glyph box. The erase box is padded to swallow the
    original's antialiased fringe, but drawing against that padded box puts the
    baseline off by the pad -- which is what dropped the footer 3px low.
    """
    f = ImageFont.truetype(font_path, size)
    bb = f.getbbox(text)
    limit = max_x if max_x is not None else PANEL_RIGHT
    if box[2] + (bb[2] - bb[0]) > limit:
        raise ValueError(f"{text!r} at size {size} overflows "
                         f"({box[2] + bb[2] - bb[0]} > {limit})")
    # bottom-align on the original baseline: cap height differs between texts
    # (all-caps vs lowercase), so aligning tops shifts the baseline visibly.
    y = box[1] - (bb[3] - bb[1])
    layer = Image.new("L", (a.shape[1], a.shape[0]), 0)
    ImageDraw.Draw(layer).text((box[2] - bb[0], y - bb[1]), text, fill=255, font=f)
    layer = layer.filter(ImageFilter.GaussianBlur(softness))
    al = (np.asarray(layer).astype(float) / 255.0)[:, :, None]
    ink_arr = np.array(ink, dtype=float)[None, None, :]
    return (a.astype(float) * (1 - al) + ink_arr * al).astype(np.uint8)


def find_lot(a):
    """The LOT line is white-on-navy inside the footer bar.

    It needs its own path: the blueness masks select the navy BACKGROUND, and
    interpolating rows above/below straddles the bar's edge and smears it.
    """
    # Find the bar itself first. A fixed y-window spills onto the white label
    # above it, and every one of those rows is "white" -- the text mask then
    # returns the whole strip instead of the glyphs.
    dark_navy = (a[:, :, 2] > a[:, :, 0] + 30) & (a.mean(axis=2) < 110)
    rows = np.where(dark_navy[:, 300:780].sum(axis=1) > 300)[0]
    if len(rows) == 0:
        return None
    bar0, bar1 = int(rows.min()), int(rows.max())
    inner0, inner1 = bar0 + 6, bar1 - 6          # stay off the bar's edges

    foot = a[inner0:inner1, 300:780]
    m = (foot[:, :, 0] > 150) & (foot[:, :, 1] > 150) & (foot[:, :, 2] > 150)
    m = ndimage.binary_dilation(m, np.ones((3, 11)))
    lab, n = ndimage.label(m)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if (lab[sl] == (i + 1)).sum() < 250:
            continue
        h = sl[0].stop - sl[0].start
        if h > 40:
            continue                             # not a line of text
        boxes.append((inner0 + sl[0].start, inner0 + sl[0].stop,
                      300 + sl[1].start, 300 + sl[1].stop))
    if not boxes:
        return None
    boxes.sort(key=lambda b: b[2])
    return boxes[0], (boxes[1] if len(boxes) > 1 else None)   # LOT, MFG


def render(target, name, strength, lot_code, out):
    a = np.asarray(Image.open(f"{VIALS}/{DONOR}.webp").convert("RGB")).astype(np.uint8).copy()

    nb = _find(a, 695, 800, 340, PANEL_RIGHT, lo=85, hi=200)
    sb = _find(a, 805, 895, 340, PANEL_RIGHT, lo=25, hi=84)
    lb, mfg = find_lot(a)
    if nb is None or sb is None or lb is None:
        raise SystemExit(f"{target}: detection failed name={nb} strength={sb} lot={lb}")

    n_ink, s_ink = _ink(a, nb), _ink(a, sb)

    pad = lambda b: (b[0] - 3, b[1] + 3, b[2] - 3, b[3] + 3)
    _erase(a, pad(nb)); a = _draw(a, nb, name, NAME_SIZE, BOLD, n_ink)
    _erase(a, pad(sb)); a = _draw(a, sb, strength, STRENGTH_SIZE, BOLD, s_ink)

    # LOT: refill from the bar's own rows, then draw white glyphs. Must not run
    # past the MFG text, so cap the width at the original LOT box.
    _erase(a, pad(lb), pad=8)
    text = f"LOT: {lot_code}-240501"
    # Match the untouched MFG line beside it: same box height, and room to run
    # right up to (not into) it. Sizing by a constant made the footer ~30%
    # undersized against MFG on the same row.
    # A thin separator sits between LOT and MFG. Running to MFG's edge strikes
    # straight through it -- it spans ~33 of the 36 text rows where a glyph
    # stroke only reaches ~18, so it is separable by column height.
    stop = mfg[2] if mfg else lb[3]
    band = a[lb[0]:lb[1], lb[3]:stop]
    if band.shape[1] > 0:
        tall = np.where((band.mean(axis=2) > 130).sum(axis=0) >= (lb[1] - lb[0]) * 0.8)[0]
        if len(tall):
            stop = lb[3] + int(tall.min())
    room = (stop - 12) - lb[2]
    # Bound by the donor's own box: a short code (B12) otherwise fits a much
    # larger size than the label ever used and out-sizes the MFG line beside it.
    # The set's originals do vary (h=16..31), but never above their own row.
    size = min(_fit_h(text, REG, lb[1] - lb[0], room),
               _fit_h("LOT: XXXXXXXXXX-240501", REG, lb[1] - lb[0], room))
    a = _draw(a, lb, text, size, REG, (255, 255, 255), max_x=lb[2] + room)

    im = Image.fromarray(a)
    assert im.size == (1080, 1340), f"{target}: size drift {im.size}"
    im.save(out)
    return out
