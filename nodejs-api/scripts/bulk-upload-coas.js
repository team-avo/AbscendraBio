#!/usr/bin/env node
/**
 * Bulk-upload COAs (Third-Party Reports) and link them to products / variants.
 *
 * Mirrors exactly what the admin UI does, using the three existing endpoints:
 *   1. POST /third-party-reports/upload   (multipart, field "file")  -> { url }
 *   2. POST /third-party-reports          ({ category, name, url })  -> { id }
 *   3. POST /third-party-reports/:id/links ({ productIds, variantIds })
 *
 * Product/variant resolution (SKU -> variantId, product name -> productId) is
 * done against the DB via Prisma, so the mapping can use human-friendly SKUs.
 *
 * USAGE
 *   node scripts/bulk-upload-coas.js --map coas.csv --dir ./coa-files \
 *     --email admin@example.com --password 'SecurePass123!'
 *
 *   Flags:
 *     --map <file>       CSV or JSON manifest (required)
 *     --dir <dir>        base dir for relative file paths in the map (default: cwd)
 *     --api <url>        API base (default: http://localhost:5001/api or $API_BASE_URL)
 *     --email/--password admin login, OR --token <jwt>
 *     --dry-run          validate + resolve everything, upload nothing
 *
 * MAPPING COLUMNS (CSV header row) / JSON keys:
 *     file        (required) path to the COA file (PDF/JPEG/PNG, <=25MB)
 *     category    one category: PURITY | HEAVY_METALS | ENDOTOXICITY | STERILITY
 *     categories  OR several, ';'-separated, to list the SAME pdf under each tab
 *                 (e.g. "PURITY;HEAVY_METALS;ENDOTOXICITY;STERILITY"). One of
 *                 `category` or `categories` is required.
 *     sku         link to this variant's SKU            (variant-level COA)
 *     product     link to this product name             (product-level COA)
 *     name        report display name (default: filename without extension)
 *     description optional
 *   At least one of `sku` or `product` is required per row.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

// ---- args ------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { args[key] = next; i++; }
      else args[key] = true;
    }
  }
  return args;
}
const args = parseArgs(process.argv);
const API = (args.api || process.env.API_BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '');
const BASE_DIR = args.dir ? path.resolve(String(args.dir)) : process.cwd();
const DRY_RUN = !!args['dry-run'];
const VALID_CATEGORIES = ['PURITY', 'HEAVY_METALS', 'ENDOTOXICITY', 'STERILITY'];
const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

// ---- tiny CSV parser (quote-aware) -----------------------------------------
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1)
    .filter(r => r.some(v => String(v).trim() !== ''))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function loadMapping(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (file.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : (data.rows || []);
  }
  return parseCSV(raw);
}

// ---- auth ------------------------------------------------------------------
async function getToken() {
  if (args.token) return String(args.token);
  const email = args.email, password = args.password;
  if (!email || !password) throw new Error('Provide --token OR --email and --password');
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  const token = json?.data?.token || json?.token;
  if (!res.ok || !token) throw new Error(`Login failed (${res.status}): ${json?.error || 'no token'}`);
  return token;
}

// ---- resolution ------------------------------------------------------------
async function resolveTargets(rowIdx, row) {
  const variantIds = [], productIds = [], labels = [];
  if (row.sku) {
    const v = await prisma.productVariant.findFirst({
      where: { sku: row.sku },
      select: { id: true, sku: true, product: { select: { name: true } } },
    });
    if (!v) throw new Error(`SKU not found: "${row.sku}"`);
    variantIds.push(v.id);
    labels.push(`variant ${v.sku} (${v.product?.name})`);
  }
  if (row.product) {
    const p = await prisma.product.findFirst({
      where: { name: { equals: row.product, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (!p) throw new Error(`Product not found: "${row.product}"`);
    productIds.push(p.id);
    labels.push(`product ${p.name}`);
  }
  if (!variantIds.length && !productIds.length) {
    throw new Error('Row must have at least one of `sku` or `product`');
  }
  return { variantIds, productIds, labels };
}

// ---- upload / create / link ------------------------------------------------
async function uploadFile(token, filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext];
  if (!type) throw new Error(`Unsupported file type "${ext}" (allowed: PDF, JPG, PNG)`);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type }), path.basename(filePath));
  const res = await fetch(`${API}/third-party-reports/upload`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.url) throw new Error(`Upload failed (${res.status}): ${json?.error || 'no url'}`);
  return json.data.url;
}

async function createReport(token, { category, name, description, url }) {
  const res = await fetch(`${API}/third-party-reports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, name, description: description || null, url }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.id) throw new Error(`Create failed (${res.status}): ${json?.error || 'no id'}`);
  return json.data.id;
}

async function linkReport(token, id, productIds, variantIds) {
  const res = await fetch(`${API}/third-party-reports/${id}/links`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ productIds, variantIds }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Link failed (${res.status}): ${json?.error || 'unknown'}`);
}

// ---- main ------------------------------------------------------------------
(async () => {
  if (!args.map) { console.error('ERROR: --map <csv|json> is required'); process.exit(1); }
  const mapPath = path.resolve(String(args.map));
  const rows = loadMapping(mapPath);
  console.log(`\nCOA bulk upload  |  API=${API}  |  base dir=${BASE_DIR}  |  ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Loaded ${rows.length} row(s) from ${mapPath}\n`);

  const results = [];
  let token = null;

  // Validate + resolve every row FIRST so a bad mapping fails before any upload.
  const prepared = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2; // header + 1-index
    try {
      const rawCats = String(r.categories || r.category || '').trim();
      const categories = rawCats.split(';').map(c => c.trim().toUpperCase()).filter(Boolean);
      if (!categories.length) throw new Error('missing `category`/`categories`');
      for (const c of categories) {
        if (!VALID_CATEGORIES.includes(c)) {
          throw new Error(`category must be one of ${VALID_CATEGORIES.join(', ')} (got "${c}")`);
        }
      }
      if (!r.file) throw new Error('missing `file`');
      const filePath = path.isAbsolute(r.file) ? r.file : path.join(BASE_DIR, r.file);
      if (!fs.existsSync(filePath)) throw new Error(`file not found: ${filePath}`);
      const targets = await resolveTargets(i, r);
      const name = (r.name && String(r.name).trim()) || path.basename(filePath, path.extname(filePath));
      prepared.push({ line, filePath, categories, name, description: r.description, targets });
      console.log(`  ✓ row ${line}: "${name}" [${categories.join(', ')}] -> ${targets.labels.join(', ')}`);
    } catch (e) {
      results.push({ line, ok: false, stage: 'validate', error: e.message });
      console.log(`  ✗ row ${line}: ${e.message}`);
    }
  }

  if (results.some(r => !r.ok)) {
    console.log(`\n${results.filter(r => !r.ok).length} row(s) failed validation — fix the mapping and re-run. Nothing was uploaded.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  if (DRY_RUN) {
    console.log(`\nDRY RUN ok: ${prepared.length} row(s) valid and resolvable. Re-run without --dry-run to upload.`);
    await prisma.$disconnect();
    return;
  }

  token = await getToken();
  console.log('\nAuthenticated. Uploading...\n');

  for (const p of prepared) {
    try {
      // Upload the file ONCE, then list it under each requested category (option b).
      const url = await uploadFile(token, p.filePath);
      const ids = [];
      for (const category of p.categories) {
        const id = await createReport(token, { category, name: p.name, description: p.description, url });
        await linkReport(token, id, p.targets.productIds, p.targets.variantIds);
        ids.push(id);
      }
      results.push({ line: p.line, ok: true, ids, name: p.name });
      console.log(`  ✓ row ${p.line}: "${p.name}" -> ${p.categories.length} tab(s): ${p.categories.join(', ')}`);
    } catch (e) {
      results.push({ line: p.line, ok: false, stage: 'upload', error: e.message });
      console.log(`  ✗ row ${p.line}: ${e.message}`);
    }
  }

  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  const reportCount = results.filter(r => r.ok).reduce((n, r) => n + (r.ids?.length || 0), 0);
  console.log(`\nDone. ${ok} file(s) uploaded as ${reportCount} report(s), ${fail} failed.`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error('\nFATAL:', e.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
