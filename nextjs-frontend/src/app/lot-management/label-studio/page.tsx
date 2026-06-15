"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

// Base artwork is the finished label; the two editable lines are white-blocked
// and redrawn so the canvas (and therefore the exported PDF) match exactly.
const IMG_SRC = "/Ascendra_label_BPC-157_highres.png";
const W = 2400;
const H = 900;
const LABEL_W_IN = 2;
const LABEL_H_IN = 0.75;

// Editable fields, in source-image pixels. `box` is whited out, text is drawn
// left-aligned at (x, baseline) and auto-shrunk to fit `maxW`.
const FIELDS = {
  name: { box: { x: 900, y: 338, w: 820, h: 152 }, x: 916, baseline: 475, size: 169, maxW: 1120 },
  strength: { box: { x: 900, y: 502, w: 700, h: 134 }, x: 916, baseline: 604, size: 117, maxW: 940 },
} as const;

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

  const draw = useCallback((v: Vals) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    ctx.textAlign = "left";
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
      ctx.fillText(text, f.x, f.baseline);
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

  const openEditor = () => { setDraft(vals); setOpen(true); };
  const saveEditor = () => { setVals(draft); setOpen(false); toast.success("Label updated"); };

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
          <Button onClick={downloadPdf} disabled={!ready}>Download PDF</Button>
          <span className="text-xs text-muted-foreground ml-auto">2.00 in × 0.75 in · {W}×{H}px artwork</span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit label</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Product Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Strength</Label>
              <Input value={draft.strength} onChange={(e) => setDraft({ ...draft, strength: e.target.value })} />
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
