'use client';

import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface BulkInventoryDialogProps {
  open: boolean;
  onClose: () => void;
  items: Array<{ id: string; quantity: number; reservedQty?: number; lowStockAlert: number; variant: { sku: string; name: string; product: { name: string } }; location: { name: string; id?: string } }>;
  mode: 'adjust' | 'movement';
  onSuccess?: () => void;
}

export function BulkInventoryDialog({ open, onClose, items, mode, onSuccess }: BulkInventoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('Bulk update');

  // Adjust mode state
  const [adjustType, setAdjustType] = useState<'set' | 'delta'>('delta');
  const [adjustValue, setAdjustValue] = useState<string>('0');

  // Movement mode state
  const [movementType, setMovementType] = useState<'PURCHASE'|'SALE'|'RETURN'|'ADJUSTMENT_IN'|'ADJUSTMENT_OUT'|'TRANSFER_IN'|'TRANSFER_OUT'>('ADJUSTMENT_IN');
  const [movementQuantity, setMovementQuantity] = useState<string>('1');

  // Optional transfer target location (applies to all selected)
  const [locations, setLocations] = useState<Array<{id: string; name: string}>>([]);
  const [targetLocationId, setTargetLocationId] = useState<string>('');

  // Load locations once dialog opens
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const resp = await api.get('/locations');
        if (resp?.success) setLocations(resp.data);
      } catch {}
    })();
  }, [open]);

  const summary = useMemo(() => {
    return items.map(i => ({
      id: i.id,
      sku: i.variant.sku,
      product: i.variant.product.name,
      variant: i.variant.name,
      location: i.location.name,
      available: (i.quantity || 0) - (i.reservedQty || 0)
    }));
  }, [items]);

  const handleSubmit = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      // If a target location is selected, perform transfer instead
      if (targetLocationId) {
        const payloadItems = items.map(i => ({ id: i.id }));
        const resp = await api.post('/inventory/bulk/transfer', { items: payloadItems, targetLocationId, reason });
        if (!resp?.success) throw new Error(resp?.error || 'Bulk transfer failed');
      } else if (mode === 'adjust') {
        const payloadItems = items.map(i => adjustType === 'set' ? { id: i.id, quantity: parseInt(adjustValue || '0', 10) } : { id: i.id, delta: parseInt(adjustValue || '0', 10) });
        const resp = await api.post('/inventory/bulk/adjust', { items: payloadItems, reason });
        if (!resp?.success) throw new Error(resp?.error || 'Bulk adjust failed');
      } else {
        // movement
        const qty = parseInt(movementQuantity || '1', 10);
        const payloadItems = items.map(i => ({ variantId: (i as any).variantId || undefined, locationId: (i as any).location?.id || undefined, quantity: qty }));
        // If any inventory row doesn't carry variantId/locationId on client shape, fetch minimal from server would be needed.
        // For now, we fall back to server to infer via inventory id if needed.
        const resp = await api.post('/inventory/bulk/movement', { items: payloadItems, type: movementType, reason });
        if (!resp?.success) throw new Error(resp?.error || 'Bulk movement failed');
      }
      onSuccess && onSuccess();
      onClose();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
       <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>{mode === 'adjust' ? 'Bulk Adjust Inventory' : 'Bulk Record Movement'}</DialogTitle>
          <DialogDescription>
            {mode === 'adjust' ? 'Apply a set or delta quantity across all selected rows.' : 'Record the same movement type and quantity across all selected rows.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="rounded-md border">
            <div className="max-h-48 overflow-auto p-3 text-sm">
              {summary.map((row) => (
                <div key={row.id} className="flex items-center justify-between border-b last:border-b-0 py-1">
                  <div className="font-mono">{row.sku}</div>
                  <div className="truncate flex-1 px-3">{row.product} — {row.variant}</div>
                  <div className="w-40 text-right">{row.location} • Avl: {row.available}</div>
                </div>
              ))}
            </div>
          </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="sm:col-span-2">
               <Label>Target Location (optional)</Label>
               <Select value={targetLocationId} onValueChange={(v: any) => setTargetLocationId(v)}>
                 <SelectTrigger className="mt-1"><SelectValue placeholder="Do not change location" /></SelectTrigger>
                 <SelectContent>
                   {locations.map(loc => (
                     <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
            {mode === 'adjust' ? (
              <>
                <div>
                  <Label>Adjust Type</Label>
                  <Select value={adjustType} onValueChange={(v: any) => setAdjustType(v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delta">Adjust by delta (+/-)</SelectItem>
                      <SelectItem value="set">Set absolute quantity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{adjustType === 'set' ? 'Quantity' : 'Delta'}</Label>
                  <Input type="number" className="mt-1" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Movement Type</Label>
                  <Select value={movementType} onValueChange={(v: any) => setMovementType(v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PURCHASE">Purchase (Inbound)</SelectItem>
                      <SelectItem value="RETURN">Return (Inbound)</SelectItem>
                      <SelectItem value="ADJUSTMENT_IN">Adjustment In</SelectItem>
                      <SelectItem value="TRANSFER_IN">Transfer In</SelectItem>
                      <SelectItem value="SALE">Sale (Outbound)</SelectItem>
                      <SelectItem value="ADJUSTMENT_OUT">Adjustment Out</SelectItem>
                      <SelectItem value="TRANSFER_OUT">Transfer Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" className="mt-1" value={movementQuantity} onChange={(e) => setMovementQuantity(e.target.value)} />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <Label>Reason</Label>
              <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Applying...</>) : 'Apply to Selected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


