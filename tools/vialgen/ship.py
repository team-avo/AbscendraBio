"""Publish the rendered vials into the served set as .webp."""
import os, sys
from PIL import Image

VIALS = ("/Users/abhinavverma/Documents/Development/AdvertOut/Projects/"
         "AscendraBio/nextjs-frontend/public/vial-mockups")

def ship(skus):
    for sku in skus:
        src = f"/tmp/vialout/{sku}.png"
        im = Image.open(src).convert("RGB")
        assert im.size == (1080, 1340), f"{sku}: size drift {im.size}"
        dst = f"{VIALS}/{sku}.webp"
        new = not os.path.exists(dst)
        im.save(dst, "WEBP", quality=90, method=6)
        print(f"  {'NEW ' if new else 'over'} {sku:24s} -> {os.path.getsize(dst):6d} bytes")

if __name__ == "__main__":
    ship(sys.argv[1:])
