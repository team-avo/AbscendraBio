/**
 * End-to-end backend test for the Lot Management module over HTTP, using a
 * minted admin JWT. Creates a throwaway lot + COA + template, exercises the full
 * lifecycle, then cleans everything up.
 *
 *   node scripts/lot-management-test.js
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");

const BASE = "http://localhost:5001/api";
const ADMIN_ID = "cmnyxg90t0000xmstv8i2gbhk";
const token = jwt.sign({ userId: ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: "1h" });
const H = { "content-type": "application/json", authorization: `Bearer ${token}` };

const results = [];
const ok = (n, d) => { results.push(true); console.log(`  ✅ ${n}${d ? "  — " + d : ""}`); };
const bad = (n, d) => { results.push(false); console.log(`  ❌ ${n}  — ${d}`); };

const get = async (p) => (await fetch(`${BASE}${p}`, { headers: H })).json();
const post = async (p, body) => (await fetch(`${BASE}${p}`, { method: "POST", headers: H, body: JSON.stringify(body) })).json();
const patch = async (p, body) => (await fetch(`${BASE}${p}`, { method: "PATCH", headers: H, body: JSON.stringify(body) })).json();

async function main() {
  console.log("\n=== Lot Management E2E (backend) ===\n");
  let lotId, coaId, coaNumber, templateId;
  try {
    // Registries
    const companies = (await get("/lot-management/companies")).data;
    const asb = companies.find((c) => c.code === "ASB");
    const peptides = (await get("/lot-management/peptides?activeOnly=true")).data;
    const bpc = peptides.find((p) => p.code === "BPC157");
    const strength = bpc.strengths[0];
    const supplier = (await get("/lot-management/suppliers")).data[0];
    const labs = (await get("/lot-management/labs")).data;
    const kov = labs.find((l) => l.code === "KOV");
    const services = (await get("/lot-management/services")).data.slice(0, 2);
    ok("1. Registries load", `${companies.length} companies, ${peptides.length} peptides, ${labs.length} labs`);

    // Preview
    const prev = await post("/lot-management/lots/preview", { peptideId: bpc.id, peptideStrengthId: strength.id, mfgDate: "2026-04-12", supplierId: supplier.id, orderDate: "2026-04-15" });
    ok("2. Lot number preview", `${prev.data.lotNumber} | ${prev.data.procurementOrderId} | exp ${String(prev.data.expirationDate).slice(0, 10)}`);

    // Create lot
    const lotRes = await post("/lot-management/lots", { companyId: asb.id, supplierId: supplier.id, peptideId: bpc.id, peptideStrengthId: strength.id, quantity: 50, mfgDate: "2026-04-12", orderDate: "2026-04-15", receivedDate: "2026-04-22" });
    if (!lotRes.success) throw new Error("lot create: " + lotRes.error);
    lotId = lotRes.data.id;
    ok("3. Create lot", `${lotRes.data.lotNumber} status=${lotRes.data.status} bud=${lotRes.data.bud}`);

    // Create COA from lot
    const coaRes = await post("/lot-management/coas", { lotId, labId: kov.id, dateSubmitted: "2026-05-20", testIds: services.map((s) => s.id) });
    if (!coaRes.success) throw new Error("coa create: " + coaRes.error);
    coaId = coaRes.data.id;
    coaNumber = coaRes.data.coaNumber;
    ok("4. Create COA (auto filename)", `#${coaNumber} ${coaRes.data.filename}`);

    // Log results
    const resRes = await patch(`/lot-management/coas/${coaId}/results`, { testDate: "2026-05-25", dateReceived: "2026-05-26", hplcPurity: 99.2, msConfirmed: true, overallResult: "PASS", reviewedBy: "QA", status: "PENDING_REVIEW" });
    ok("5. Log results", `HPLC ${resRes.data.hplcPurity}% result=${resRes.data.overallResult} status=${resRes.data.status}`);

    // Approve (QR generation; may skip QR if S3 not configured in dev)
    const appr = await post(`/lot-management/coas/${coaId}/approve`, {});
    if (appr.data.status !== "APPROVED") throw new Error("approve status=" + appr.data.status);
    ok("6. Approve COA", `status=APPROVED qr=${appr.data.qrCodeUrl ? "generated" : "skipped (S3 not set in dev)"}`);

    // Public trace
    const trace = await (await fetch(`${BASE}/public/coa/${coaNumber}`)).json();
    if (!trace.success) throw new Error("public trace: " + trace.error);
    ok("7. Public COA trace (no auth)", `${trace.data.peptide} ${trace.data.strength} lot=${trace.data.lotNumber} result=${trace.data.overallResult}`);

    // Label template + render PDF
    const tpl = await post("/lot-management/label-templates", { companyId: asb.id, peptideId: bpc.id, name: "Test label", artworkUrl: "", zones: { lotNumber: { x: 10, y: 10, size: 9, bold: true }, mfgDate: { x: 10, y: 24, size: 7 }, expDate: { x: 10, y: 34, size: 7 } }, widthMm: 50, heightMm: 25 });
    templateId = tpl.data.id;
    const labelRes = await fetch(`${BASE}/lot-management/coas/${coaId}/label`, { headers: H });
    const ctype = labelRes.headers.get("content-type") || "";
    const buf = Buffer.from(await labelRes.arrayBuffer());
    const isPdf = ctype.includes("pdf") && buf.slice(0, 5).toString() === "%PDF-";
    isPdf ? ok("8. Render label PDF", `${buf.length} bytes, valid %PDF`) : bad("8. Render label PDF", `ctype=${ctype} head=${buf.slice(0, 8).toString()}`);

    // Dashboard
    const dash = (await get("/lot-management/dashboard")).data;
    ok("9. Dashboard KPIs", `lots total=${dash.lots.total} inTesting=${dash.lots.inTesting} | coas total=${dash.coa.total} byLab=${dash.byLab.length}`);
  } catch (e) {
    bad("FLOW", e.message);
  } finally {
    // cleanup
    if (coaId) { await prisma.coaShare.deleteMany({ where: { coaId } }).catch(() => {}); await prisma.coa.delete({ where: { id: coaId } }).catch(() => {}); }
    if (lotId) await prisma.lot.delete({ where: { id: lotId } }).catch(() => {});
    if (templateId) await prisma.labelTemplate.delete({ where: { id: templateId } }).catch(() => {});
    console.log("  🧹 cleaned up test lot/coa/template");
    await prisma.$disconnect();
  }
  const passed = results.filter(Boolean).length;
  console.log(`\n=== Summary: ${passed}/${results.length} passed ===\n`);
  process.exit(passed === results.length ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
