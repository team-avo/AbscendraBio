"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, type Product, resolveImageUrl } from "@/lib/api";

export function ProductReorderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [items, setItems] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    // Load all products (all statuses) ordered by displayOrder asc
    const pageSize = 100; // respect API max limit
    let page = 1;
    const all: Product[] = [];
    setLoading(true);
    try {
      // 1) Primary: admin API sorted by displayOrder
      while (true) {
        const res = await api.getProducts({ page, limit: pageSize, sortBy: 'displayOrder', sortOrder: 'asc' });
        if (!res.success || !res.data) break;
        const chunk = res.data.products || [];
        all.push(...chunk);
        const pages = (res.data as any).pagination?.pages || 1;
        if (page >= pages) break;
        page += 1;
      }
      // 2) Fallback: admin API sorted by createdAt if nothing
      if (all.length === 0) {
        page = 1;
        while (true) {
          const resAlt = await api.getProducts({ page, limit: pageSize, sortBy: 'createdAt', sortOrder: 'desc' });
          if (!resAlt.success || !resAlt.data) break;
          const chunkAlt = resAlt.data.products || [];
          all.push(...chunkAlt);
          const pagesAlt = (resAlt.data as any).pagination?.pages || 1;
          if (page >= pagesAlt) break;
          page += 1;
        }
      }
      // 3) Fallback: admin API status ACTIVE only
      if (all.length === 0) {
        page = 1;
        while (true) {
          const resActive = await api.getProducts({ page, limit: pageSize, status: 'ACTIVE' as any, sortBy: 'displayOrder', sortOrder: 'asc' });
          if (!resActive.success || !resActive.data) break;
          const chunkActive = resActive.data.products || [];
          all.push(...chunkActive);
          const pagesActive = (resActive.data as any).pagination?.pages || 1;
          if (page >= pagesActive) break;
          page += 1;
        }
      }
      // 4) Fallback: storefront (public) ACTIVE list
      if (all.length === 0) {
        page = 1;
        while (true) {
          const res2 = await api.getStorefrontProducts({ page, limit: pageSize, sortBy: 'displayOrder', sortOrder: 'asc' });
          if (!res2.success || !res2.data) break;
          const chunk2 = (res2.data.products || []) as any as Product[];
          all.push(...chunk2);
          const pages2 = (res2.data as any).pagination?.pages || 1;
          if (page >= pages2) break;
          page += 1;
        }
      }
      setItems(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) loadAll(); }, [open]);

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

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const saveOrder = async () => {
    setSaving(true);
    const orders = items.map((p, idx) => ({ id: p.id, displayOrder: idx }));
    const res = await api.post(`/products/reorder`, { orders } as any);
    setSaving(false);
    if (res.success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95dvw] sm:w-[98vw] max-w-[900px] h-[90dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-lg">
        <DialogHeader className="flex-none bg-card px-4 sm:px-6 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight">Products Order</DialogTitle>
          <div className="text-sm text-muted-foreground mt-1">
            Drag and drop or use buttons to set display order.
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <div className="space-y-2 pb-4">
            {loading && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                Loading products...
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No products found.
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
                    <img
                      src={resolveImageUrl((p as any).images?.[0]?.url || '')}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm sm:text-base truncate">{p.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">#{idx + 1}</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground/60 px-1.5 py-0.5 rounded-full bg-muted border border-border/50">
                        {p.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                  <div className="sm:hidden text-xs text-muted-foreground font-medium">Order: #{idx + 1}</div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => move(idx, idx - 1)}
                      disabled={idx === 0}
                      className="h-8 px-3"
                    >
                      Up
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => move(idx, idx + 1)}
                      disabled={idx === items.length - 1}
                      className="h-8 px-3"
                    >
                      Down
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-none bg-card border-t border-border px-4 sm:px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-9 sm:h-10">
            Cancel
          </Button>
          <Button onClick={saveOrder} disabled={saving} className="h-9 sm:h-10 min-w-[100px]">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
