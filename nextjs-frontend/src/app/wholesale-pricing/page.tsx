"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/contexts/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { api } from "@/lib/api";
import type { WholesalePrice } from "@/lib/api-wholesale-pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Trash2, Save } from "lucide-react";
import { toast } from "sonner";

type Row = WholesalePrice;

export default function WholesalePricingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.wpList();
      if (r.success && Array.isArray(r.data)) setRows(r.data as Row[]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.strength} ${r.category}`.toLowerCase().includes(q));
  }, [rows, search]);

  const setField = (id: string, key: keyof Row, value: number) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  const saveRow = async (row: Row) => {
    setSavingId(row.id);
    try {
      const r = await api.wpUpdate(row.id, {
        reg: Number(row.reg), m2: Number(row.m2), m5: Number(row.m5), m10: Number(row.m10),
      });
      if (r.success) toast.success(`${row.name} saved`);
      else toast.error(r.error || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const removeRow = async (row: Row) => {
    if (!confirm(`Delete ${row.name} (${row.strength}) from the pricing page?`)) return;
    const r = await api.wpDelete(row.id);
    if (r.success) { toast.success("Deleted"); setRows((rs) => rs.filter((x) => x.id !== row.id)); }
    else toast.error(r.error || "Delete failed");
  };

  const numCell = (row: Row, key: "reg" | "m2" | "m5" | "m10") => (
    <Input
      type="number"
      step="0.01"
      className="w-24 h-8"
      value={Number.isFinite(row[key]) ? row[key] : 0}
      onChange={(e) => setField(row.id, key, parseFloat(e.target.value || "0"))}
    />
  );

  return (
    <ProtectedRoute requiredRoles={["ADMIN", "SUPER_ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-4 p-1">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold">Wholesale Pricing</h1>
            <p className="text-sm text-muted-foreground">These prices power the public /pricing page. Edits here go live, no code change. List = base price; M2 / M5 / M10 = the MOQ $2k / $5k / $10k tier prices.</p>
          </div>
          <AddRow onAdded={load} />
        </div>

        <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size={28} /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Strength</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead>M2</TableHead>
                  <TableHead>M5</TableHead>
                  <TableHead>M10</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-sm">{row.strength}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.category}</TableCell>
                    <TableCell>{numCell(row, "reg")}</TableCell>
                    <TableCell>{numCell(row, "m2")}</TableCell>
                    <TableCell>{numCell(row, "m5")}</TableCell>
                    <TableCell>{numCell(row, "m10")}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" className="h-8 mr-1" disabled={savingId === row.id} onClick={() => saveRow(row)}>
                        <Save className="h-3.5 w-3.5 mr-1" />{savingId === row.id ? "Saving…" : "Save"}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeRow(row)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No products.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function AddRow({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({ category: "Research Peptides" });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name?.trim() || !f.strength?.trim()) { toast.error("Name and strength are required"); return; }
    setSaving(true);
    try {
      const r = await api.wpCreate({
        name: f.name.trim(), strength: f.strength.trim(), category: f.category || "Research Peptides",
        reg: parseFloat(f.reg || "0"), m2: parseFloat(f.m2 || "0"), m5: parseFloat(f.m5 || "0"), m10: parseFloat(f.m10 || "0"),
      });
      if (r.success) { toast.success("Added"); setOpen(false); setF({ category: "Research Peptides" }); onAdded(); }
      else toast.error(r.error || "Failed");
    } finally { setSaving(false); }
  };

  const num = (k: string, label: string) => (
    <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type="number" step="0.01" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">+ Add product</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add product</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={f.name || ""} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Strength</Label><Input value={f.strength || ""} placeholder="e.g. 10 mg" onChange={(e) => set("strength", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Category</Label><Input value={f.category || ""} onChange={(e) => set("category", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            {num("reg", "List price")}
            {num("m2", "M2 ($2k tier)")}
            {num("m5", "M5 ($5k tier)")}
            {num("m10", "M10 ($10k tier)")}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
