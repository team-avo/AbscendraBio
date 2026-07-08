"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { buildVialMockupCanvas, buildVialMockupBlob, deriveLot, DEFAULT_NAVY, type VialVals } from "@/lib/vial-mockup";

// Vial Studio serves each product's FINISHED photorealistic vial from the mockup
// set (public/vial-mockups + manifest) — the premium image the client wants on the
// page and in downloads. For a product that has no finished vial yet (e.g. one just
// added to the registry), it falls back to generating the vial live from the
// registry, which stays editable. Manage products in Registries → Peptides.
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
type MOption = { sku: string; strength: string; file?: string };
type Group = { product: string; options: MOption[] };
type Entry = { name: string; photoreal: boolean; options: MOption[]; peptide?: Peptide };

const byNumeric = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const toVialStrength = (s: string) => {
  const m = (s || "").match(/^(\d+(?:\.\d+)?)\s*mg\b(.*)$/i);
  return m ? `${m[1]} mg/vial${m[2] ? " " + m[2].trim() : ""}` : s;
};
const slugFor = (name: string) => (name || "vial").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
const codeFor = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

const GEN_DEFAULTS: VialVals = { name: "", strength: "", formula: "", cas: "", mw: "", lot: "", mfg: "" };

export default function VialStudioPage() {
  const [manifest, setManifest] = useState<Group[]>([]);
  const [peptides, setPeptides] = useState<Peptide[]>([]);
  const [selName, setSelName] = useState("");
  const [selSku, setSelSku] = useState("");
  const [imgLoaded, setImgLoaded] = useState(false);
  // Cache-bust the finished images: they keep the same filename when re-exported,
  // so browsers otherwise show a stale copy. New value per page load.
  const [bust] = useState(() => Date.now());

  // Generated (fallback) state.
  const [vals, setVals] = useState<VialVals>(GEN_DEFAULTS);
  const [genUrl, setGenUrl] = useState("");
  const [rendering, setRendering] = useState(false);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VialVals>(GEN_DEFAULTS);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", strength: "", formula: "", cas: "", mw: "" });
  const [adding, setAdding] = useState(false);

  const loadPeptides = async () => {
    try {
      const r = await api.lmGetPeptides(true);
      if (r.success && Array.isArray(r.data)) return r.data as Peptide[];
    } catch { /* registry unavailable */ }
    return [] as Peptide[];
  };

  useEffect(() => {
    fetch("/vial-mockups/manifest.json").then((r) => r.json()).then((d: Group[]) => setManifest(Array.isArray(d) ? d : [])).catch(() => {});
    loadPeptides().then(setPeptides);
  }, []);

  // Merge: finished photoreal products first, then registry-only products (generated).
  const entries: Entry[] = useMemo(() => {
    const seen = new Set(manifest.map((g) => g.product.trim().toLowerCase()));
    const photoreal: Entry[] = manifest.map((g) => ({
      name: g.product,
      photoreal: true,
      options: [...g.options].sort((a, b) => byNumeric(a.strength, b.strength)),
    })).sort((a, b) => byNumeric(a.name, b.name));
    const generated: Entry[] = peptides
      .filter((p) => !seen.has(p.name.trim().toLowerCase()))
      .map((p) => ({
        name: p.name,
        photoreal: false,
        peptide: p,
        options: (p.strengths || []).map((s) => ({ sku: s.code, strength: s.label })),
      }))
      .sort((a, b) => byNumeric(a.name, b.name));
    return [...photoreal, ...generated];
  }, [manifest, peptides]);

  // Default to the first (photoreal) product once data is in.
  useEffect(() => {
    if (!selName && entries.length) { setSelName(entries[0].name); setSelSku(entries[0].options[0]?.sku || ""); }
  }, [entries, selName]);

  const selEntry = entries.find((e) => e.name === selName);
  const selOption = selEntry?.options.find((o) => o.sku === selSku) || selEntry?.options[0];
  const isPhotoreal = !!(selEntry?.photoreal && selOption?.file);
  const photoSrc = isPhotoreal ? `/vial-mockups/${selOption!.file}?v=${bust}` : "";

  // Build values for a generated product on selection.
  useEffect(() => {
    if (!selEntry || selEntry.photoreal || !selOption) return;
    const p = selEntry.peptide;
    setVals({
      name: selEntry.name,
      strength: toVialStrength(selOption.strength),
      formula: p?.chemicalFormula || "",
      cas: p?.casNumber || "",
      mw: p?.molecularMass || "",
      lot: deriveLot(selEntry.name),
      mfg: "",
    });
  }, [selName, selSku]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render the generated preview when its values change.
  useEffect(() => {
    if (!selEntry || selEntry.photoreal) return;
    let cancelled = false;
    setRendering(true);
    buildVialMockupCanvas(vals, DEFAULT_NAVY)
      .then((cv) => { if (!cancelled) { setGenUrl(cv ? cv.toDataURL("image/png") : ""); setRendering(false); } })
      .catch(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; };
  }, [vals, isPhotoreal]); // eslint-disable-line react-hooks/exhaustive-deps

  const onProduct = (name: string) => {
    setSelName(name);
    const e = entries.find((x) => x.name === name);
    setSelSku(e?.options[0]?.sku || "");
    setImgLoaded(false);
  };
  const onStrength = (sku: string) => { setSelSku(sku); setImgLoaded(false); };

  const openEditor = () => { setDraft(vals); setOpen(true); };
  const saveEditor = () => { setVals({ ...draft, lot: deriveLot(draft.name) }); setOpen(false); toast.success("Vial updated"); };
  const setField = (k: keyof VialVals, value: string) => setDraft((d) => ({ ...d, [k]: value }));

  const download = async () => {
    try {
      let blob: Blob | null = null;
      let fname = `${slugFor(selName)}_vial.png`;
      if (isPhotoreal) {
        blob = await (await fetch(photoSrc)).blob();
        fname = selOption!.file!;
      } else {
        blob = await buildVialMockupBlob(vals, DEFAULT_NAVY);
      }
      if (!blob) { toast.error("Could not prepare the download"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Vial downloaded");
    } catch { toast.error("Download failed"); }
  };

  const submitAdd = async () => {
    const name = addForm.name.trim();
    if (!name) { toast.message("Enter a product name"); return; }
    setAdding(true);
    try {
      const strengths = addForm.strength.trim()
        ? [{ label: addForm.strength.trim(), code: addForm.strength.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") }]
        : [];
      const r = await api.lmCreatePeptide({
        name, code: codeFor(name), category: "RESEARCH",
        chemicalFormula: addForm.formula.trim() || undefined,
        casNumber: addForm.cas.trim() || undefined,
        molecularMass: addForm.mw.trim() || undefined,
        strengths,
      });
      if (!r?.success) { toast.error("Could not add the product (name/code may already exist)"); return; }
      toast.success(`Added ${name}`);
      setPeptides(await loadPeptides());
      setAddOpen(false);
      setAddForm({ name: "", strength: "", formula: "", cas: "", mw: "" });
      setSelName(name);
    } catch { toast.error("Could not add the product"); }
    finally { setAdding(false); }
  };

  const photoCount = manifest.length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pick a product to show its finished photorealistic vial — the exact image goes on the page and in the download. A product that doesn’t have a finished vial yet is generated live from the registry (and stays editable). Not in the list? Use “+ Add product”.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4 max-w-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Product</Label>
              <button type="button" onClick={() => setAddOpen(true)} className="text-xs font-medium text-primary hover:underline">+ Add product</button>
            </div>
            <Select value={selName || undefined} onValueChange={onProduct}>
              <SelectTrigger><SelectValue placeholder={entries.length ? "Select a product…" : "Loading…"} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {entries.filter((e) => e.photoreal).map((e) => <SelectItem key={e.name} value={e.name}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Strength</Label>
            <Select value={selSku || undefined} onValueChange={onStrength} disabled={(selEntry?.options.length || 0) <= 1}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(selEntry?.options || []).map((o) => <SelectItem key={o.sku} value={o.sku}>{o.strength}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-gray-200 bg-[#f3f3f4]" style={{ aspectRatio: "1 / 1" }}>
          {isPhotoreal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photoSrc} src={photoSrc} alt={selName} onLoad={() => setImgLoaded(true)} className="w-full h-full object-contain block" />
          ) : genUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={genUrl} alt={selName} className="w-full h-full object-contain block" />
          ) : null}
          {((isPhotoreal && !imgLoaded) || (!isPhotoreal && rendering)) && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Loading vial…</div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={download} disabled={!selEntry}>Download vial</Button>
          {!isPhotoreal && selEntry && <Button variant="outline" onClick={openEditor}>Edit fields</Button>}
          <span className="text-xs text-muted-foreground ml-auto">
            {isPhotoreal ? "Photoreal · from finished set" : "Generated live"} · {photoCount} photoreal products
          </span>
        </div>
      </div>

      {/* Edit fields (generated only) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit vial</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={draft.name} onChange={(e) => setField("name", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Strength (mg/vial)</Label><Input value={draft.strength} onChange={(e) => setField("strength", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Chemical formula</Label><Input value={draft.formula} onChange={(e) => setField("formula", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">CAS #</Label><Input value={draft.cas} onChange={(e) => setField("cas", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Molecular weight</Label><Input value={draft.mw} onChange={(e) => setField("mw", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Manufacture (MFG)</Label><Input value={draft.mfg} onChange={(e) => setField("mfg", e.target.value)} placeholder="05/2026" /></div>
            </div>
            <p className="text-[11px] text-muted-foreground">LOT auto-derives from the name: <span className="font-mono">{deriveLot(draft.name)}</span></p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveEditor}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add product to registry */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add product to registry</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5"><Label className="text-xs">Product name</Label><Input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Thymosin Alpha-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Strength</Label><Input value={addForm.strength} onChange={(e) => setAddForm((f) => ({ ...f, strength: e.target.value }))} placeholder="10 mg" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CAS #</Label><Input value={addForm.cas} onChange={(e) => setAddForm((f) => ({ ...f, cas: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Chemical formula</Label><Input value={addForm.formula} onChange={(e) => setAddForm((f) => ({ ...f, formula: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Molecular weight</Label><Input value={addForm.mw} onChange={(e) => setAddForm((f) => ({ ...f, mw: e.target.value }))} /></div>
            </div>
            <p className="text-[11px] text-muted-foreground">Saved to the registry (category Research). It’s generated live until a finished vial is added.</p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={adding}>{adding ? "Adding…" : "Add product"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
