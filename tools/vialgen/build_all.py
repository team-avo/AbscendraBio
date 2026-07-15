"""Render every vial that has no branded image, on the chemistry-free template."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import render

# target sku, label name, strength, lot code (follows the set's <PRODUCT>-240501 convention)
JOBS = [
    ("SELANK-10MG",           "Selank",       "10 mg/vial",   "SELANK"),
    ("DSIP-10MG",             "DSIP",         "10 mg/vial",   "DSIP"),
    ("MOTS-C-20MG",           "MOTS-c",       "20 mg/vial",   "MOTSC"),
    ("SS-31-50MG",            "SS-31",        "50 mg/vial",   "SS31"),
    ("ARA-290-10MG",          "Ara-290",      "10 mg/vial",   "ARA290"),
    ("MT-1-MELANOTAN-1-10MG", "MT-1",         "10 mg/vial",   "MT1"),
    ("5-AMINO-1MQ-10MG",      "5-amino-1MQ",  "10 mg/vial",   "5AMINO1MQ"),
    ("B12-MG-ML-10ML-VIAL",   "B12",          "10 ml vial",   "B12"),
    ("AOD-9604-10MG",         "AOD-9604",     "10 mg/vial",   "AOD9604"),
    ("NAD-1000MG",            "NAD+",         "1000 mg/vial", "NAD"),
    ("CAGRILINTIDE-10MG",     "Cagrilintide", "10 mg/vial",   "CAGRILINT"),
    ("ASCENDRA-1-S-5MG",      "Ascendra 1-S", "5 mg/vial",    "ASCENDRA1S"),
    ("ASCENDRA-1-S-10MG",     "Ascendra 1-S", "10 mg/vial",   "ASCENDRA1S"),
    ("ASCENDRA-1-S-20MG",     "Ascendra 1-S", "20 mg/vial",   "ASCENDRA1S"),
    ("ASCENDRA-1-S-30MG",     "Ascendra 1-S", "30 mg/vial",   "ASCENDRA1S"),
    ("ASCENDRA-2-T-5MG",      "Ascendra 2-T", "5 mg/vial",    "ASCENDRA2T"),
    ("ASCENDRA-2-T-20MG",     "Ascendra 2-T", "20 mg/vial",   "ASCENDRA2T"),
]

if __name__ == "__main__":
    os.makedirs("/tmp/vialout", exist_ok=True)
    ok, bad = [], []
    for sku, name, strength, lot in JOBS:
        try:
            render(sku, name, strength, lot, f"/tmp/vialout/{sku}.png")
            ok.append(sku)
            print(f"  ok   {sku:24s} {name:14s} {strength:14s} LOT {lot}-240501")
        except Exception as e:
            bad.append((sku, str(e)))
            print(f"  FAIL {sku:24s} {e}")
    print(f"\n{len(ok)} rendered, {len(bad)} failed")
