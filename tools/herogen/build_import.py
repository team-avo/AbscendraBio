"""Build the Ascendra product import from Khush's rules (2026-07-15 call):
   - Combined Inventory tab = the final product list (names AS-IS from the sheet)
   - column 1 = Product, column 2 = Specification = VARIANT (nested under one product)
   - Total Vials in Stock = stock
   - price = the wholesale-pricing 'list' (reg) column; m2/m5/m10 = min-qty tiers
   - images = vial studio
   Anything in Combined Inventory with no price row -> that alone gets asked to Peter.
"""
import json, csv, re
from collections import OrderedDict
import openpyxl

REPO = '/Users/abhinavverma/Documents/Development/AdvertOut/Projects/AscendraBio'

ALIAS = {  # sheet product name -> wholesale-pricing name
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
    'MLT II': 'Melanotan 2',          # same molecule, second supplier name
    'B12': 'B12',
}
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
    ('Thymosin Alpha-1','10mg'):'THYMOSIN-A1-10MG', ('AOD-9604','10mg'):'AOD-9604-5MG',
    ('Bac Water (Hospira)','30ml'):'BW-H-BRAND',
    ('Ascendra 3-R','10mg'):'ION3R-10MG', ('Ascendra 3-R','20mg'):'ION3R-20MG',
    ('Ascendra 3-R','50mg'):'ION3R-50MG', ('Ascendra 3-R','60mg'):'ION3R-60MG',
    ('Ascendra 2-T','10mg'):'ION2T-10MG', ('Ascendra 2-T','40mg'):'ION2T-40MG',
    ('Ascendra 2-T','60mg'):'ION2T-60MG',
}
GLP = {'Ascendra 3-R', 'Ascendra 2-T', 'Ascendra 1-S'}

def norm_strength(spec):
    s = str(spec).strip()
    m = re.search(r'\((\d+)\+(\d+)\)', s)
    if m: return f"{m.group(1)}/{m.group(2)} mg"
    m = re.match(r'^([\d.]+)\s*(mg|ml)$', s, re.I)
    if m: return f"{m.group(1)} {m.group(2).lower()}"
    return s

def slug(s):
    return re.sub(r'[^A-Z0-9]+', '-', s.upper()).strip('-')

wb = openpyxl.load_workbook(f'{REPO}/Ascendra_Inventory.xlsx', data_only=True)
ws = wb['Combined Inventory']
sheet = []
for row in ws.iter_rows(min_row=4, values_only=True):
    p, spec = row[0], row[1]
    if not p or str(p).startswith('TOTAL') or spec is None: continue
    if not isinstance(row[5], (int, float)): continue
    sheet.append({'product': str(p).strip(), 'spec': str(spec).strip(), 'stock': int(row[5] or 0)})

price = json.load(open(f'{REPO}/nodejs-api/prisma/seed-data/wholesale-pricing.json'))
pidx = {(r['name'], r['strength']): r for r in price}

products = OrderedDict()
unpriced = []
for s in sheet:
    pname = ALIAS.get(s['product'], s['product'])
    pstr  = norm_strength(s['spec'])
    pr = pidx.get((pname, pstr))
    if not pr:
        # single-variant product whose spec label differs (e.g. B12: sheet says
        # 'mg/ml 10ml vial', pricing says '10 mg') -- unambiguous, so match on name.
        cands = [r for (n, _), r in pidx.items() if n == pname]
        same_name_in_sheet = [x for x in sheet if ALIAS.get(x['product'], x['product']) == pname]
        if len(cands) == 1 and len(same_name_in_sheet) == 1:
            pr = cands[0]
    if not pr:
        unpriced.append(s)
    mk = MOCK.get((s['product'], s['spec']))
    products.setdefault(s['product'], []).append({
        'variant': s['spec'], 'stock': s['stock'],
        'sku': f"{slug(s['product'])}-{slug(s['spec'])}",
        'reg': pr['reg'] if pr else None,
        'm2': pr['m2'] if pr else None, 'm5': pr['m5'] if pr else None, 'm10': pr['m10'] if pr else None,
        'category': pr['category'] if pr else ('GLP-1 Receptor Agonists' if s['product'] in GLP else 'Research Peptides'),
        'image': mk,
    })

rows = []
for pname, vs in products.items():
    for v in vs:
        rows.append({
            'Product Name': pname, 'Product Category': v['category'],
            'Variant SKU': v['sku'], 'Variant Name': v['variant'],
            'Regular Price': '' if v['reg'] is None else f"{v['reg']:.2f}",
            'B2C Regular Price': '' if v['reg'] is None else f"{v['reg']:.2f}",
            'Stock': v['stock'],
            'MinQty2 Price': '' if v['m2'] is None else f"{v['m2']:.2f}",
            'MinQty5 Price': '' if v['m5'] is None else f"{v['m5']:.2f}",
            'MinQty10 Price': '' if v['m10'] is None else f"{v['m10']:.2f}",
            'Image Name': (v['image'] + '.webp') if v['image'] else '',
            'Needs Price': 'YES' if v['reg'] is None else '',
        })

with open('ascendra_products_import.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

print(f"PRODUCTS : {len(products)}")
print(f"VARIANTS : {len(rows)}   (sheet SKUs: {len(sheet)})")
print(f"PRICED   : {sum(1 for r in rows if r['Regular Price'])}")
print(f"NO PRICE : {len(unpriced)}")
print(f"IMAGES   : {sum(1 for r in rows if r['Image Name'])} linked / {len(rows)}")
print()
print("=== MULTI-VARIANT PRODUCTS (nested under one product, per Khush) ===")
for p, vs in products.items():
    if len(vs) > 1:
        print(f"  {p:32s} -> {', '.join(v['variant'] for v in vs)}")
print()
print("=== ⚠️  NO PRICE IN WHOLESALE PRICING  -> ASK PETER (this is the only open item) ===")
for u in unpriced:
    print(f"  {u['product']:30s} {u['spec']:18s} stock={u['stock']:>5}")
print("\nwrote ascendra_products_import.csv")
