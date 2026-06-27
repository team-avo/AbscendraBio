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
import { Country, State } from "country-state-city";
import { toast } from "sonner";

type Tab = "peptides" | "suppliers" | "labs" | "services";
const TABS: { key: Tab; label: string }[] = [
  { key: "peptides", label: "Peptides" },
  { key: "suppliers", label: "Suppliers" },
  { key: "labs", label: "Labs" },
  { key: "services", label: "Services" },
];

export default function RegistriesPage() {
  const [tab, setTab] = useState<Tab>("peptides");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const map: Record<Tab, () => Promise<any>> = {
        peptides: () => api.lmGetPeptides(false),
        suppliers: () => api.lmGetSuppliers(),
        labs: () => api.lmGetLabs(),
        services: () => api.lmGetServices(),
      };
      const r = await map[tab]();
      if (r.success) setRows(r.data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1 rounded-full text-xs font-medium border ${tab === t.key ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "peptides" ? <PeptideForm onSaved={load} /> : <AddRegistryRecord tab={tab} onAdded={load} />}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>
        ) : tab === "peptides" ? (
          <Table>
            <TableHeader className="bg-muted/30"><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Category</TableHead><TableHead>Strengths</TableHead><TableHead>CAS</TableHead><TableHead>Formula</TableHead><TableHead>MW</TableHead><TableHead className="text-right">Edit</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{p.category.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-xs">{(p.strengths || []).map((s: any) => s.code).join(", ")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.casNumber || "—"}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{p.chemicalFormula || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.molecularMass || "—"}</TableCell>
                <TableCell className="text-right"><PeptideForm peptide={p} onSaved={load} /></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        ) : tab === "suppliers" ? (
          <Table>
            <TableHeader className="bg-muted/30"><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Country</TableHead><TableHead>State</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((s) => (<TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="font-mono text-xs">{s.code}</TableCell><TableCell>{s.country || "—"}</TableCell><TableCell>{s.state || "—"}</TableCell><TableCell className="text-xs">{s.contactEmail || "—"}</TableCell></TableRow>))}</TableBody>
          </Table>
        ) : tab === "labs" ? (
          <Table>
            <TableHeader className="bg-muted/30"><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Methods</TableHead><TableHead>Turnaround</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((l) => (<TableRow key={l.id}><TableCell className="font-medium">{l.name}</TableCell><TableCell className="font-mono text-xs">{l.code}</TableCell><TableCell className="text-xs">{l.methodsOffered || "—"}</TableCell><TableCell className="text-xs">{l.turnaround || "—"}</TableCell></TableRow>))}</TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30"><TableRow><TableHead>Code</TableHead><TableHead>Service</TableHead><TableHead>Category</TableHead><TableHead>Typical Labs</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((s) => (<TableRow key={s.id}><TableCell className="font-mono text-xs">{s.code}</TableCell><TableCell className="font-medium">{s.name}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{s.category}</Badge></TableCell><TableCell className="text-xs">{s.typicalLabs || "—"}</TableCell></TableRow>))}</TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function AddRegistryRecord({ tab, onAdded }: { tab: Tab; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const fn: any = { suppliers: api.lmCreateSupplier, labs: api.lmCreateLab, services: api.lmCreateService };
      const r = await fn[tab](f);
      if (r.success) { toast.success("Added"); setOpen(false); setF({}); onAdded(); } else toast.error(r.error || "Failed");
    } finally { setSaving(false); }
  };
  const fields: Record<string, { k: string; label: string }[]> = {
    suppliers: [{ k: "name", label: "Name" }, { k: "code", label: "Code" }, { k: "country", label: "Country" }, { k: "state", label: "State / Province" }, { k: "contactEmail", label: "Email" }, { k: "phone", label: "Phone" }],
    labs: [{ k: "name", label: "Name" }, { k: "code", label: "Code" }, { k: "methodsOffered", label: "Methods" }, { k: "turnaround", label: "Turnaround" }],
    services: [{ k: "code", label: "Code" }, { k: "name", label: "Service Name" }, { k: "category", label: "Category (CORE/SAFETY/COMPOSITION/PHYSICAL)" }, { k: "description", label: "Description" }],
  };
  const countryIso = Country.getAllCountries().find((c) => c.name === f.country)?.isoCode;
  const states = countryIso ? State.getStatesOfCountry(countryIso) : [];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">+ Add</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add {tab.slice(0, -1)}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          {fields[tab].map((fl) => {
            if (tab === "suppliers" && fl.k === "country") {
              return (
                <div key="country" className="space-y-1.5">
                  <Label className="text-xs">Country</Label>
                  <Select value={f.country || ""} onValueChange={(v) => setF({ ...f, country: v, state: "" })}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Country.getAllCountries().map((c) => <SelectItem key={c.isoCode} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            if (tab === "suppliers" && fl.k === "state") {
              return (
                <div key="state" className="space-y-1.5">
                  <Label className="text-xs">State / Province</Label>
                  <Select value={f.state || ""} onValueChange={(v) => setF({ ...f, state: v })} disabled={!countryIso || states.length === 0}>
                    <SelectTrigger><SelectValue placeholder={!countryIso ? "Pick a country first" : states.length ? "Select state" : "No states listed"} /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {states.map((s) => <SelectItem key={s.isoCode} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            return (
              <div key={fl.k} className="space-y-1.5"><Label className="text-xs">{fl.label}</Label><Input value={f[fl.k] || ""} onChange={(e) => setF({ ...f, [fl.k]: e.target.value })} /></div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Add"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

const PEPTIDE_CATEGORIES = ["RESEARCH", "RESEARCH_BLEND", "GLP1"];

// Add or edit a peptide and its strengths. Peptide chemistry (formula, CAS, MW)
// is the source the Label Studio autofills from, so it is maintained here.
function PeptideForm({ peptide, onSaved }: { peptide?: any; onSaved: () => void }) {
  const isEdit = !!peptide;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({ category: "RESEARCH" });
  const [strengths, setStrengths] = useState<{ label: string; code: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    if (peptide) {
      setF({
        name: peptide.name || "",
        code: peptide.code || "",
        category: peptide.category || "RESEARCH",
        chemicalFormula: peptide.chemicalFormula || "",
        casNumber: peptide.casNumber || "",
        molecularMass: peptide.molecularMass || "",
        sequence: peptide.sequence || "",
      });
      setStrengths((peptide.strengths || []).map((s: any) => ({ label: s.label, code: s.code })));
    } else {
      setF({ category: "RESEARCH" });
      setStrengths([]);
    }
  }, [open, peptide]);

  const save = async () => {
    if (!f.name?.trim() || !f.code?.trim()) { toast.error("Name and code are required"); return; }
    setSaving(true);
    try {
      const cleanStrengths = strengths
        .map((s) => ({ label: s.label.trim(), code: s.code.trim() }))
        .filter((s) => s.label && s.code);
      const payload = { ...f, strengths: cleanStrengths };
      const r = isEdit ? await api.lmUpdatePeptide(peptide.id, payload) : await api.lmCreatePeptide(payload);
      if (r.success) { toast.success(isEdit ? "Saved" : "Added"); setOpen(false); onSaved(); }
      else toast.error(r.error || (isEdit ? "Failed to save" : "Failed to add"));
    } finally { setSaving(false); }
  };

  const setStrength = (i: number, key: "label" | "code", value: string) =>
    setStrengths((s) => s.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const addStrength = () => setStrengths((s) => [...s, { label: "", code: "" }]);
  const removeStrength = (i: number) => setStrengths((s) => s.filter((_, idx) => idx !== i));

  const text = (k: string, label: string, placeholder?: string) => (
    <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input value={f[k] || ""} placeholder={placeholder} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Edit</Button> : <Button size="sm">+ Add</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit peptide" : "Add peptide"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            {text("name", "Name")}
            {text("code", "Code")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={f.category || "RESEARCH"} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PEPTIDE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {text("chemicalFormula", "Chemical formula", "e.g. C62H98N16O22")}
          <div className="grid grid-cols-2 gap-3">
            {text("casNumber", "CAS #", "e.g. 137525-51-0")}
            {text("molecularMass", "Molecular weight", "e.g. ~1419.5 Da")}
          </div>
          {text("sequence", "Sequence (optional)")}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Strengths</Label>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addStrength}>+ Add strength</Button>
            </div>
            {strengths.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="flex-1" value={s.label} placeholder="Label (e.g. 10 mg)" onChange={(e) => setStrength(i, "label", e.target.value)} />
                <Input className="w-28" value={s.code} placeholder="Code (10MG)" onChange={(e) => setStrength(i, "code", e.target.value)} />
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeStrength(i)} title="Remove">✕</Button>
              </div>
            ))}
            {strengths.length === 0 && <p className="text-[11px] text-muted-foreground">No strengths yet.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving..." : isEdit ? "Save" : "Add"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
