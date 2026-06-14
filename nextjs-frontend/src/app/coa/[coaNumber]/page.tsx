"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/env";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const fmt = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default function CoaTracePage() {
  const params = useParams();
  const coaNumber = (params as any)?.coaNumber;
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/public/coa/${coaNumber}`);
        const j = await r.json();
        if (j.success) setD(j.data);
        else setErr(true);
      } catch {
        setErr(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [coaNumber]);

  return (
    <div className="min-h-screen bg-[#F9FBFF] flex items-start justify-center p-6">
      <div className="w-full max-w-xl mt-10">
        {loading ? (
          <div className="flex justify-center py-24"><LoadingSpinner size={32} /></div>
        ) : err || !d ? (
          <div className="bg-white rounded-2xl border p-10 text-center">
            <h1 className="text-lg font-bold text-slate-900">Certificate not found</h1>
            <p className="text-sm text-muted-foreground mt-2">This COA does not exist or has not been approved yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-[#070B14] px-6 py-5 text-white">
              <div className="text-xs uppercase tracking-widest text-blue-300/70">Certificate of Analysis</div>
              <div className="text-2xl font-bold mt-1">{d.peptide}</div>
              <div className="text-blue-200/80 text-sm">{d.strength}</div>
            </div>
            <div className="p-6 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-sm font-semibold text-green-700">
                ✓ {d.overallResult === "PASS" ? "Passed" : "Approved"} · COA #{d.coaNumber}
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Row k="Lot Number" v={<span className="font-mono">{d.lotNumber}</span>} />
                <Row k="Tested By" v={d.lab} />
                <Row k="Mfg Date" v={fmt(d.mfgDate)} />
                <Row k="Expiration" v={fmt(d.expirationDate)} />
                <Row k="HPLC Purity" v={d.hplcPurity != null ? `${d.hplcPurity}%` : "—"} />
                <Row k="MS Confirmed" v={d.msConfirmed ? "Yes" : "—"} />
                <Row k="Result" v={d.overallResult} />
                <Row k="Date Received" v={fmt(d.dateReceived)} />
              </dl>
              {d.testsPerformed?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tests Performed</div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.testsPerformed.map((t: string) => (
                      <span key={t} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {d.fileUrl && (
                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-2 text-sm font-semibold text-[#4D7DF2] hover:underline">
                  📄 View full COA document
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-medium text-slate-900">{v}</dd>
    </div>
  );
}
