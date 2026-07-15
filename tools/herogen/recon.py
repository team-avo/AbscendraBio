"""Reconcile Ascendra_Inventory.xlsx (53 SKUs) <-> /pricing (46 rows) <-> vial mockups (35)."""
import json, csv, re, os
import openpyxl

REPO = '/Users/abhinavverma/Documents/Development/AdvertOut/Projects/AscendraBio'

# sheet product name -> /pricing name
ALIAS = {
    'BPC + TB Blend': 'BPC-157 / TB-500 (Wolverine)',
    'CJC-1295 No DAC + Ipamorelin': 'CJC-1295 / Ipamorelin (No DAC)',
    'GLOW Blend': 'GHK / BPC-157 / TB-500 (GLOW)',
    'KLOW Blend': 'GHK / KPV / BPC-157 / TB-500 (KLOW)',
    'MT-1 (Melanotan 1)': 'Melanotan 1',
    'MT-2 (Melanotan 2)': 'Melanotan 2',
    'Thymosin Alpha-1': 'TA-1 (Thymosin Alpha-1)',
    'Ascendra 3-R': 'Retatrutide',
    'Ascendra 1-S': 'Semaglutide',
    'Ascendra 2-T': 'Tirzepatide',
    'Semax / Selank': 'Semax / Selank',
    'Tesamorelin / Ipamorelin': 'Tesamorelin / Ipamorelin',
}
# sheet (product, spec) -> mockup sku
MOCK = {
    ('Bacteriostatic Water','3ml'):'BW-3ML', ('Bacteriostatic Water','10ml'):'BW-10ML',
    ('BPC + TB Blend','10mg (5+5)'):'BPC157-TB500-5-5MG', ('BPC + TB Blend','20mg (10+10)'):'BPC157-TB500-10-10MG',
    ('BPC-157','10mg'):'BPC-157-10MG', ('CJC-1295 No DAC + Ipamorelin','10mg (5+5)'):'CJC-IPAMO-NODAC-5-5MG',
    ('Epithalon','10mg'):'EPI-10MG', ('GHK-Cu','50mg'):'GHK-CU-50MG', ('GHK-Cu','100mg'):'GHK-CU-100MG',
    ('GLOW Blend','70mg'):'GLOW-70MG', ('Glutathione','600mg'):'GLUTATHIONE-600MG',
    ('Glutathione','1500mg'):'GLUTATHIONE-1500MG', ('KLOW Blend','80mg'):'KLOW-80MG',
    ('KPV','10mg'):'KPV-10MG', ('MLT II','10mg'):'MLTII-10MG', ('NAD+','500mg'):'NAD-500MG',
    ('PT-141','10mg'):'PT141-10MG', ('Semax','10mg'):'SEMAX-10MG',
    ('Semax / Selank','20mg (10+10)'):'SEMAX-SELANK-10-10MG', ('TB-500','10mg'):'TB500-10MG',
    ('Tesamorelin','10mg'):'TESA-10MG', ('Tesamorelin / Ipamorelin','13mg (10+3)'):'TESA-IPAMO-10-3MG',
    ('Thymosin Alpha-1','10mg'):'THYMOSIN-A1-10MG',
    # GLP renders exist but carry the SUPPLIER name (ION-3R/ION-2T), not the sheet's brand
    ('Ascendra 3-R','10mg'):'ION3R-10MG*', ('Ascendra 3-R','20mg'):'ION3R-20MG*',
    ('Ascendra 3-R','50mg'):'ION3R-50MG*', ('Ascendra 3-R','60mg'):'ION3R-60MG*',
    ('Ascendra 2-T','10mg'):'ION2T-10MG*', ('Ascendra 2-T','40mg'):'ION2T-40MG*',
    ('Ascendra 2-T','60mg'):'ION2T-60MG*',
    # dose contradiction: sheet 10mg, render says 5mg
    ('AOD-9604','10mg'):'AOD-9604-5MG?',
    # ambiguous: manifest strength 'Standard Vial' vs sheet 30ml
    ('Bac Water (Hospira)','30ml'):'BW-H-BRAND?',
}

def norm_strength(spec):
    """'20mg (10+10)' -> '10/10 mg';  '10mg' -> '10 mg';  '3ml' -> '3 ml'"""
    s = str(spec).strip()
    m = re.search(r'\((\d+)\+(\d+)\)', s)
    if m:
        return f"{m.group(1)}/{m.group(2)} mg"
    m = re.match(r'^([\d.]+)\s*(mg|ml)$', s, re.I)
    if m:
        return f"{m.group(1)} {m.group(2).lower()}"
    return s

def load_sheet():
    wb = openpyxl.load_workbook(f'{REPO}/Ascendra_Inventory.xlsx', data_only=True)
    ws = wb['Combined Inventory']
    out = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        p, spec = row[0], row[1]
        if not p or str(p).startswith('TOTAL') or spec is None:
            continue
        if not isinstance(row[5], (int, float)):   # summary/notes rows
            continue
        out.append({'product': str(p).strip(), 'spec': str(spec).strip(),
                    'stock': int(row[5] or 0), 'spent': float(row[6] or 0)})
    return out

def main():
    sheet = load_sheet()
    price = json.load(open(f'{REPO}/nodejs-api/prisma/seed-data/wholesale-pricing.json'))
    pidx = {(r['name'], r['strength']): r for r in price}
    used = set()
    rows = []
    for s in sheet:
        pname = ALIAS.get(s['product'], s['product'])
        pstr  = norm_strength(s['spec'])
        pr = pidx.get((pname, pstr))
        if pr: used.add((pname, pstr))
        mk = MOCK.get((s['product'], s['spec']))
        rows.append({
            'sheet_product': s['product'], 'sheet_spec': s['spec'], 'stock': s['stock'],
            'pricing_name': pname, 'pricing_strength': pstr,
            'priced': 'YES' if pr else 'NO',
            'reg': f"{pr['reg']:.2f}" if pr else '',
            'category': pr['category'] if pr else '',
            'vial_image': (mk or '').rstrip('*?') if mk else '',
            'image_status': ('REBRAND (supplier name)' if mk and mk.endswith('*')
                             else 'CHECK (dose/spec mismatch)' if mk and mk.endswith('?')
                             else 'OK' if mk else 'MISSING'),
        })
    orphans = [f"{k[0]} | {k[1]}" for k in pidx if k not in used]

    with open('reconciliation.csv','w',newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

    npriced = sum(r['priced']=='YES' for r in rows)
    img_ok  = sum(r['image_status']=='OK' for r in rows)
    img_rb  = sum(r['image_status'].startswith('REBRAND') for r in rows)
    img_ck  = sum(r['image_status'].startswith('CHECK') for r in rows)
    img_ms  = sum(r['image_status']=='MISSING' for r in rows)
    print(f"SHEET SKUs                : {len(rows)}   (stock {sum(r['stock'] for r in rows):,} vials)")
    print(f"  matched to /pricing     : {npriced}")
    print(f"  NOT priced (unsellable) : {len(rows)-npriced}")
    print(f"/pricing rows             : {len(price)}   unmatched(orphan): {len(orphans)}")
    print(f"VIAL IMAGERY  ok={img_ok}  rebrand={img_rb}  check={img_ck}  MISSING={img_ms}")
    print()
    print("--- IN STOCK BUT NOT SELLABLE (no price row) ---")
    for r in rows:
        if r['priced']=='NO':
            print(f"  {r['sheet_product']:<32} {r['sheet_spec']:<16} stock={r['stock']:>5}")
    print()
    print("--- /pricing rows with no sheet SKU ---")
    for o in orphans: print("  ", o)
    print()
    print("--- SKUs with NO vial image ---")
    for r in rows:
        if r['image_status']=='MISSING':
            print(f"  {r['sheet_product']:<32} {r['sheet_spec']:<16} stock={r['stock']:>5}")
    print("\nwrote reconciliation.csv")

main()
