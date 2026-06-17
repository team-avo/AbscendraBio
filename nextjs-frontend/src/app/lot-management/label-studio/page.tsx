"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

type Item = { name: string; spec: string };

// Default product catalog, sourced from nodejs-api/public/Ascendra_Inventory.pdf
// (ASCENDRA BIO — Product / Specification). Picking one fills the label. This is
// the seed list; "Edit items" lets the user change it (persisted in the browser).
const DEFAULT_INVENTORY: Item[] = [
  { name: "5-amino-1MQ", spec: "10mg" },
  { name: "Acetic Acid 1%", spec: "3ml" },
  { name: "AOD-9604", spec: "10mg" },
  { name: "Ara-290", spec: "10mg" },
  { name: "B12", spec: "mg/ml 10ml vial" },
  { name: "Bac Water (Hospira)", spec: "30ml" },
  { name: "Bacteriostatic Water", spec: "3ml" },
  { name: "Bacteriostatic Water", spec: "10ml" },
  { name: "BPC + TB Blend", spec: "10mg (5+5)" },
  { name: "BPC + TB Blend", spec: "20mg (10+10)" },
  { name: "BPC-157", spec: "10mg" },
  { name: "Cagrilintide", spec: "10mg" },
  { name: "CJC-1295 No DAC + Ipamorelin", spec: "10mg (5+5)" },
  { name: "CJC-1295 No DAC + Ipamorelin", spec: "20mg (10+10)" },
  { name: "DSIP", spec: "10mg" },
  { name: "Epithalon", spec: "10mg" },
  { name: "GHK-Cu", spec: "50mg" },
  { name: "GHK-Cu", spec: "100mg" },
  { name: "GLOW Blend", spec: "70mg" },
  { name: "Glutathione", spec: "600mg" },
  { name: "Glutathione", spec: "1500mg" },
  { name: "KLOW Blend", spec: "80mg" },
  { name: "KPV", spec: "10mg" },
  { name: "MLT II", spec: "10mg" },
  { name: "MOTS-c", spec: "20mg" },
  { name: "MT-1 (Melanotan 1)", spec: "10mg" },
  { name: "MT-2 (Melanotan 2)", spec: "10mg" },
  { name: "NAD+", spec: "500mg" },
  { name: "NAD+", spec: "1000mg" },
  { name: "PT-141", spec: "10mg" },
  { name: "Retatrutide", spec: "5mg" },
  { name: "Retatrutide", spec: "10mg" },
  { name: "Retatrutide", spec: "20mg" },
  { name: "Retatrutide", spec: "50mg" },
  { name: "Retatrutide", spec: "60mg" },
  { name: "Selank", spec: "10mg" },
  { name: "Semaglutide", spec: "5mg" },
  { name: "Semaglutide", spec: "10mg" },
  { name: "Semaglutide", spec: "20mg" },
  { name: "Semaglutide", spec: "30mg" },
  { name: "Semax", spec: "10mg" },
  { name: "Semax / Selank", spec: "20mg (10+10)" },
  { name: "SS-31", spec: "50mg" },
  { name: "TB-500", spec: "10mg" },
  { name: "Tesamorelin", spec: "10mg" },
  { name: "Tesamorelin / Ipamorelin", spec: "13mg (10+3)" },
  { name: "Thymosin Alpha-1", spec: "10mg" },
  { name: "Tirzepatide", spec: "5mg" },
  { name: "Tirzepatide", spec: "10mg" },
  { name: "Tirzepatide", spec: "20mg" },
  { name: "Tirzepatide", spec: "30mg" },
  { name: "Tirzepatide", spec: "40mg" },
  { name: "Tirzepatide", spec: "60mg" },
];

// Where the user-edited product list is saved (browser-local for now).
const LS_KEY = "ascendra_label_inventory_v1";

// Inventory specs are like "10mg"; on a vial label that reads "10 mg/vial".
// Non-mg specs (ml, blends) pass through unchanged for manual tweaking.
const toVialStrength = (spec: string) => {
  const m = spec.match(/^(\d+(?:\.\d+)?)\s*mg\b(.*)$/i);
  return m ? `${m[1]} mg/vial${m[2]}` : spec;
};

// Base artwork is the finished label; the two editable lines are white-blocked
// and redrawn so the canvas (and therefore the exported PDF) match exactly.
const IMG_SRC = "/Ascendra_label_BPC-157_highres.png";
const W = 2400;
const H = 900;
const LABEL_W_IN = 2;
const LABEL_H_IN = 0.75;

// The client wants the logo, product name, strength and PURITY badge all
// centered on the label. The logo is already centered in the source art (cx1200);
// the badge (which leans right at cx1386) and the two text lines are re-centered
// here on CENTER, and the left side text is nudged inward so it is not clipped.
const CENTER = 1200;
// The navy footer bar begins here; all re-centering edits stay above it.
const FOOTER_TOP = 772;
// PURITY badge bounding box, measured in the source art.
const BADGE = { sx: 914, sy: 620, w: 944, h: 125 };
// In the source art this vertical text is jammed against the top edge (its
// trailing "use" gets clipped), so it is redrawn with margins top and bottom.
const SIDE_TEXT = "Not for human, veterinary or diagnostic use";
const SIDE_STRIP_W = 200; // left area cleared before the text is redrawn

// Editable fields, in source-image pixels. `box` is whited out, then the text is
// drawn centered on CENTER at `baseline`, auto-shrunk to fit `maxW`. Measured
// from the source PNG: name caps span y354-475 (size ~168); strength "5 mg/vial"
// spans y520-594 (size ~80, baseline 578). The PURITY badge top sits at y620.
type FieldDef = { box: { x: number; y: number; w: number; h: number }; baseline: number; size: number; maxW: number };
const FIELDS: Record<"name" | "strength", FieldDef> = {
  name: { box: { x: 900, y: 338, w: 820, h: 152 }, baseline: 475, size: 169, maxW: 1500 },
  strength: { box: { x: 900, y: 500, w: 760, h: 118 }, baseline: 578, size: 80, maxW: 1100 },
};

type Vals = { name: string; strength: string };
const DEFAULTS: Vals = { name: "BPC-157", strength: "5 mg/vial" };

export default function LabelStudioPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const navyRef = useRef<string>("rgb(22,54,107)");
  const [ready, setReady] = useState(false);
  const [vals, setVals] = useState<Vals>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Vals>(DEFAULTS);
  const [inventory, setInventory] = useState<Item[]>(DEFAULT_INVENTORY);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<Item[]>([]);

  // Load any saved (edited) product list from the browser.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setInventory(parsed);
      }
    } catch {
      /* ignore malformed storage; fall back to the default list */
    }
  }, []);

  const draw = useCallback((v: Vals) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);

    // Re-center the PURITY badge: white out the original, paste it on CENTER.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(BADGE.sx - 14, BADGE.sy - 12, BADGE.w + 28, BADGE.h + 28);
    ctx.drawImage(img, BADGE.sx, BADGE.sy, BADGE.w, BADGE.h, Math.round(CENTER - BADGE.w / 2), BADGE.sy, BADGE.w, BADGE.h);

    // Redraw the left "Not for human..." text fully inside the label, vertically
    // centered with margins so the trailing "use" no longer clips at the top.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIDE_STRIP_W, FOOTER_TOP);
    ctx.save();
    const sideTopM = 40, sideBotM = 24;
    const sideAvail = FOOTER_TOP - sideBotM - sideTopM;
    ctx.translate(74, sideTopM + sideAvail / 2);
    ctx.rotate(-Math.PI / 2);
    let ss = 50;
    ctx.font = `bold ${ss}px Arial, Helvetica, sans-serif`;
    while (ctx.measureText(SIDE_TEXT).width > sideAvail && ss > 10) {
      ss -= 1;
      ctx.font = `bold ${ss}px Arial, Helvetica, sans-serif`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = navyRef.current;
    ctx.fillText(SIDE_TEXT, 0, 0);
    ctx.restore();

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

  const selectedIdx = inventory.findIndex((it) => it.name === draft.name && toVialStrength(it.spec) === draft.strength);
  const openEditor = () => { setDraft(vals); setOpen(true); };
  const saveEditor = () => { setVals(draft); setOpen(false); toast.success("Label updated"); };

  // Drawer item editor.
  const openItemsEditor = () => { setItemDraft(inventory.map((it) => ({ ...it }))); setItemsOpen(true); };
  const updateItem = (i: number, key: keyof Item, value: string) =>
    setItemDraft((d) => d.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const addItem = () => setItemDraft((d) => [...d, { name: "", spec: "" }]);
  const removeItem = (i: number) => setItemDraft((d) => d.filter((_, idx) => idx !== i));
  const saveItems = () => {
    const cleaned = itemDraft
      .map((it) => ({ name: it.name.trim(), spec: it.spec.trim() }))
      .filter((it) => it.name);
    if (!cleaned.length) { toast.error("Add at least one product"); return; }
    setInventory(cleaned);
    try { localStorage.setItem(LS_KEY, JSON.stringify(cleaned)); } catch { /* storage may be unavailable */ }
    setItemsOpen(false);
    toast.success("Products updated");
  };

  const downloadPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "in", format: [LABEL_W_IN, LABEL_H_IN], orientation: "landscape" });
    pdf.addImage(dataUrl, "PNG", 0, 0, LABEL_W_IN, LABEL_H_IN);
    const slug = (vals.name || "label").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
    pdf.save(`${slug || "label"}_label.pdf`);
    toast.success("PDF downloaded");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click the label to edit the product name and strength, preview, then download a print ready PDF at exactly 2 x 0.75 inches.
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
          <Button variant="outline" onClick={openEditor}>Edit text</Button>
          <Button variant="outline" onClick={openItemsEditor}>Edit items</Button>
          <Button onClick={downloadPdf} disabled={!ready}>Download PDF</Button>
          <span className="text-xs text-muted-foreground ml-auto">2.00 in × 0.75 in · {W}×{H}px artwork</span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit label</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Product (from inventory)</Label>
              <Select value={selectedIdx >= 0 ? String(selectedIdx) : undefined} onValueChange={(v) => { const it = inventory[Number(v)]; if (it) setDraft({ name: it.name, strength: toVialStrength(it.spec) }); }}>
                <SelectTrigger><SelectValue placeholder="Select a product…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {inventory.map((it, i) => <SelectItem key={i} value={String(i)}>{it.name} — {it.spec}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Sets the product name and strength on the label.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveEditor}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={itemsOpen} onOpenChange={setItemsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit items</DialogTitle></DialogHeader>
          <p className="text-[11px] text-muted-foreground -mt-1">Edit the products shown in the dropdown. Name is required; strength is optional.</p>
          <div className="mt-2 max-h-[55vh] overflow-y-auto pr-1 space-y-2">
            {itemDraft.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="flex-1" value={it.name} placeholder="Product name" onChange={(e) => updateItem(i, "name", e.target.value)} />
                <Input className="w-28" value={it.spec} placeholder="Strength" onChange={(e) => updateItem(i, "spec", e.target.value)} />
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeItem(i)} title="Remove">✕</Button>
              </div>
            ))}
            {itemDraft.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No products. Add one below.</p>}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={addItem}>+ Add item</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setItemsOpen(false)}>Cancel</Button>
              <Button onClick={saveItems}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
