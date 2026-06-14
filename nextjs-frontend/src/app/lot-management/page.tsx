"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-sm">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default function LotDashboardPage() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.lmGetDashboard();
        if (r.success) setD(r.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;
  if (!d) return <div className="text-muted-foreground py-10 text-center">Failed to load dashboard.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">COA Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Stat label="Total COAs" value={d.coa.total} />
          <Stat label="Approved" value={d.coa.approved} />
          <Stat label="Pending Review" value={d.coa.pendingReview} />
          <Stat label="Awaiting Results" value={d.coa.awaitingResults} />
          <Stat label="Rejected" value={d.coa.rejected} />
          <Stat label="Pass Rate" value={`${d.coa.passRate}%`} />
          <Stat label="Avg HPLC Purity" value={`${d.coa.avgHplcPurity}%`} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Lots / Inventory</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Stat label="Total Lots" value={d.lots.total} />
          <Stat label="In Testing" value={d.lots.inTesting} />
          <Stat label="Released" value={d.lots.released} />
          <Stat label="Quarantine" value={d.lots.quarantine} />
          <Stat label="Rej / Exp / Recall" value={d.lots.rejectedExpiredRecalled} />
          <Stat label="Expiring 90d" value={d.lots.expiringWithin90} />
          <Stat label="Expired" value={d.lots.expired} />
          <Stat label="Unique Orders" value={d.lots.uniqueOrders} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 font-semibold text-slate-900">COAs by Lab</div>
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Lab</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Pass</TableHead>
              <TableHead className="text-center">Fail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.byLab.map((l: any) => (
              <TableRow key={l.lab}>
                <TableCell className="font-medium">{l.lab}</TableCell>
                <TableCell className="text-center">{l.total}</TableCell>
                <TableCell className="text-center text-green-600">{l.pass}</TableCell>
                <TableCell className="text-center text-red-600">{l.fail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
