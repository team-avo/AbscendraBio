"""Re-render the 7 inherited ION vials on the chemistry-free template.

Two defects, both visible on the live site:

1. They still carry FORMULA / CAS / MW captions with EMPTY values -- ION-3R and
   ION-2T were proprietary names with no public chemistry, so the columns were
   never filled. A label printing "FORMULA" with nothing after it reads as a
   data-loading failure, not a design choice. Kartik flagged exactly this.
2. Their LOT codes still read ION3R-240501 / ION2T-240501. Peter has since
   specified ASC3R / ASC2T / ASC1S.

Rebuilding them on the same no-column template as the other 18 makes the whole
set consistent AND drops the empty captions. See [[vial-chemistry-data-is-dirty]]
for why no vial prints chemistry right now.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import render
from ship import ship

JOBS = [
    ("ION3R-10MG", "Ascendra 3-R", "10 mg/vial", "ASC3R"),
    ("ION3R-20MG", "Ascendra 3-R", "20 mg/vial", "ASC3R"),
    ("ION3R-50MG", "Ascendra 3-R", "50 mg/vial", "ASC3R"),
    ("ION3R-60MG", "Ascendra 3-R", "60 mg/vial", "ASC3R"),
    ("ION2T-10MG", "Ascendra 2-T", "10 mg/vial", "ASC2T"),
    ("ION2T-40MG", "Ascendra 2-T", "40 mg/vial", "ASC2T"),
    ("ION2T-60MG", "Ascendra 2-T", "60 mg/vial", "ASC2T"),
]

if __name__ == "__main__":
    os.makedirs("/tmp/vialout", exist_ok=True)
    done = []
    for sku, name, strength, lot in JOBS:
        render(sku, name, strength, lot, f"/tmp/vialout/{sku}.png")
        done.append(sku)
        print(f"  ok   {sku:14s} {name:14s} {strength:12s} LOT {lot}-240501")
    print()
    ship(done)
