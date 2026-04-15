'use client';

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Percent, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { TaxRateDialog } from "@/components/settings/tax-rate-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function TaxesSettingsPage() {
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [showTaxDialog, setShowTaxDialog] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taxToDelete, setTaxToDelete] = useState<string | null>(null);

  const fetchTaxRates = async () => {
    setTaxLoading(true);
    try {
      const res = await api.get("/tax-rates");
      if (res.success) setTaxRates(res.data);
      else toast.error("Failed to load tax rates");
    } catch (e) {
      toast.error("Failed to load tax rates");
    } finally {
      setTaxLoading(false);
    }
  };
  useEffect(() => { fetchTaxRates(); }, []);

  const handleAddTax = () => { setEditingTax(null); setShowTaxDialog(true); };
  const handleEditTax = (tax: any) => { setEditingTax(tax); setShowTaxDialog(true); };
  const handleDeleteTax = async (id: string) => {
    setTaxToDelete(id);
    setDeleteDialogOpen(true);
  };
  const confirmDeleteTax = async () => {
    if (!taxToDelete) return;
    try {
      await api.delete(`/tax-rates/${taxToDelete}`);
      toast.success("Tax rate deleted");
      fetchTaxRates();
    } catch (e) {
      toast.error("Failed to delete tax rate");
    } finally {
      setDeleteDialogOpen(false);
      setTaxToDelete(null);
    }
  };
  const cancelDeleteTax = () => {
    setDeleteDialogOpen(false);
    setTaxToDelete(null);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-0">
          {/* ════════ DARK HERO STRIP ════════ */}
          <div className="relative bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#4D7DF2]/8 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">Tax Settings</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Configure tax rates and rules for your store</p>
                </div>
                <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2">
                  <Percent className="h-4 w-4 text-[#4D7DF2]" />
                  <div>
                    <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Tax Rates</p>
                    <p className="text-base font-black text-white tabular-nums leading-tight">{taxRates.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tax Configuration info card */}
          <div className="mt-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="font-semibold text-sm text-slate-800">Tax Configuration</p>
              <p className="text-xs text-slate-500 mt-0.5">Configure tax rates and rules for your store</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm sm:text-base">Enable taxes</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">Charge taxes on orders</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm sm:text-base">Prices include tax</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">Display prices with tax included</p>
                </div>
                <Switch />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tax-calculation" className="text-xs sm:text-sm font-medium">Tax calculation method</Label>
                <Select defaultValue="destination">
                  <SelectTrigger className="h-9 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="destination">Based on shipping address</SelectItem>
                    <SelectItem value="origin">Based on store address</SelectItem>
                    <SelectItem value="billing">Based on billing address</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tax Rates table card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50">
                <Percent className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">Tax Rates</p>
                <p className="text-xs text-slate-500">{taxRates.length} rates</p>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <div className="rounded-xl border border-gray-200 overflow-hidden -mx-2 sm:mx-0">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold px-4 py-2">Country</TableHead>
                      <TableHead className="font-semibold px-4 py-2">State</TableHead>
                      <TableHead className="font-semibold px-4 py-2">Rate (%)</TableHead>
                      <TableHead className="font-semibold px-4 py-2">Type</TableHead>
                      <TableHead className="font-semibold px-4 py-2">Status</TableHead>
                      <TableHead className="font-semibold text-right px-4 py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxLoading ? (
                      <TableRow><TableCell colSpan={6} className="h-20 text-center">Loading...</TableCell></TableRow>
                    ) : taxRates.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-20 text-center">No tax rates found.</TableCell></TableRow>
                    ) : taxRates.filter((tax: any) => tax.isActive).length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-20 text-center">No active tax rates found.</TableCell></TableRow>
                    ) : taxRates.filter((tax: any) => tax.isActive).map((tax: any) => (
                      <TableRow key={tax.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium px-4 py-2">{tax.country}</TableCell>
                        <TableCell className="px-4 py-2">{tax.state || '-'}</TableCell>
                        <TableCell className="px-4 py-2">{tax.rate}</TableCell>
                        <TableCell className="px-4 py-2">{tax.type}</TableCell>
                        <TableCell className="px-4 py-2">
                          <Badge variant={tax.isActive ? "default" : "secondary"} className="text-[10px]">
                            {tax.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditTax(tax)} className="h-8 w-8 p-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteTax(tax.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                className="w-full sm:w-auto mt-4 h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
                onClick={handleAddTax}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tax Rate
              </Button>
            </div>
          </div>

          {showTaxDialog && (
            <TaxRateDialog
              open={showTaxDialog}
              onClose={() => setShowTaxDialog(false)}
              onSuccess={() => { setShowTaxDialog(false); fetchTaxRates(); }}
              tax={editingTax}
            />
          )}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Tax Rate</DialogTitle>
              </DialogHeader>
              <div>Are you sure you want to delete this tax rate? This action cannot be undone.</div>
              <DialogFooter>
                <Button variant="outline" onClick={cancelDeleteTax}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDeleteTax}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
