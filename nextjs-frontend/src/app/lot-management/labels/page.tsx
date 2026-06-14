"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";

const DEFAULT_ZONES = JSON.stringify(
  { qr: { x: 10, y: 10, w: 60 }, lotNumber: { x: 80, y: 15, size: 9, bold: true }, mfgDate: { x: 80, y: 32, size: 7 }, expDate: { x: 80, y: 44, size: 7 } },
  null,
  2,
);

export default function LabelsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ companyId: "", name: "", widthMm: 50, heightMm: 25, zones: DEFAULT_ZONES });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.lmGetLabelTemplates();
      if (r.success) setRows(r.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    api.lmGetCompanies().then((r) => r.success && setCompanies(r.data));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      let artworkUrl = "";
      let artworkKey;
      if (file) {
        const up = await api.lmUploadArtwork(file);
        if (!up.success) throw new Error(up.error || "Artwork upload failed");
        artworkUrl = (up.data as any).artworkUrl;
        artworkKey = (up.data as any).artworkKey;
      }
      let zones;
      try {
        zones = JSON.parse(f.zones);
      } catch {
        toast.error("Zones must be valid JSON");
        return;
      }
      const r = await api.lmCreateLabelTemplate({ companyId: f.companyId, name: f.name, artworkUrl, artworkKey, zones, widthMm: Number(f.widthMm), heightMm: Number(f.heightMm) });
      if (r.success) {
        toast.success("Template created");
        setOpen(false);
        setF({ companyId: "", name: "", widthMm: 50, heightMm: 25, zones: DEFAULT_ZONES });
        setFile(null);
        load();
      } else toast.error(r.error || "Failed");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Base label artwork with placeholder zones (QR, Lot, Mfg, Expiry), per brand.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ New Template</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>New Label Template</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Brand</Label>
                <Select value={f.companyId} onValueChange={(v) => setF({ ...f, companyId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Width (mm)</Label><Input type="number" value={f.widthMm} onChange={(e) => setF({ ...f, widthMm: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Height (mm)</Label><Input type="number" value={f.heightMm} onChange={(e) => setF({ ...f, heightMm: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Artwork (PNG/JPG)</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Placeholder Zones (JSON, points top-left)</Label><Textarea rows={8} value={f.zones} onChange={(e) => setF({ ...f, zones: e.target.value })} className="font-mono text-xs" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!f.companyId || !f.name || saving}>{saving ? "Saving..." : "Create"}</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30"><TableRow><TableHead>Name</TableHead><TableHead>Brand</TableHead><TableHead>Size</TableHead><TableHead>Artwork</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="h-40 text-center"><LoadingSpinner size={28} /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">No templates yet.</TableCell></TableRow>
            ) : (
              rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.company?.name}</TableCell>
                  <TableCell className="text-xs">{t.widthMm} x {t.heightMm} mm</TableCell>
                  <TableCell className="text-xs">{t.artworkUrl ? <a className="text-primary underline" href={t.artworkUrl} target="_blank" rel="noreferrer">view</a> : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
