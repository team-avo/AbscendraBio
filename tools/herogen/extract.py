"""Extract a vial silhouette (no backdrop, halo or cast shadow) from a render -> RGBA.

Source is the .webp, never the .png: the .png masters are gitignored, stale
(2026-07-10) and come from an earlier, differently-framed pass (wider framing,
lighter backdrop) that still carries the pre-fix "bottleneck" necks for the 8
rebuilt SKUs. The .webp is the tracked file that ships to prod.

Clear glass barely differs from the grey backdrop, so an absolute-difference mask
fragments at the neck, and the vial's reflected light haloes the backdrop, so a
loose mask over-grabs. The outline is a SHARP luminance transition while the halo
is a soft gradient -- so threshold the horizontal gradient to find true outline
edges, then fill each row between the outermost ones.
"""
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

VIALS = '/Users/abhinavverma/Documents/Development/AdvertOut/Projects/AscendraBio/nextjs-frontend/public/vial-mockups'
# measured on the .webp set (all 35 agree): vial spans x 221..795, axis x~509,
# cap top ~y45. The .png pass framed ~1.18x wider with the axis at x~540.
CX, HALF, TOP_CLIP = 509, 300, 30

def extract(sku, grad_t=5, feather=1.0):
    a = np.asarray(Image.open(f'{VIALS}/{sku}.webp').convert('RGB')).astype(np.float64)
    lum = ndimage.gaussian_filter(a.mean(axis=2), 1.0)
    h, w = lum.shape

    edges = np.abs(ndimage.sobel(lum, axis=1)) > grad_t
    win = np.zeros_like(edges); win[TOP_CLIP:, CX - HALF:CX + HALF] = True
    edges &= win
    edges = ndimage.binary_opening(edges, np.ones((5, 1)))   # outline is vertically continuous

    mask = np.zeros_like(edges)
    for y in range(h):
        xs = np.where(edges[y])[0]
        if len(xs) < 2:
            continue
        x0, x1 = xs.min(), xs.max()
        if x0 > CX or x1 < CX:          # must straddle the vial axis
            continue
        mask[y, x0:x1 + 1] = True

    mask = ndimage.binary_closing(mask, np.ones((11, 3)))
    lab, n = ndimage.label(mask)
    if n > 1:
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        mask = lab == (np.argmax(sizes) + 1)
    mask = ndimage.binary_fill_holes(mask)

    # drop the cast shadow: body width is steady, the shadow flares wide
    widths = mask.sum(axis=1)
    rows = np.where(widths > 0)[0]
    typical = np.median(widths[widths > 150])
    base = rows.max()
    for y in range(rows.min() + 40, rows.max() + 1):
        if widths[y] > typical * 1.5:
            base = y - 1
            break
    mask[base + 1:, :] = False
    mask = ndimage.binary_fill_holes(mask)
    mask = ndimage.binary_erosion(mask, np.ones((3, 3)))

    alpha = np.asarray(Image.fromarray((mask * 255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(feather)))
    rgba = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')
    ys, xs = np.where(mask)
    return rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

if __name__ == '__main__':
    for sku in ['BPC-157-10MG','GLOW-70MG','NAD-500MG','GHK-CU-100MG','SEMAX-10MG','KLOW-80MG','GLUTATHIONE-1500MG']:
        v = extract(sku)
        print(f'{sku:22s} cut={v.size}')
        p = Image.new('RGB', v.size, (255, 0, 255)); p.paste(v, (0, 0), v)
        p.save(f'debug_{sku}.png')
