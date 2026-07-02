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

// Base artwork is the finished label; the editable lines are white-blocked and
// redrawn so the canvas (and therefore the exported PDF) match exactly.
const IMG_SRC = "/Ascendra_label_BPC-157_highres.png";
const W = 2400;
const H = 900;
const LABEL_W_IN = 2;
const LABEL_H_IN = 0.75;

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

export default function LabelStudioPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const draw = useCallback((v: Vals) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);

    // The PURITY badge and the vertical "Not for human..." warning are baked
    // into the template art (already correctly placed), so nothing to redraw.

    // Product name and strength, centered on CENTER.
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    (Object.keys(FIELDS) as (keyof typeof FIELDS)[]).forEach((k) => {
      const f = FIELDS[k];
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(f.box.x, f.box.y, f.box.w, f.box.h);
      const text = (v[k] || "").trim();
      if (!text) return;
      let size = f.size;
      ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
      while (ctx.measureText(text).width > f.maxW && size > 12) {
        size -= 2;
        ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
      }
      ctx.fillStyle = navyRef.current;
      ctx.fillText(text, CENTER, f.baseline);
    });

    // Left technical panel values, drawn beneath the baked FORMULA / CAS / MW
    // labels. Left-aligned, dark, auto-shrunk to fit the panel. Only if present.
    const drawLeft = (text: string, y: number) => {
      const t = (text || "").trim();
      if (!t) return;
      let size = LEFTVAL.size;
      ctx.font = `${size}px Arial, Helvetica, sans-serif`;
      while (ctx.measureText(t).width > LEFTVAL.maxW && size > 16) {
        size -= 1;
        ctx.font = `${size}px Arial, Helvetica, sans-serif`;
      }
      ctx.fillStyle = "#111111";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(t, LEFTVAL.x, y);
    };
    drawLeft(v.formula, LEFTVAL.formulaY);
    drawLeft(v.cas, LEFTVAL.casY);
    drawLeft(v.mw, LEFTVAL.mwY);

    // Footer LOT / MFG, white text centered in each half of the navy bar.
    const drawFoot = (label: string, val: string, x: number) => {
      const t = (val || "").trim();
      if (!t) return;
      ctx.fillStyle = "#ffffff";
      ctx.font = `${FOOT.size}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${label}: ${t}`, x, FOOT.y);
    };
    drawFoot("LOT", v.lot, FOOT.lotX);
    drawFoot("MFG", v.mfg, FOOT.mfgX);

    // QR code to the COA page, in the upper-right white area. Pre-rendered into
    // qrImgRef when a COA number is set; a small caption sits beneath it.
    if (v.coa && v.coa.trim() && qrImgRef.current) {
      ctx.drawImage(qrImgRef.current, QR.x, QR.y, QR.size, QR.size);
      ctx.fillStyle = navyRef.current;
      ctx.font = "bold 34px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("Scan for COA", QR.x + QR.size / 2, QR.y + QR.size + 40);
    }
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      // Sample the heading navy: darkest bluish pixel inside the product-name box.
      try {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const cx = c.getContext("2d");
        if (cx) {
          cx.drawImage(img, 0, 0, W, H);
          const f = FIELDS.name.box;
          const d = cx.getImageData(f.x, f.y, f.w, f.h).data;
          let best = 1e9;
          let nr = 22, ng = 54, nb = 107;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const lum = r + g + b;
            if (b > r && lum < best) { best = lum; nr = r; ng = g; nb = b; }
          }
          navyRef.current = `rgb(${nr},${ng},${nb})`;
        }
      } catch {
        /* sampling is best-effort; fall back to default navy */
      }
      setReady(true);
    };
    img.src = IMG_SRC;
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

  // Composite the current label canvas onto the vial base with a horizontal cylinder
  // wrap (center face-on, edges compressed and darkened) → a PNG blob.
  const buildVialMockup = useCallback(async (): Promise<Blob | null> => {
    const label = canvasRef.current;
    if (!label) return null;
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
    for (let i = 0; i < rw; i++) {
      const t = rw <= 1 ? 0.5 : i / (rw - 1);                 // 0..1 across the region
      const theta = (t - 0.5) * VIAL.arc;                     // -half..half
      const srcT = (Math.sin(theta) / sinHalf) * 0.5 + 0.5;   // cylinder projection
      const srcX = Math.max(0, Math.min(label.width - 1, srcT * (label.width - 1)));
      const ox = x0 + i;
      ctx.globalAlpha = 1;
      ctx.drawImage(label, srcX, 0, 1, label.height, ox, y0, 1, rh); // 1px vertical slice
      const shade = 1 - Math.cos(theta);                      // darker toward the wrap edges
      if (shade > 0.001) {
        ctx.globalAlpha = Math.min(0.5, shade * 0.65);
        ctx.fillStyle = "#0a1420";
        ctx.fillRect(ox, y0, 1, rh);
      }
    }
    ctx.globalAlpha = 1;
    return await new Promise<Blob | null>((res) => out.toBlob((b) => res(b), "image/png"));
  }, []);

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
