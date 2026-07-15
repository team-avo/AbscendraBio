"""Measure the label field geometry of every vial render, per SKU.

Why this exists
---------------
patch.py locates the product NAME per image but takes its strength/formula/cas/mw
boxes from fixed constants lifted off EPI-10MG. Those constants are wrong for the
rest of the set: the label artwork is composited onto the master bottle at a
slightly different offset per SKU (ION2T-40MG's strength sits at y~868, EPI's at
y~845), so a fixed box erases the wrong rows and the original text ghosts through.
This module measures every field in *each* image instead.

The name is a BLOCK, not a line
-------------------------------
Roughly half the SKUs break the product name over two lines ("Bacteriostatic /
Water (BW)", "PT-141 / (Bremelanotide)", "GHK-Cu / (Copper Peptide)"). Treating
the name as one line is not a small error -- it silently mislabels the name's
second line as the strength, because that line sits exactly where a strength line
would and its anti-aliased fringe passes the strength blueness test. The fix is to
group name lines into a block by vertical proximity: the leading inside a name is
~12-15px, while the name-to-strength gap is ~35-90px, so a 22px merge threshold
separates them cleanly, and the strength is only ever searched below the whole
block.

The colour model, and where it breaks
-------------------------------------
The label separates into ink families by BLUENESS = B - R. On EPI-10MG / NAD-500MG:

    product NAME .................. bright navy, ink ~(4,49,114),  blueness ~106
    FORMULA/CAS/MW captions ....... same navy family as the name
    STRENGTH line ................. near-black,  ink ~(9,29,69),   blueness ~59
    FORMULA/CAS/MW *values* ....... neutral grey ink ~(86,86,86),  blueness ~0
    rotated "Not for human..." ..... neutral grey, same as the values

Within one image the name is reliably bluer than the strength, and that is the key
insight. But the ABSOLUTE values do not survive the set, so a fixed cut
(name >= 85, strength 30..80) silently drops fields on a quarter of the SKUs:

    EPI-10MG    name blueness 106   strength 59    <- the SKUs the cut was fitted on
    PT141-10MG  name blueness  79                  <- name falls under the 85 floor
    TESA-10MG                       strength 22    <- falls under the 30 floor
    MLTII-10MG                      strength 26    <- ditto, and ink is pale (105,113,131)
    AOD-9604    name blueness  ~100 strength  0    <- strength is pure black (5,5,5)
    SEMAX-10MG                      strength  0    <- ditto

AOD-9604-5MG and SEMAX-10MG are the proof that no fixed strength window can work:
their strength ink is pure neutral black, blueness 0, which is also the blueness of
the grey VALUE ink. Nothing about the colour alone tells those two apart.

So blueness is used the way it is actually reliable -- RELATIVELY, per image, as a
CHECK -- and the field split is driven by layout instead (see below). Every record
carries the measured `_blueness` of its name and strength; the run asserts
name > strength + 12 on all 35 rather than assuming any absolute level.

The layout invariant that does hold
-----------------------------------
Between the logo lockup and the PURITY box, the right panel holds exactly two
things: the product name (1 or 2 lines) and the strength (always exactly 1 line,
always last). So: detect text lines by darkness alone, and the bottom-most line is
the strength, everything above it is the name. This never depends on an ink level.

It also sidesteps a trap the merge-threshold approach walks straight into:
THYMOSIN-A1-10MG's name sits only 19px above its strength -- tighter than the
~12-15px leading *inside* a two-line name -- so no vertical-gap threshold can split
name from strength in general. Taking the last line does.

The divider trap
----------------
33 of 35 SKUs put FORMULA/CAS/MW in a left column behind a vertical divider. The
divider is blue and ~500px tall, and it lives inside any x-window wide enough to
also catch the no-divider template's name. Worse, its blueness (~34-54) falls
squarely in the STRENGTH band, so it is picked up by the strength mask and, once
dilated, swallows the strength line into a single 500px-tall component.

It is detected as the column with the longest CONTINUOUS blue run, not the most
blue pixels: a pixel COUNT false-positives on text strokes, which have many blue
pixels but no long vertical run. The divider is excised before any text search.

Its blue threshold has to be looser than the ink's (B>R+18, not B>R+25): the rule
is a thin, pale, anti-aliased line and the strict threshold shatters it into
fragments on the fainter SKUs -- BW-10ML's longest run collapses from 475 to 55,
which then misreads as the no-divider template. At B>R+18 the split is total:
all 33 divider SKUs run 411..535, ION3R-50/60 run 58/63.

labelRight
----------
Measured as the *label panel* right edge -- the bright label against the darker
background, at the name's own rows. It lands at x~794 on all 35 (the footer bar
independently agrees: 286..794 +/-1px everywhere). The panel is fixed; only the
printed artwork jitters inside it.

This is deliberately NOT the PURITY box's right edge, which is what patch.py's
NAME_MAX_X=771 actually is. That constant is wrong twice over: the PURITY box
right edge varies per SKU (measured 715..787, not 771), and it does not bound the
name at all -- KLOW-80MG's "KLOW Blend" runs to x~780 while its PURITY box stops
at x~715. The box is reported separately as `purityRight` for reference only.

Reads .webp, never .png: the .png masters are gitignored, stale, and carry the
pre-fix bottleneck neck on 8 SKUs.
"""
import glob
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

VIALS = ("/Users/abhinavverma/Documents/Development/AdvertOut/Projects/"
         "AscendraBio/nextjs-frontend/public/vial-mockups")

H, W = 1340, 1080

# Rows of the label panel that carry the fields: below the cap, above the footer
# bar (a solid navy band at y~1018..1119 that would dominate every blue mask).
PANEL_Y0, PANEL_Y1 = 480, 1015
# The logo lockup (A-mark + ASCENDRA + BIO) is navy and sits above the name; the
# name never starts above this row.
NAME_Y0 = 665
# Left of this the rotated "Not for human, veterinary or diagnostic use." runs up
# the label edge in the same neutral grey as the FORMULA/CAS/MW values.
COLUMN_X0 = 322
PANEL_X1_MAX = 815

# Any ink, regardless of hue. The label prints ~245-253 and its darkest shading
# only reaches ~217, so this separates glyphs from the panel without touching hue
# -- which is the point: AOD/SEMAX strengths are pure black, PT141's name is only
# blueness 79, and no hue window covers both those and EPI's navy.
INK_MAX = 185

# Blueness is a per-image CHECK, not a threshold: the name must out-blue the
# strength by at least this, in whatever absolute range that image happens to use.
MIN_BLUENESS_SPLIT = 12

# The grey FORMULA/CAS/MW values: neutral (channel-balanced), unlike every blue
# element in the left column (captions, rules, divider).
VALUE_NEUTRAL = 18

DIVIDER_MIN_RUN = int(0.15 * H)   # 201px of unbroken blue = a rule, not a glyph

# Lines of the name closer than this are one block. Only ever applied ABOVE the
# strength line, which is identified by layout first -- THYMOSIN-A1-10MG's 19px
# name-to-strength gap is tighter than some names' internal leading, so this
# threshold cannot be trusted to find the strength.
LINE_MERGE = 26

# Sanity envelope. A wrong box is worse than a reported failure: downstream this
# drives an erase, so a box that is off erases the wrong rows and the original
# text ghosts back through the patch.
#
# NAME_H/NAME_W/GAP are per-LINE, not per-block: a two-line name is ~95px tall by
# construction, and the brief's 35..55 envelope only ever described one line.
NAME_LINE_H = (26, 62)
NAME_LINE_W = (40, 340)
STRENGTH_H = (28, 55)
GAP = (18, 95)


def _longest_runs(mask):
    """Longest continuous True run down each column of a HxW bool mask."""
    best = np.zeros(mask.shape[1], dtype=int)
    cur = np.zeros(mask.shape[1], dtype=int)
    for y in range(mask.shape[0]):
        cur = np.where(mask[y], cur + 1, 0)
        best = np.maximum(best, cur)
    return best


def _components(mask, dilate, min_area):
    """Tight bboxes of mask components, after bridging gaps with `dilate`.

    The dilation only decides what merges; every bbox is measured back on the
    undilated mask so the returned box is the true ink extent.
    """
    d = ndimage.binary_dilation(mask, np.ones(dilate))
    lab, n = ndimage.label(d)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sl is None:
            continue
        sub = mask[sl] & (lab[sl] == i + 1)
        area = int(sub.sum())
        if area < min_area:
            continue
        rows = np.where(sub.any(axis=1))[0]
        cols = np.where(sub.any(axis=0))[0]
        out.append({
            "y0": int(sl[0].start + rows[0]), "y1": int(sl[0].start + rows[-1]),
            "x0": int(sl[1].start + cols[0]), "x1": int(sl[1].start + cols[-1]),
            "area": area,
        })
    return out


def _box(c):
    return [c["y0"], c["y1"], c["x0"], c["x1"]]


def _h(c):
    return c["y1"] - c["y0"] + 1


def _w(c):
    return c["x1"] - c["x0"] + 1


def _ink_blueness(R, G, B, bn, boxes):
    """Median blueness of the glyph CORES in `boxes`.

    Sampled from the darkest 12% of each box: an anti-aliased edge pixel is a blend
    of ink and the white label and reads far less blue than the ink itself, so
    averaging the whole glyph would wash the name/strength difference out.
    """
    vals = []
    for c in boxes:
        sub_r = R[c["y0"]:c["y1"] + 1, c["x0"]:c["x1"] + 1]
        sub_g = G[c["y0"]:c["y1"] + 1, c["x0"]:c["x1"] + 1]
        sub_b = B[c["y0"]:c["y1"] + 1, c["x0"]:c["x1"] + 1]
        lum = sub_r + sub_g + sub_b
        dk = (sub_r < 200) & (sub_g < 200)
        if dk.sum() < 20:
            continue
        core = dk & (lum <= np.percentile(lum[dk], 12))
        if core.sum() < 10:
            continue
        vals.append(float(np.median(sub_b[core] - sub_r[core])))
    if not vals:
        return None
    return int(round(sum(vals) / len(vals)))


def find_divider(R, G, B):
    """Column span of the vertical rule, or None on the no-divider template.

    Longest CONTINUOUS run, never pixel count: a bold glyph stacks up plenty of
    blue pixels in one column but never 200 of them unbroken.
    """
    blue = (B > R + 18) & (R < 205)
    runs = _longest_runs(blue[PANEL_Y0:PANEL_Y1])
    runs[:280] = 0
    runs[PANEL_X1_MAX:] = 0
    peak = int(runs.max())
    if peak < DIVIDER_MIN_RUN:
        return None
    xp = int(runs.argmax())
    thr = 0.55 * peak
    x0 = xp
    while x0 - 1 >= 0 and runs[x0 - 1] >= thr:
        x0 -= 1
    x1 = xp
    while x1 + 1 < W and runs[x1 + 1] >= thr:
        x1 += 1
    return {"x0": x0, "x1": x1, "run": peak}


def find_purity_word(R, G, B, bn, dark):
    """The word PURITY -- bright navy, and the anchor for the PURITY box."""
    m = dark & (bn >= NAME_BLUENESS)
    band = np.zeros_like(m)
    band[875:PANEL_Y1, 340:800] = True
    best = None
    for c in _components(m & band, (3, 14), 200):
        if 13 <= _h(c) <= 32 and 55 <= _w(c) <= 150:
            if best is None or c["area"] > best["area"]:
                best = c
    return best


def find_purity_right(R, pw):
    """Right border of the PURITY box (reference only -- it does NOT bound the name).

    The border is a faint, tilted, anti-aliased stroke: its darkest pixel only
    reaches R~164 on some SKUs, so a `min < 150` test misses it entirely. What is
    stable is that the border is the only thing in these rows that puts ~50+
    mildly-dark pixels in one column; a text glyph puts 6-30 there.
    """
    if pw is None:
        return None
    b0 = max(pw["y0"] - 42, 868)
    b1 = min(pw["y1"] + 45, PANEL_Y1)
    best = None
    for x in range(pw["x1"] + 8, 796):
        if (R[b0:b1, x] < 215).sum() >= 45:
            best = x
    return best


def find_label_right(R, y0, y1):
    """Right edge of the white label panel over rows y0..y1.

    The label prints ~246-253; past its edge the background sits ~217-223. Walk
    in from the right and take the first sustained bright column.
    """
    y0 = max(y0, PANEL_Y0)
    y1 = min(y1, PANEL_Y1)
    row = R[y0:y1, :].mean(axis=0)
    for x in range(PANEL_X1_MAX, 700, -1):
        if row[x] >= 235 and row[x - 1] >= 235:
            return x
    return None


def probe(path):
    sku = os.path.basename(path)[:-5]
    a = np.asarray(Image.open(path).convert("RGB")).astype(int)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    bn = B - R
    dark = (R < 160) & (G < 160)

    rec = {"sku": sku}
    fails = []

    div = find_divider(R, G, B)
    rec["template"] = "no-divider" if div is None else "divider"
    rec["_divider"] = None if div is None else [div["x0"], div["x1"], div["run"]]

    pw = find_purity_word(R, G, B, bn, dark)
    rec["_purityWord"] = None if pw is None else _box(pw)
    rec["purityRight"] = find_purity_right(R, pw)

    # Text lives right of the divider (divider template) or from the left margin
    # in (no-divider). Excising the divider columns is what keeps it from
    # swallowing the strength line.
    x_lo = (div["x1"] + 6) if div else COLUMN_X0
    x_hi = PANEL_X1_MAX
    # The name never runs into the PURITY lockup below it.
    y_bot = (pw["y0"] - 8) if pw else PANEL_Y1

    def window(m):
        w = np.zeros_like(m)
        w[NAME_Y0:y_bot, x_lo:x_hi] = True
        return m & w

    # --- Text lines in the right panel, by darkness only (hue-independent) ---
    ink = window((R < INK_MAX) & (G < INK_MAX))
    lines = [c for c in _components(ink, (3, 45), 250)
             if NAME_LINE_H[0] <= _h(c) <= NAME_LINE_H[1] and _w(c) >= NAME_LINE_W[0]]
    lines.sort(key=lambda c: c["y0"])

    name = strength = None
    name_lines = []
    if len(lines) < 2:
        fails.append(f"{sku}: found {len(lines)} text line(s) in the panel, need >=2 "
                     f"(name + strength)")
    else:
        # Layout invariant: the strength is the last line before the PURITY box.
        strength = lines[-1]
        # Everything above it groups into blocks; the name is the block nearest the
        # strength (a stray logo remnant would sit further up as its own block).
        blocks = []
        for c in lines[:-1]:
            if blocks and c["y0"] - blocks[-1][-1]["y1"] <= LINE_MERGE:
                blocks[-1].append(c)
            else:
                blocks.append([c])
        name_lines = blocks[-1]
        name = {
            "y0": min(c["y0"] for c in name_lines), "y1": max(c["y1"] for c in name_lines),
            "x0": min(c["x0"] for c in name_lines), "x1": max(c["x1"] for c in name_lines),
            "area": sum(c["area"] for c in name_lines),
        }
        rec["name"] = _box(name)
        rec["strength"] = _box(strength)
        rec["_nameLines"] = [_box(c) for c in name_lines]
        rec["_extraBlocks"] = len(blocks) - 1

        # Blueness, used as a relative check: whatever the absolute levels, the
        # name must out-blue the strength or the two have been swapped.
        nb = _ink_blueness(R, G, B, bn, name_lines)
        sb = _ink_blueness(R, G, B, bn, [strength])
        rec["_blueness"] = [nb, sb]
        if nb is None or sb is None:
            fails.append(f"{sku}: could not sample ink blueness")
        elif nb < sb + MIN_BLUENESS_SPLIT:
            fails.append(f"{sku}: name blueness {nb} not above strength {sb} "
                         f"by {MIN_BLUENESS_SPLIT} -- fields may be swapped")

    # --- VALUES: neutral grey, left column only, so only on the divider template ---
    if div is None:
        rec["formula"] = rec["cas"] = rec["mw"] = None
    else:
        neutral = ((R < 170) & (abs(R - G) < 18) & (abs(G - B) < 18))
        vw = np.zeros_like(neutral)
        vw[560:PANEL_Y1, COLUMN_X0:max(div["x0"] - 4, COLUMN_X0 + 1)] = True
        # Narrow dilation on purpose: the rotated grey side-text sits ~10px left
        # of the values, and a wide bridge would fuse the two. It stays a single
        # ~430px-tall component and is dropped by the height filter.
        vals = [c for c in _components(neutral & vw, (3, 12), 100)
                if 14 <= _h(c) <= 45 and _w(c) >= 28]
        vals.sort(key=lambda c: c["y0"])
        for key, c in zip(("formula", "cas", "mw"), vals):
            rec[key] = _box(c)
        for key in ("formula", "cas", "mw"):
            rec.setdefault(key, None)
        if vals and len(vals) != 3:
            fails.append(f"{sku}: expected 0 or 3 left-column values, found {len(vals)}")

    rec["labelRight"] = find_label_right(
        R, name["y0"] if name else 730, name["y1"] if name else 780)

    # ---------------- sanity envelope ----------------
    if name is not None:
        rec["_nLines"] = len(name_lines)
        if len(name_lines) > 2:
            fails.append(f"{sku}: name grouped into {len(name_lines)} lines (expected 1 or 2)")
        for i, c in enumerate(name_lines):
            if not (NAME_LINE_H[0] <= _h(c) <= NAME_LINE_H[1]):
                fails.append(f"{sku}: name line {i} height {_h(c)} outside {NAME_LINE_H}")
            if not (NAME_LINE_W[0] <= _w(c) <= NAME_LINE_W[1]):
                fails.append(f"{sku}: name line {i} width {_w(c)} outside {NAME_LINE_W}")
    if strength is not None:
        if not (STRENGTH_H[0] <= _h(strength) <= STRENGTH_H[1]):
            fails.append(f"{sku}: strength height {_h(strength)} outside {STRENGTH_H}")
    if name is not None and strength is not None:
        gap = strength["y0"] - name["y1"]
        rec["_gap"] = int(gap)
        if not (GAP[0] <= gap <= GAP[1]):
            fails.append(f"{sku}: name/strength gap {gap} outside {GAP}")
        if name["y1"] >= strength["y0"]:
            fails.append(f"{sku}: name does not sit above strength")
    if div is not None:
        for f in ("name", "strength"):
            b = rec.get(f)
            if b and b[2] <= div["x1"] and b[3] >= div["x0"]:
                fails.append(f"{sku}: {f} box overlaps the divider column "
                             f"x{div['x0']}..{div['x1']}")
    if rec["labelRight"] is None:
        fails.append(f"{sku}: could not find the label panel right edge")
    else:
        for f in ("name", "strength"):
            b = rec.get(f)
            if b and b[3] > rec["labelRight"]:
                fails.append(f"{sku}: {f} right edge {b[3]} passes labelRight "
                             f"{rec['labelRight']}")

    return rec, fails


def main():
    recs, fails = [], []
    for p in sorted(glob.glob(f"{VIALS}/*.webp")):
        r, f = probe(p)
        recs.append(r)
        fails.extend(f)

    hdr = (f"{'SKU':24s} {'tmpl':10s} {'name y0..y1 x0..x1':26s} {'L':>2s} {'h':>3s} {'w':>4s} "
           f"{'strength y0..y1 x0..x1':26s} {'gap':>4s} {'lblR':>5s} {'purR':>5s} vals")
    print(hdr)
    print("-" * len(hdr))
    for r in recs:
        n, s = r.get("name"), r.get("strength")
        ns = f"{n[0]}..{n[1]} {n[2]}..{n[3]}" if n else "-"
        ss = f"{s[0]}..{s[1]} {s[2]}..{s[3]}" if s else "-"
        nv = [k for k in ("formula", "cas", "mw") if r.get(k)]
        print(f"{r['sku']:24s} {r['template']:10s} {ns:26s} "
              f"{r.get('_nLines',0):2d} {(n[1]-n[0]+1) if n else 0:3d} {(n[3]-n[2]+1) if n else 0:4d} "
              f"{ss:26s} {r.get('_gap', 0):4d} {str(r.get('labelRight')):>5s} "
              f"{str(r.get('purityRight')):>5s} {','.join(nv) if nv else 'none'}")

    print(f"\n{len(fails)} sanity failure(s):")
    for f in fails:
        print("  -", f)

    out = "/private/tmp/claude-501/-Users-abhinavverma-Documents-Development-AdvertOut-Projects-AscendraBio/38b5ceb1-0aa9-4f0a-9375-a16d41e60c28/scratchpad/geom.json"
    with open(out, "w") as fh:
        json.dump({"records": recs, "failures": fails}, fh, indent=1)
    print("\nwrote", out)


if __name__ == "__main__":
    main()
