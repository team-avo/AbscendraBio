import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Country, State } from 'country-state-city';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings } from 'lucide-react';

interface TaxRateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tax?: any;
}

export function TaxRateDialog({ open, onClose, onSuccess, tax }: TaxRateDialogProps) {
  const isEdit = !!tax;
  const [country, setCountry] = useState(tax?.country || "US");
  const [state, setState] = useState(tax?.state || "");
  const [rate, setRate] = useState(tax?.rate?.toString() || "");
  const [type, setType] = useState(tax?.type || "State Tax");
  const [isActive, setIsActive] = useState(tax?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  // Country/State options
  const countries = Country.getAllCountries();
  const states = State.getStatesOfCountry(country);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { country, state: state || null, rate: parseFloat(rate), type, isActive };
      let res;
      if (isEdit) {
        res = await api.put(`/tax-rates/${tax.id}`, payload);
      } else {
        res = await api.post(`/tax-rates`, payload);
      }
      if (res.success) {
        toast.success(isEdit ? "Tax rate updated" : "Tax rate created");
        onSuccess();
      } else {
        toast.error(res.error || "Failed to save tax rate");
      }
    } catch (e) {
      toast.error("Failed to save tax rate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 rounded-2xl overflow-hidden border-gray-200">
        <div className="bg-[#043061] px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#5A9ADA]/25 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">Tax Rate</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">{isEdit ? "Update existing tax rate" : "Add a new tax rate"}</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-6 space-y-4">
            <div className="font-semibold mb-2">Tax settings :</div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={val => { setCountry(val); setState(''); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(c => (
                    <SelectItem key={c.isoCode} value={c.isoCode}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={state} onValueChange={setState} disabled={states.length === 0}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {states.length === 0 ? (
                    <SelectItem value="">No states</SelectItem>
                  ) : (
                    states.map(s => (
                      <SelectItem key={s.isoCode} value={s.isoCode}>{s.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={type} onChange={e => setType(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Rate (%)</Label>
              <Input value={rate} onChange={e => setRate(e.target.value)} type="number" min="0" step="0.01" required />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#043061] hover:bg-[#0b4f96] text-white rounded-xl">{isEdit ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 