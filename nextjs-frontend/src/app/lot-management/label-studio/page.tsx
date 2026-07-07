"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jsPDF } from "jspdf";
import { PDFDocument, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { toast } from "sonner";

// The label maker pulls its data live from the Lot Management registry, which is
// the single source of truth. Picking a peptide autofills the name, strength
// options, chemical formula, CAS number and molecular weight. Picking a lot
// autofills the lot number and manufacturing date. Every field stays editable.
type Strength = { id?: string; label: string; code: string };
type Peptide = {
  id: string;
  name: string;
  code: string;
  casNumber?: string | null;
  chemicalFormula?: string | null;
  molecularMass?: string | null;
  strengths?: Strength[];
};
type Lot = {
  id: string;
  lotNumber: string;
  mfgDate?: string | null;
  peptideStrengthId?: string | null;
  strength?: Strength | null;
  coas?: { coaNumber: number; status?: string | null }[] | null;
};

// Strength labels in the registry read like "10 mg"; on a vial label they read
// "10 mg/vial". Non-mg values (ml, blends) pass through unchanged.
const toVialStrength = (s: string) => {
  const m = (s || "").match(/^(\d+(?:\.\d+)?)\s*mg\b(.*)$/i);
  return m ? `${m[1]} mg/vial${m[2] ? " " + m[2].trim() : ""}` : s;
};

// Manufacturing date comes back as an ISO string; show it as MM/DD/YYYY.
const fmtDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
};

// The label is the finished design PNG (identical to the vial labels) used as the
// canvas base; only the editable values are swapped in — the old values are erased
// and a transparent data overlay is composited on top. This reproduces the final
// design pixel for pixel (the whole-SVG render came out slightly different).
const BASE_SRC = "/Ascendra_BPC157_final_label.png";
const DATA_SVG_SRC = "/Ascendra_label_data.svg";
const W = 2048;
const H = 768;
// Regions of the base to clear before drawing new values: body (white), footer (navy).
const BODY_ERASE: [number, number, number, number][] = [
  [328, 188, 650, 236], [328, 356, 630, 402], [328, 524, 630, 570],
  [852, 276, 1700, 406], [852, 405, 1320, 484],
];
const FOOTER_ERASE: [number, number][] = [[742, 1132], [1212, 1474]];
const LABEL_W_IN = 2;
const LABEL_H_IN = 0.75;

const xmlEsc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A chemical formula ("C62H98N16O22") -> SVG with subscript element counts.
function formulaMarkup(f: string): string {
  if (!f) return "";
  let out = "";
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(f)) !== null) {
    if (!m[1]) continue;
    out += m[1] + (m[2] ? `<tspan baseline-shift="sub" font-size="24">${m[2]}</tspan>` : "");
  }
  return out;
}

// Shrink the product-name font for long names so it stays on one line.
function nameFontSize(name: string): number {
  const size = Math.min(126, Math.floor(1080 / (Math.max(1, name.length) * 0.68)));
  return Math.max(44, size);
}

// The logo, product name, strength and PURITY badge are all centered on the
// label. The logo is already centered in the source art (cx1200); the badge
// (which leans right) and the two text lines are re-centered here on CENTER,
// and the left side text is nudged inward so it is not clipped.
const CENTER = 1200;

// Editable name/strength fields, in source-image pixels. `box` is whited out,
// then the text is drawn centered on CENTER at `baseline`, auto-shrunk to fit
// `maxW`. Name caps span y354-475 (size ~168); strength "5 mg/vial" spans
// y520-594 (size ~80, baseline 578). The PURITY badge top sits at y620.
type FieldDef = { box: { x: number; y: number; w: number; h: number }; baseline: number; size: number; maxW: number };
const FIELDS: Record<"name" | "strength", FieldDef> = {
  name: { box: { x: 850, y: 322, w: 920, h: 150 }, baseline: 452, size: 150, maxW: 1500 },
  strength: { box: { x: 900, y: 492, w: 760, h: 78 }, baseline: 552, size: 70, maxW: 1100 },
};

// Left technical panel. The FORMULA / CAS / MW labels are part of the base art;
// only the values are drawn, left-aligned beneath each label.
const LEFTVAL = { x: 390, maxW: 390, size: 37, formulaY: 261, casY: 458, mwY: 655 };

// Footer (navy bar) LOT and MFG, drawn white and centered in each half.
const FOOT = { y: 843, size: 36, lotX: 1096, mfgX: 1568 };

// QR code (links to the COA page) sits in the empty upper-right white area.
// Only drawn when a COA number is present.
const QR = { x: 1900, y: 96, size: 352 };

type Vals = {
  name: string;
  strength: string;
  formula: string;
  cas: string;
  mw: string;
  lot: string;
  mfg: string;
  coa: string;
};
const DEFAULTS: Vals = { name: "BPC-157", strength: "5 mg/vial", formula: "", cas: "", mw: "", lot: "", mfg: "", coa: "" };

// Purity claim printed on the physical label (part of the base artwork there).
const PURITY_TEXT = "≥99% by HPLC";

function roundRectPath(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}

// The print label is a wide 2 x 0.75 in landscape; a vial's label area is a tall
// near-square band. Rather than distort the print art onto the vial, this renders
// the same registry data in a portrait layout that fills the band cleanly.
function buildVialLabelCanvas(vals: Vals, navy: string): HTMLCanvasElement {
  const PW = 1000, PH = 968;
  const c = document.createElement("canvas");
  c.width = PW; c.height = PH;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH);
  const L = 96, R = PW - 96;

  // Wordmark: letter-spaced ASCENDRA over BIO, with an underline rule.
  x.fillStyle = navy; x.textBaseline = "alphabetic";
  x.save(); x.translate(PW / 2, 118);
  const word = "ASCENDRA", ls = 10; x.font = "700 60px Arial";
  let tw = 0; for (const ch of word) tw += x.measureText(ch).width + ls; tw -= ls;
  let wx = -tw / 2; x.textAlign = "left";
  for (const ch of word) { x.fillText(ch, wx, 0); wx += x.measureText(ch).width + ls; }
  x.restore();
  x.textAlign = "center"; x.font = "600 26px Arial"; x.fillText("B I O", PW / 2, 158);
  x.strokeStyle = navy; x.lineWidth = 3;
  x.beginPath(); x.moveTo(L, 190); x.lineTo(R, 190); x.stroke();

  // Name + strength.
  x.textAlign = "left";
  x.font = "800 150px Arial"; x.fillStyle = navy; x.fillText(vals.name, L, 360);
  x.font = "600 92px Arial"; x.fillText(vals.strength, L, 470);

  // Technical values (only those present).
  x.font = "40px Arial"; let ty = 585;
  const line = (lab: string, v: string) => {
    if (!v) return;
    x.fillStyle = "#6b7c93"; x.fillText(lab, L, ty);
    const lw = x.measureText(lab).width;
    x.fillStyle = navy; x.fillText(v, L + lw + 14, ty);
    ty += 62;
  };
  line("CAS", vals.cas);
  line("FORMULA", vals.formula);
  line("MW", vals.mw);

  // Purity pill.
  const py = ty + 6, ph = 74, pw = 560;
  x.strokeStyle = navy; x.lineWidth = 3; roundRectPath(x, L, py, pw, ph, 10); x.stroke();
  x.font = "700 34px Arial"; x.fillStyle = navy; x.textBaseline = "middle";
  x.fillText("PURITY", L + 26, py + ph / 2);
  x.textAlign = "right"; x.fillText(PURITY_TEXT, L + pw - 26, py + ph / 2);
  x.textAlign = "left"; x.textBaseline = "alphabetic";

  // LOT / MFG side box (rotated), only when values are present.
  if (vals.lot || vals.mfg) {
    const bw = 74, bh = 300, bx = R - bw, by = 300;
    x.strokeStyle = navy; x.lineWidth = 3; x.strokeRect(bx, by, bw, bh);
    x.save(); x.translate(bx + bw / 2, by + bh / 2); x.rotate(-Math.PI / 2);
    x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = navy; x.font = "700 24px Arial";
    if (vals.lot) x.fillText(`LOT ${vals.lot}`, 0, vals.mfg ? -14 : 0);
    if (vals.mfg) x.fillText(`MFG ${vals.mfg}`, 0, vals.lot ? 14 : 0);
    x.restore(); x.textBaseline = "alphabetic";
  }

  // Left vertical caution text.
  x.save(); x.translate(52, PH - 150); x.rotate(-Math.PI / 2);
  x.textAlign = "left"; x.font = "24px Arial"; x.fillStyle = "#6b7c93";
  x.fillText("Not for human, veterinary or diagnostic use.", 0, 0);
  x.restore();

  // Navy footer bar.
  x.fillStyle = navy; x.fillRect(0, PH - 90, PW, 90);
  x.fillStyle = "#fff"; x.textAlign = "center"; x.font = "700 40px Arial";
  x.textBaseline = "middle"; x.fillText("FOR RESEARCH USE ONLY", PW / 2, PH - 45);
  x.textAlign = "left"; x.textBaseline = "alphabetic";
  return c;
}

export default function LabelStudioPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const templateRef = useRef<string>("");
  const imgRef = useRef<HTMLImageElement | null>(null);
  const qrImgRef = useRef<HTMLImageElement | null>(null);
  const navyRef = useRef<string>("rgb(22,54,107)");
  const [ready, setReady] = useState(false);
  const [vals, setVals] = useState<Vals>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Vals>(DEFAULTS);

  // Live registry data (single source of truth).
  const [peptides, setPeptides] = useState<Peptide[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selPeptideId, setSelPeptideId] = useState<string>("");
  const [selStrengthCode, setSelStrengthCode] = useState<string>("");
  const [selLotId, setSelLotId] = useState<string>("");
  const [loadingLots, setLoadingLots] = useState(false);
  const [qty, setQty] = useState(1);

  // Load the peptide registry once.
  useEffect(() => {
    (async () => {
      try {
        const r = await api.lmGetPeptides(true);
        if (r.success && Array.isArray(r.data)) setPeptides(r.data as Peptide[]);
      } catch {
        /* registry unavailable; the dialog still allows manual entry */
      }
    })();
  }, []);

  // Draw the finished-design base PNG, erase the old values, then composite a
  // transparent overlay of the current values on top — so the output is pixel
  // identical to the finished label with only the data swapped.
  const draw = useCallback((v: Vals) => {
    const canvas = canvasRef.current;
    const base = imgRef.current;
    const tmpl = templateRef.current;
    if (!canvas || !base || !tmpl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    ctx.fillStyle = "rgb(254,254,254)";
    for (const [x0, y0, x1, y1] of BODY_ERASE) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = "rgb(0,50,108)";
    for (const [x0, x1] of FOOTER_ERASE) ctx.fillRect(x0, 692, x1 - x0, 56);

    const svg = tmpl
      .replace("{{NAME}}", xmlEsc(v.name || ""))
      .replace("{{NAMESIZE}}", String(nameFontSize(v.name || "")))
      .replace("{{STRENGTH}}", xmlEsc(v.strength || ""))
      .replace("{{FORMULA}}", formulaMarkup((v.formula || "").trim()))
      .replace("{{CAS}}", xmlEsc((v.cas || "").trim()))
      .replace("{{MW}}", xmlEsc((v.mw || "").trim()))
      .replace("{{LOT}}", v.lot && v.lot.trim() ? `LOT: ${xmlEsc(v.lot.trim())}` : "")
      .replace("{{MFG}}", v.mfg && v.mfg.trim() ? `MFG: ${xmlEsc(v.mfg.trim())}` : "");

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const overlay = new window.Image();
    overlay.onload = () => {
      ctx.drawImage(overlay, 0, 0, W, H);
      URL.revokeObjectURL(url);
    };
    overlay.onerror = () => URL.revokeObjectURL(url);
    overlay.src = url;
  }, []);

  // Load the base design PNG and the data overlay template once.
  useEffect(() => {
    let cancelled = false;
    const base = new window.Image();
    base.onload = () => {
      imgRef.current = base;
      if (templateRef.current && !cancelled) setReady(true);
    };
    base.src = BASE_SRC;
    fetch(DATA_SVG_SRC)
      .then((r) => r.text())
      .then((t) => {
        if (cancelled) return;
        templateRef.current = t;
        if (imgRef.current) setReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) draw(vals);
  }, [ready, vals, draw]);

  // Generate the COA QR code whenever the COA number changes, then redraw.
  // The QR encodes the public COA page URL for that COA number.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const coa = (vals.coa || "").trim();
    if (!coa) { qrImgRef.current = null; draw(vals); return; }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/coa/${encodeURIComponent(coa)}`;
    QRCode.toDataURL(url, { margin: 1, width: 512 })
      .then((dataUrl) => {
        if (cancelled) return;
        const img = new window.Image();
        img.onload = () => { if (!cancelled) { qrImgRef.current = img; draw(vals); } };
        img.src = dataUrl;
      })
      .catch(() => { if (!cancelled) { qrImgRef.current = null; draw(vals); } });
    return () => { cancelled = true; };
  }, [ready, vals, draw]);

  const openEditor = () => {
    setDraft(vals);
    // Best-effort: re-sync the selects to the current peptide/strength so the
    // dropdowns reflect what is on the label when re-opening.
    const p = peptides.find((pp) => pp.name === vals.name);
    setSelPeptideId(p?.id || "");
    setSelStrengthCode("");
    setSelLotId("");
    setLots([]);
    if (p) void loadLots(p.id);
    setOpen(true);
  };
  const saveEditor = () => { setVals(draft); setOpen(false); toast.success("Label updated"); };

  const loadLots = async (peptideId: string) => {
    setLoadingLots(true);
    try {
      const r = await api.lmGetLots({ peptideId, limit: 100 });
      const rows = (r?.data?.data || r?.data || []) as Lot[];
      setLots(Array.isArray(rows) ? rows : []);
    } catch {
      setLots([]);
    } finally {
      setLoadingLots(false);
    }
  };

  // Picking a peptide autofills name + chemistry, offers its strengths, and
  // loads its lots. Existing manual edits to other fields are preserved.
  const onPeptide = (id: string) => {
    setSelPeptideId(id);
    setSelStrengthCode("");
    setSelLotId("");
    const p = peptides.find((pp) => pp.id === id);
    if (!p) return;
    const firstStrength = (p.strengths || [])[0];
    setDraft((d) => ({
      ...d,
      name: p.name,
      formula: p.chemicalFormula || "",
      cas: p.casNumber || "",
      mw: p.molecularMass || "",
      strength: firstStrength ? toVialStrength(firstStrength.label) : d.strength,
      lot: "",
      mfg: "",
      coa: "",
    }));
    if (firstStrength) setSelStrengthCode(firstStrength.code);
    void loadLots(id);
  };

  const onStrength = (code: string) => {
    setSelStrengthCode(code);
    const p = peptides.find((pp) => pp.id === selPeptideId);
    const st = (p?.strengths || []).find((s) => s.code === code);
    if (st) setDraft((d) => ({ ...d, strength: toVialStrength(st.label) }));
  };

  const onLot = (id: string) => {
    setSelLotId(id);
    if (id === "__none") { setDraft((d) => ({ ...d, lot: "", mfg: "", coa: "" })); return; }
    const lot = lots.find((l) => l.id === id);
    if (lot) {
      // Use the lot's COA number for the QR (prefer an approved one if present).
      const coas = lot.coas || [];
      const chosen = coas.find((c) => (c.status || "").toUpperCase() === "APPROVED") || coas[0];
      setDraft((d) => ({
        ...d,
        lot: lot.lotNumber,
        mfg: fmtDate(lot.mfgDate),
        coa: chosen?.coaNumber != null ? String(chosen.coaNumber) : "",
      }));
    }
  };

  const setField = (k: keyof Vals, value: string) => setDraft((d) => ({ ...d, [k]: value }));

  const slugFor = (name: string) => (name || "label").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");

  // ── Vial mockup: wrap the generated label onto a blank vial (public/vial-base.png) ──
  // Label region = the blank white label face on the 1024x1024 base image.
  const VIAL = { region: { x0: 313, y0: 430, x1: 697, y1: 802 }, arc: Math.PI * 1.12 };

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  // Composite a portrait vial label (rendered from the current registry values)
  // onto the vial base with a horizontal cylinder wrap (center face-on, edges
  // compressed and gently darkened) → a PNG blob.
  const buildVialMockup = useCallback(async (): Promise<Blob | null> => {
    const label = buildVialLabelCanvas(vals, navyRef.current);
    const base = await loadImage("/vial-base.png").catch(() => null);
    if (!base) return null;
    const out = document.createElement("canvas");
    out.width = base.width;
    out.height = base.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(base, 0, 0);

    const { x0, y0, x1, y1 } = VIAL.region;
    const rw = x1 - x0;
    const rh = y1 - y0;
    const half = VIAL.arc / 2;
    const sinHalf = Math.sin(half);
    // Preserve the label's aspect ratio: the art is a wide print label, the vial
    // area is near-square, so fit its full width across the region and center it
    // vertically (band) instead of stretching it tall.
    const drawnH = Math.min(rh, Math.round(rw / (label.width / label.height)));
    const yTop = y0 + Math.round((rh - drawnH) / 2);
    for (let i = 0; i < rw; i++) {
      const t = rw <= 1 ? 0.5 : i / (rw - 1);                 // 0..1 across the region
      const theta = (t - 0.5) * VIAL.arc;                     // -half..half
      const srcT = (Math.sin(theta) / sinHalf) * 0.5 + 0.5;   // cylinder projection
      const srcX = Math.max(0, Math.min(label.width - 1, srcT * (label.width - 1)));
      const ox = x0 + i;
      ctx.globalAlpha = 1;
      ctx.drawImage(label, srcX, 0, 1, label.height, ox, yTop, 1, drawnH); // 1px vertical slice
      // Gentle cylinder shading: keep the front face clean white and only darken
      // the outer edges as they curve away (subtle, so the label stays legible).
      const e = Math.abs(theta) / half;                       // 0 center .. 1 edge
      const a = e < 0.55 ? 0 : Math.pow((e - 0.55) / 0.45, 2) * 0.3;
      if (a > 0.001) {
        ctx.globalAlpha = a;
        ctx.fillStyle = "#0a1420";
        ctx.fillRect(ox, yTop, 1, drawnH);
      }
    }
    ctx.globalAlpha = 1;
    return await new Promise<Blob | null>((res) => out.toBlob((b) => res(b), "image/png"));
  }, [vals]);

  const downloadVialMockup = async () => {
    const blob = await buildVialMockup();
    if (!blob) { toast.error("Could not build the vial mockup"); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugFor(vals.name)}_vial.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Vial mockup downloaded");
  };

  // Fully automatic: on label generation, push the vial mockup onto the matching
  // product SKU (variant + product image). No-op if no peptide/strength is picked
  // from the registry or nothing matches.
  const publishToProduct = useCallback(async () => {
    if (!selPeptideId || !selStrengthCode) return;
    const pep = peptides.find((p) => p.id === selPeptideId);
    const strengthId = (pep?.strengths || []).find((s) => s.code === selStrengthCode)?.id;
    if (!strengthId) return;
    try {
      const blob = await buildVialMockup();
      if (!blob) return;
      const file = new File([blob], `${slugFor(vals.name)}_vial.png`, { type: "image/png" });
      const up = await api.uploadFile(file);
      if (!up.success || !up.data?.url) { toast.error("Vial image upload failed"); return; }
      const res = await api.lmApplyLabelImage({ peptideStrengthId: strengthId, imageUrl: up.data.url });
      if (res.success && res.data?.applied) toast.success(`Product image updated for SKU ${res.data.sku}`);
      else toast.message("Vial mockup made — no matching product to link yet");
    } catch {
      toast.error("Could not update the product image");
    }
  }, [selPeptideId, selStrengthCode, peptides, vals.name, buildVialMockup]);

  const downloadPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "in", format: [LABEL_W_IN, LABEL_H_IN], orientation: "landscape" });
    pdf.addImage(dataUrl, "PNG", 0, 0, LABEL_W_IN, LABEL_H_IN);
    const slug = slugFor(vals.name);
    pdf.save(`${slug || "label"}_label.pdf`);
    toast.success("PDF downloaded");
    void publishToProduct();
  };

  // Print ready sheet for the die-cut label printer: two labels per row, one row
  // per page (the gap sensor re-registers each row, preventing vertical drift).
  // Geometry, in inches: page 4.125 x 0.75; label 2.0 x 0.75; column gap 0.125;
  // left label at x=0, right at x=2.125. Fill left to right, top to bottom.
  const SHEET = { pageW: 4.125, pageH: 0.75, labelW: 2.0, labelH: 0.75, gap: 0.125 };
  const PT = 72; // 1 inch = 72 PDF points
  const downloadPrintSheet = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const n = Math.max(1, Math.min(1000, Math.floor(qty) || 1));
    try {
      // 1) Build the single source label PDF: 2 x 0.75 in, 1200-DPI canvas PNG.
      const dataUrl = canvas.toDataURL("image/png");
      const single = new jsPDF({ unit: "in", format: [LABEL_W_IN, LABEL_H_IN], orientation: "landscape" });
      single.addImage(dataUrl, "PNG", 0, 0, LABEL_W_IN, LABEL_H_IN);
      const singleBytes = single.output("arraybuffer");

      // 2) Assemble the sheet with pdf-lib: embed the source label page as a form
      //    XObject (vector/quality preserved, no re-rasterization) and stamp it
      //    two-up per page, one row per page so the die-cut gap sensor
      //    re-registers each row. Geometry in PDF points.
      const PAGE_W = SHEET.pageW * PT;            // 297
      const PAGE_H = SHEET.pageH * PT;            // 54
      const LW = SHEET.labelW * PT;               // 144
      const LH = SHEET.labelH * PT;               // 54
      const STEP = (SHEET.labelW + SHEET.gap) * PT; // 153
      const out = await PDFDocument.create();
      const [emb] = await out.embedPdf(singleBytes, [0]);
      let page: PDFPage | null = null;
      for (let i = 0; i < n; i++) {
        const col = i % 2; // 0 = left, 1 = right
        if (col === 0) page = out.addPage([PAGE_W, PAGE_H]);
        page!.drawPage(emb, { x: col * STEP, y: 0, width: LW, height: LH });
      }
      const bytes = await out.save();

      // 3) Download
      const slug = (vals.name || "label").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug || "label"}_sheet_${n}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Print sheet (${n} ${n === 1 ? "label" : "labels"}) downloaded`);
      void publishToProduct();
    } catch (err) {
      toast.error("Could not build the print sheet");
    }
  };

  const selPeptide = peptides.find((p) => p.id === selPeptideId);
  const strengthOptions = selPeptide?.strengths || [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click the label to edit it. Pick a peptide to autofill the name, strength, chemical formula, CAS number and molecular weight from the registry, and pick a lot to autofill the lot number and manufacturing date. Every field stays editable. Then download a print ready PDF at exactly 2 x 0.75 inches.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4 max-w-3xl">
        <button onClick={openEditor} className="block w-full group text-left" title="Click to edit">
          <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white" style={{ aspectRatio: `${W} / ${H}` }}>
            <canvas ref={canvasRef} width={W} height={H} className="w-full h-full block" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Loading label…</div>
            )}
            <div className="absolute inset-0 group-hover:bg-primary/5 transition-colors flex items-center justify-center pointer-events-none">
              <span className="opacity-0 group-hover:opacity-100 text-xs font-medium bg-black/70 text-white px-2 py-1 rounded">Click to edit</span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={openEditor}>Edit label</Button>
          <Button variant="outline" onClick={downloadPdf} disabled={!ready}>Download single PDF</Button>
          <Button variant="outline" onClick={downloadVialMockup} disabled={!ready}>Download vial mockup</Button>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Qty</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(1000, parseInt(e.target.value || "1", 10) || 1)))}
              className="w-20 h-9"
            />
            <Button onClick={downloadPrintSheet} disabled={!ready}>Download print sheet</Button>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">Sheet: 2 labels per row · 4.125 in × 0.75 in page</span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit label</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Peptide (from registry)</Label>
              <Select value={selPeptideId || undefined} onValueChange={onPeptide}>
                <SelectTrigger><SelectValue placeholder={peptides.length ? "Select a peptide…" : "No registry data"} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {peptides.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Autofills name, formula, CAS and MW. Manage these in Registries → Peptides.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Strength</Label>
                <Select value={selStrengthCode || undefined} onValueChange={onStrength} disabled={!strengthOptions.length}>
                  <SelectTrigger><SelectValue placeholder={strengthOptions.length ? "Select…" : "Pick peptide first"} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {strengthOptions.map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lot (optional)</Label>
                <Select value={selLotId || undefined} onValueChange={onLot} disabled={!selPeptideId || loadingLots}>
                  <SelectTrigger><SelectValue placeholder={loadingLots ? "Loading…" : lots.length ? "Select a lot…" : "No lots"} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__none">None</SelectItem>
                    {lots.map((l) => <SelectItem key={l.id} value={l.id}>{l.lotNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <p className="text-[11px] text-muted-foreground -mb-1">Fields on the label (editable):</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={draft.name} onChange={(e) => setField("name", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Strength</Label><Input value={draft.strength} onChange={(e) => setField("strength", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Chemical formula</Label><Input value={draft.formula} onChange={(e) => setField("formula", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">CAS #</Label><Input value={draft.cas} onChange={(e) => setField("cas", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Molecular weight</Label><Input value={draft.mw} onChange={(e) => setField("mw", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Lot #</Label><Input value={draft.lot} onChange={(e) => setField("lot", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Mfg date</Label><Input value={draft.mfg} onChange={(e) => setField("mfg", e.target.value)} placeholder="MM/DD/YYYY" /></div>
                <div className="space-y-1.5"><Label className="text-xs">COA # (QR)</Label><Input value={draft.coa} onChange={(e) => setField("coa", e.target.value)} placeholder="links to /coa/…" /></div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveEditor}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
