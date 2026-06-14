"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";

const LOT_STATUSES = ["IN_TESTING", "RELEASED", "QUARANTINE", "REJECTED", "EXPIRED", "RECALLED"];
const statusTone: Record<string, any> = { IN_TESTING: "secondary", RELEASED: "default", QUARANTINE: "outline", REJECTED: "destructive", EXPIRED: "destructive", RECALLED: "destructive" };
const fmt = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default function LotsPage() {
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [open, setOpen] = useState(false);

  // registries
  const [companies, setCompanies] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [peptides, setPeptides] = useState<any[]>([]);

  // form
  const empty = { companyId: "", supplierId: "", peptideId: "", peptideStrengthId: "", quantity: "", mfgDate: "", orderDate: "", receivedDate: "" };
  const [form, setForm] = useState<any>(empty);
  const [preview, setPreview] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.lmGetLots(statusFilter !== "ALL" ? { status: statusFilter, limit: 200 } : { limit: 200 });
      if (r.success) setLots(r.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    (async () => {
      const [c, s, p] = await Promise.all([api.lmGetCompanies(), api.lmGetSuppliers(), api.lmGetPeptides(true)]);
      if (c.success) setCompanies(c.data || []);
      if (s.success) setSuppliers(s.data || []);
      if (p.success) setPeptides(p.data || []);
    })();
  }, []);

  const selectedPeptide = peptides.find((p) => p.id === form.peptideId);
  const strengths = selectedPeptide?.strengths || [];

  // live preview when enough fields present
  useEffect(() => {
    const { peptideId, peptideStrengthId, mfgDate, supplierId, orderDate } = form;
    if (peptideId && peptideStrengthId && mfgDate && supplierId && orderDate) {
      api.lmPreviewLot({ peptideId, peptideStrengthId, mfgDate, supplierId, orderDate }).then((r) => setPreview(r.success ? r.data : null));
    } else {
      setPreview(null);
    }
  }, [form.peptideId, form.peptideStrengthId, form.mfgDate, form.supplierId, form.orderDate]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v, ...(k === "peptideId" ? { peptideStrengthId: "" } : {}) }));

  const submit = async () => {
    setSaving(true);
    try {
      const r = await api.lmCreateLot({ ...form, quantity: Number(form.quantity) });
      if (r.success) {
        toast.success(`Lot ${r.data.lotNumber} created`);
        setOpen(false);
        setForm(empty);
        setPreview(null);
        load();
      } else {
        toast.error(r.error || "Failed to create lot");
      }
    } finally {
      setSaving(false);
    }
  };

  const valid = form.companyId && form.supplierId && form.peptideId && form.peptideStrengthId && form.quantity && form.mfgDate && form.orderDate;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", ...LOT_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"}`}
            >
              {s === "ALL" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ New Lot</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>New Lot Intake</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <Field label="Company (brand)">
                <Select value={form.companyId} onValueChange={(v) => set("companyId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Supplier">
                <Select value={form.supplierId} onValueChange={(v) => set("supplierId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Peptide / SKU">
                <Select value={form.peptideId} onValueChange={(v) => set("peptideId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select peptide" /></SelectTrigger>
                  <SelectContent className="max-h-72">{peptides.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Strength">
                <Select value={form.peptideStrengthId} onValueChange={(v) => set("peptideStrengthId", v)} disabled={!strengths.length}>
                  <SelectTrigger><SelectValue placeholder={strengths.length ? "Select strength" : "Pick a peptide first"} /></SelectTrigger>
                  <SelectContent>{strengths.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.label} ({s.code})</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Quantity (vials)"><Input type="number" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} /></Field>
              <Field label="Mfg Date"><Input type="date" value={form.mfgDate} onChange={(e) => set("mfgDate", e.target.value)} /></Field>
              <Field label="Order Date"><Input type="date" value={form.orderDate} onChange={(e) => set("orderDate", e.target.value)} /></Field>
              <Field label="Received Date"><Input type="date" value={form.receivedDate} onChange={(e) => set("receivedDate", e.target.value)} /></Field>
            </div>

            {preview && (
              <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm space-y-1">
                <div className="font-medium text-blue-900">Auto-generated</div>
                <div className="font-mono text-blue-800">Lot Number: <b>{preview.lotNumber}</b></div>
                <div className="font-mono text-blue-800">Order ID: {preview.procurementOrderId}</div>
                <div className="text-blue-800">Expiry: {fmt(preview.expirationDate)} ({preview.bud})</div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!valid || saving}>{saving ? "Creating..." : "Create Lot"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Lot Number</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Peptide</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Mfg</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">COAs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="h-40 text-center"><LoadingSpinner size={28} /></TableCell></TableRow>
            ) : lots.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="h-40 text-center text-muted-foreground italic">No lots yet. Create your first lot.</TableCell></TableRow>
            ) : (
              lots.map((l) => (
                <TableRow key={l.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-xs font-semibold">{l.lotNumber}</TableCell>
                  <TableCell><Badge variant="outline">{l.company?.code}</Badge></TableCell>
                  <TableCell className="text-sm">{l.peptide?.name} <span className="text-muted-foreground">{l.strength?.label}</span></TableCell>
                  <TableCell className="font-mono text-xs">{l.procurementOrderId}</TableCell>
                  <TableCell className="text-xs">{fmt(l.mfgDate)}</TableCell>
                  <TableCell className="text-xs">{fmt(l.expirationDate)}</TableCell>
                  <TableCell>{l.quantity}</TableCell>
                  <TableCell><Badge variant={statusTone[l.status]}>{l.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-center">{l.coas?.length || 0}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
