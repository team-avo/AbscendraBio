"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { FileJson, Clock, History } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

type SyncFilter = "ALL" | "SUCCESS" | "FAILED" | "NO_CHANGE" | "SKIPPED";

const PAGE_SIZE = 50;

const FILTERS: Array<{ label: string; value: SyncFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Success", value: "SUCCESS" },
  { label: "Failed", value: "FAILED" },
  { label: "No change", value: "NO_CHANGE" },
  { label: "Skipped", value: "SKIPPED" },
];

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "SUCCESS":
      return "default";
    case "FAILED":
      return "destructive";
    case "SKIPPED":
      return "outline";
    default:
      return "secondary"; // NO_CHANGE
  }
}

export function LabelSyncLogs() {
  const [data, setData] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<SyncFilter>("ALL");

  const fetchData = async (pageNum = page, syncFilter = filter) => {
    setLoading(true);
    try {
      const res = await api.getLabelSyncLogs({
        page: pageNum,
        limit: PAGE_SIZE,
        ...(syncFilter !== "ALL" ? { syncStatus: syncFilter } : {}),
      });
      if (res.success && res.data) {
        setData(res.data.data || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalRecords(res.data.pagination?.total || 0);
      } else {
        toast.error("Failed to load label sync logs");
      }
    } catch (err) {
      toast.error("An error occurred while loading label sync logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter]);

  const onFilter = (value: SyncFilter) => {
    setPage(1);
    setFilter(value);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold text-slate-900">Label Sync Logs</div>
            <div className="text-xs text-muted-foreground">
              Every hourly tracking-sync attempt and its outcome.
            </div>
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          Total: {totalRecords}
        </Badge>
      </div>

      {/* Filter pills */}
      <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              filter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 text-muted-foreground hover:bg-muted border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[160px] font-semibold">Order</TableHead>
              <TableHead className="font-semibold">Transition</TableHead>
              <TableHead className="font-semibold">Result</TableHead>
              <TableHead className="font-semibold">Label ID</TableHead>
              <TableHead className="font-semibold">SS Status</TableHead>
              <TableHead className="font-semibold">When</TableHead>
              <TableHead className="text-right font-semibold">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <LoadingSpinner size={32} />
                    <p className="text-sm font-medium text-muted-foreground">Loading sync logs...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">
                  No label sync logs yet. They are written by the hourly tracking cron.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">{row.orderNumber}</TableCell>
                  <TableCell className="text-xs">
                    <span className="font-mono text-muted-foreground">{row.statusBefore}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    <span className="font-mono font-semibold">{row.statusAfter || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.syncStatus)} className="px-2">
                      {row.syncStatus}
                    </Badge>
                    {row.failureReason ? (
                      <div className="text-[11px] text-destructive mt-1 max-w-[220px] truncate" title={row.failureReason}>
                        {row.failureReason}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.shipstationLabelId ? (
                      <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded border border-border/50">
                        {row.shipstationLabelId}
                      </code>
                    ) : (
                      <span className="text-xs text-muted-foreground/30">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {row.shipstationStatus || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Clock className="h-3.5 w-3.5 opacity-50" />
                      {format(new Date(row.createdAt), "MMM d, HH:mm:ss")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                          <FileJson className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
                        <DialogHeader className="pb-4 border-b">
                          <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileJson className="h-6 w-6 text-primary" />
                            Sync Detail — {row.orderNumber}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-auto mt-4 rounded-xl bg-[#0f1115] border border-border p-5">
                          <pre className="text-[12px] leading-relaxed text-blue-300/90 font-mono">
                            {JSON.stringify(row.apiResponseJson ?? row, null, 2)}
                          </pre>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="p-4 border-t flex justify-center bg-muted/5">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

export default LabelSyncLogs;
