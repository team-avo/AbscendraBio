"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, type Product, resolveImageUrl } from "@/lib/api";

export function PopularReorderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [items, setItems] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const loadPopular = async () => {
    const pageSize = 100;
    let page = 1;
    const popular: Product[] = [];
    setLoading(true);
    try {
      // Load only popular products (from admin API filter when available, else fallback to storefront)
      while (true) {
        const res = await api.getProducts({ page, limit: pageSize, sortBy: 'displayOrder', sortOrder: 'asc' });
        if (!res.success || !res.data) break;
        const chunk = (res.data.products || []).filter(p => (p as any).isPopular);
        popular.push(...chunk);
        const pages = (res.data as any).pagination?.pages || 1;
        if (page >= pages) break;
        page += 1;
      }
      // Fallback: storefront popular flag
      if (popular.length === 0) {
        page = 1;
        while (true) {
          const res2 = await api.getStorefrontProducts({ page, limit: pageSize, isPopular: true, sortBy: 'displayOrder', sortOrder: 'asc' });
          if (!res2.success || !res2.data) break;
          const chunk2 = (res2.data.products || []) as any as Product[];
          popular.push(...chunk2);
          const pages2 = (res2.data as any).pagination?.pages || 1;
          if (page >= pages2) break;
          page += 1;
        }
      }
      setItems(popular);

      // Also load all ACTIVE products to allow toggling in/out of popular list
      page = 1;
      const all: Product[] = [];
      while (true) {
        const resAll = await api.getProducts({ page, limit: pageSize, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' });
        if (!resAll.success || !resAll.data) break;
        all.push(...(resAll.data.products || []));
        const pagesAll = (resAll.data as any).pagination?.pages || 1;
        if (page >= pagesAll) break;
        page += 1;
      }
      setAllProducts(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) loadPopular(); }, [open]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setItems(next);
  };

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    const from = Number(e.dataTransfer.getData('text/plain'));
    move(from, index);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); };

  const toggleProduct = (p: Product) => {
    const exists = items.find(x => x.id === p.id);
    if (exists) {
      setItems(items.filter(x => x.id !== p.id));
    } else {
      setItems([...items, p]);
    }
  };

  const saveOrder = async () => {
    setSaving(true);
    const orders = items.map((p, idx) => ({ id: p.id, displayOrder: idx }));
    const res = await api.post(`/products/popular/reorder`, { orders } as any);
    setSaving(false);
    if (res.success) onOpenChange(false);
  };

  const availableToAdd = allProducts.filter(p => !items.some(i => i.id === p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95dvw] sm:w-[98vw] max-w-[900px] h-[90dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-lg">
        <DialogHeader className="flex-none bg-card px-4 sm:px-6 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight">Popular Products</DialogTitle>
          <div className="text-sm text-muted-foreground mt-1">
            Reorder popular products or add new ones to the list.
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
          {/* Current popular order */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Current Popular List
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {items.length}
              </span>
            </h3>
            <div className="space-y-2">
              {loading && <div className="text-sm text-muted-foreground text-center py-4">Loading popular products...</div>}
              {!loading && items.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg bg-muted/30">
                  No popular products yet.
                </div>
              )}
              {items.map((p, idx) => (
                <div
                  key={p.id}
                  className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-border rounded-lg p-3 bg-card text-foreground cursor-grab active:cursor-grabbing transition-colors hover:bg-muted/50"
                  draggable
                  onDragStart={(e) => onDragStart(e, idx)}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, idx)}
                  aria-grabbed={true}
                >
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto flex-1">
                    <div className="flex-none w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden bg-muted border border-border">
                      <img src={resolveImageUrl((p as any).images?.[0]?.url || '')} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm sm:text-base truncate">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">#{idx + 1}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground/60">{p.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <div className="flex items-center gap-1">
                      <Button variant="secondary" size="sm" onClick={() => move(idx, idx - 1)} disabled={idx === 0} className="h-8 px-2">Up</Button>
                      <Button variant="secondary" size="sm" onClick={() => move(idx, idx + 1)} disabled={idx === items.length - 1} className="h-8 px-2">Down</Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggleProduct(p)} className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add more products */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-sm font-semibold mb-3">Add Available Products</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-2">
              {availableToAdd.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border border-border rounded-lg p-2.5 bg-card/50 hover:bg-card transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-none w-8 h-8 rounded-md overflow-hidden bg-muted border border-border">
                      <img src={resolveImageUrl((p as any).images?.[0]?.url || '')} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="truncate text-sm font-medium">{p.name}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggleProduct(p)} className="h-8 px-3">
                    Add
                  </Button>
                </div>
              ))}
              {availableToAdd.length === 0 && !loading && (
                <div className="col-span-full text-center py-6 text-xs text-muted-foreground italic bg-muted/20 rounded-lg">
                  All active products are already in the popular list.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-none bg-card border-t border-border px-4 sm:px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-9 sm:h-10">
            Cancel
          </Button>
          <Button onClick={saveOrder} disabled={saving} className="h-9 sm:h-10 min-w-[120px]">
            {saving ? 'Saving…' : 'Save Popular Order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PopularReorderDialog;
