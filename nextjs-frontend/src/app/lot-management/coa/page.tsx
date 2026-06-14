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

const COA_STATUS = ["AWAITING_RESULTS", "PENDING_REVIEW", "APPROVED", "REJECTED"];
const statusTone: Record<string, any> = { AWAITING_RESULTS: "secondary", PENDING_REVIEW: "outline", APPROVED: "default", REJECTED: "destructive" };
const resultTone: Record<string, any> = { PASS: "default", FAIL: "destructive", PENDING: "secondary" };
const fmt = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default function CoaPage() {
  const [coas, setCoas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  const [lots, setLots] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [cf, setCf] = useState<any>({ lotId: "", labId: "", dateSubmitted: "", testIds: [] as string[] });
  const [saving, setSaving] = useState(false);

  const [resultsFor, setResultsFor] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.lmGetCoas(filter !== "ALL" ? { status: filter, limit: 200 } : { limit: 200 });
      if (r.success) setCoas(r.data.data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);
  useEffect(() => {
    (async () => {
      const [l, lb, s] = await Promise.all([api.lmGetLots({ limit: 500 }), api.lmGetLabs(), api.lmGetServices()]);
      if (l.success) setLots(l.data.data || []);
      if (lb.success) setLabs(lb.data);
      if (s.success) setServices(s.data);
    })();
  }, []);

  const toggleTest = (id: string) => setCf((c: any) => ({ ...c, testIds: c.testIds.includes(id) ? c.testIds.filter((x: string) => x !== id) : [...c.testIds, id] }));

  const createCoa = async () => {
    setSaving(true);
    try {
      const r = await api.lmCreateCoa(cf);
      if (r.success) {
        toast.success(`COA #${r.data.coaNumber} created`);
        setCreateOpen(false);
        setCf({ lotId: "", labId: "", dateSubmitted: "", testIds: [] });
        load();
      } else toast.error(r.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const approve = async (id: string) => {
    const r = await api.lmApproveCoa(id);
    if (r.success) {
      toast.success("COA approved");
      load();
    } else toast.error(r.error || "Failed");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", ...COA_STATUS].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded-full text-xs font-medium border ${filter === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"}`}>
              {s === "ALL" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button>+ New COA</Button></DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>New COA (build-time)</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Lot</Label>
                <Select value={cf.lotId} onValueChange={(v) => setCf((c: any) => ({ ...c, lotId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a lot" /></SelectTrigger>
                  <SelectContent className="max-h-72">{lots.map((l) => <SelectItem key={l.id} value={l.id}>{l.lotNumber}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Lab</Label>
                  <Select value={cf.labId} onValueChange={(v) => setCf((c: any) => ({ ...c, labId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select lab" /></SelectTrigger>
                    <SelectContent>{labs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.code})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date Submitted</Label>
                  <Input type="date" value={cf.dateSubmitted} onChange={(e) => setCf((c: any) => ({ ...c, dateSubmitted: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tests Performed</Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-auto border rounded-lg p-2">
                  {services.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={cf.testIds.includes(s.id)} onChange={() => toggleTest(s.id)} />
                      {s.code} — {s.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={createCoa} disabled={!cf.lotId || !cf.labId || !cf.dateSubmitted || saving}>{saving ? "Creating..." : "Create COA"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Filename</TableHead>
              <TableHead>Lab</TableHead>
              <TableHead>HPLC</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-40 text-center"><LoadingSpinner size={28} /></TableCell></TableRow>
            ) : coas.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-40 text-center text-muted-foreground italic">No COAs yet.</TableCell></TableRow>
            ) : (
              coas.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/20">
                  <TableCell className="font-semibold">{c.coaNumber}</TableCell>
                  <TableCell className="font-mono text-[11px] max-w-[280px] truncate" title={c.filename}>{c.filename}</TableCell>
                  <TableCell className="text-sm">{c.lab?.code}</TableCell>
                  <TableCell>{c.hplcPurity != null ? `${c.hplcPurity}%` : "—"}</TableCell>
                  <TableCell><Badge variant={resultTone[c.overallResult]}>{c.overallResult}</Badge></TableCell>
                  <TableCell><Badge variant={statusTone[c.status]}>{c.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => setResultsFor(c)}>Results</Button>
                    {c.status !== "APPROVED" && <Button size="sm" onClick={() => approve(c.id)}>Approve</Button>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {resultsFor && <ResultsDialog coa={resultsFor} onClose={() => setResultsFor(null)} onSaved={() => { setResultsFor(null); load(); }} />}
    </div>
  );
}

function ResultsDialog({ coa, onClose, onSaved }: { coa: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({
    testDate: coa.testDate ? coa.testDate.slice(0, 10) : "",
    dateReceived: coa.dateReceived ? coa.dateReceived.slice(0, 10) : "",
    hplcPurity: coa.hplcPurity ?? "",
    msConfirmed: coa.msConfirmed ?? false,
    overallResult: coa.overallResult || "PENDING",
    reviewedBy: coa.reviewedBy || "",
    status: coa.status,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const r = await api.lmUpdateCoaResults(coa.id, f);
      if (r.success) { toast.success("Results saved"); onSaved(); } else toast.error(r.error || "Failed");
    } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log Results — COA #{coa.coaNumber}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="space-y-1.5"><Label className="text-xs">Test Date</Label><Input type="date" value={f.testDate} onChange={(e) => setF({ ...f, testDate: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Date Received</Label><Input type="date" value={f.dateReceived} onChange={(e) => setF({ ...f, dateReceived: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">HPLC Purity %</Label><Input type="number" step="0.01" value={f.hplcPurity} onChange={(e) => setF({ ...f, hplcPurity: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Reviewed By</Label><Input value={f.reviewedBy} onChange={(e) => setF({ ...f, reviewedBy: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label className="text-xs">MS Confirmed</Label>
            <Select value={String(f.msConfirmed)} onValueChange={(v) => setF({ ...f, msConfirmed: v === "true" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Overall Result</Label>
            <Select value={f.overallResult} onValueChange={(v) => setF({ ...f, overallResult: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["PASS", "FAIL", "PENDING"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COA_STATUS.map((x) => <SelectItem key={x} value={x}>{x.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Results"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
