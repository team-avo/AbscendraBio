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
        {tab !== "peptides" && <AddRegistryRecord tab={tab} onAdded={load} />}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>
        ) : tab === "peptides" ? (
          <Table>
            <TableHeader className="bg-muted/30"><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Category</TableHead><TableHead>Strengths</TableHead><TableHead>CAS</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{p.category.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-xs">{(p.strengths || []).map((s: any) => s.code).join(", ")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.casNumber || "—"}</TableCell>
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
