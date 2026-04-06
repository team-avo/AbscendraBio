'use client';

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
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
        <div className="space-y-4 sm:space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2 sm:px-0">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Tax Settings</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Configure tax rates and rules for your store</p>
            </div>
            <Button className="w-full sm:w-auto h-10 sm:h-11 shadow-sm">Save Changes</Button>
          </div>

          <Card className="shadow-sm border-muted-foreground/10">
            <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
              <CardTitle className="text-lg sm:text-xl">Tax Configuration</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Configure tax rates and rules for your store</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3">
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
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted-foreground/10">
            <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b">
              <CardTitle className="text-lg sm:text-xl">Tax Rates</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <div className="rounded-md border overflow-x-auto -mx-2 sm:mx-0">
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
              <Button className="w-full sm:w-auto mt-4 h-9 sm:h-10 px-6 shadow-sm" onClick={handleAddTax}>
                <Plus className="h-4 w-4 mr-2" />
                Add Tax Rate
              </Button>
            </CardContent>
          </Card>
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