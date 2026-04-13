"use strict";

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Eye,
  FileText,
  Loader2,
  Search,
  Plus,
  Beaker,
  ShieldCheck,
  Activity,
  Filter,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  ChevronRight,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api, ThirdPartyReport, ThirdPartyReportCategory } from "@/lib/api";

const CATEGORY_LABELS: Record<ThirdPartyReportCategory, string> = {
  PURITY: "Purity & Net Peptide Content",
  ENDOTOXICITY: "Endotoxicity Testing",
  STERILITY: "Sterility Testing",
};

const guessFileKind = (url?: string | null) => {
  if (!url) return "none";
  const ext = url.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || "")) return "image";
  if (ext === "pdf") return "pdf";
  return "file";
};

const downloadFromApi = async (id: string, url?: string | null) => {
  if (!url) return toast.error("No file to download");
  try {
    const res = await api.get<{ downloadUrl: string }>(`/third-party-reports/${id}/download`);
    if (res.success && res.data?.downloadUrl) {
      window.location.href = res.data.downloadUrl;
    } else {
      window.open(url, "_blank");
    }
  } catch (e) {
    window.open(url, "_blank");
  }
};

const ThirdPartyTestingOverviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ThirdPartyReport[]>([]);
  const [working, setWorking] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const grouped = useMemo(() => {
    const base: Record<ThirdPartyReportCategory, ThirdPartyReport[]> = {
      PURITY: [],
      ENDOTOXICITY: [],
      STERILITY: [],
    };

    const filteredReports = reports.filter((r) =>
      !searchTerm || r.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    for (const r of filteredReports) {
      if (r?.category && base[r.category]) base[r.category].push(r);
    }
    // Sort each category alphabetically
    Object.keys(base).forEach((cat) => {
      base[cat as ThirdPartyReportCategory].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );
    });
    return base;
  }, [reports, searchTerm]);

  const counts = useMemo(() => {
    return {
      PURITY: grouped.PURITY.length,
      ENDOTOXICITY: grouped.ENDOTOXICITY.length,
      STERILITY: grouped.STERILITY.length,
    };
  }, [grouped]);

  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await api.get<ThirdPartyReport[]>("/third-party-reports");
        if (!res.success) throw new Error(res.error || "Failed to load reports");
        setReports(res.data || []);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const cards: Array<{ category: ThirdPartyReportCategory; href: string; title: string }> = [
    {
      category: "PURITY",
      href: "/third-party-testing/purity",
      title: "Purity & Net Peptide Content",
    },
    {
      category: "ENDOTOXICITY",
      href: "/third-party-testing/endotoxicity",
      title: "Endotoxicity",
    },
    {
      category: "STERILITY",
      href: "/third-party-testing/sterility",
      title: "Sterility",
    },
  ];

  return (
    <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">3rd Party Testing</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage third-party testing reports by category. Files can be previewed and downloaded.
              </p>
            </div>
          </div>

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports by name..."
                className="pl-9 bg-background w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {cards.map((c) => (
              <Link key={c.category} href={c.href} className="block group">
                <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4 hover:border-slate-300 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      {c.title}
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {loading ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          counts[c.category]
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">Reports</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* All Reports section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <FileText className="h-5 w-5 text-slate-500" />
              <div>
                <div className="font-semibold text-slate-900">All Reports</div>
                <div className="text-xs text-muted-foreground">
                  All uploaded files across Purity, Endotoxicity, and Sterility.
                </div>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Loading reports...
                </div>
              ) : reports.length === 0 ? (
                <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
                  No reports added yet.
                </div>
              ) : (
                <div className="space-y-8">
                  {(
                    ["PURITY", "ENDOTOXICITY", "STERILITY"] as ThirdPartyReportCategory[]
                  ).map((cat) => {
                    const items = grouped[cat];
                    if (items.length === 0) return null;
                    return (
                      <section key={cat} className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{CATEGORY_LABELS[cat]}</div>
                          <div className="text-sm text-muted-foreground">
                            {items.length} report{items.length === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
                          {items.map((r) => {
                            const kind = guessFileKind(r.url);
                            return (
                              <div
                                key={r.id}
                                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 overflow-hidden"
                              >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="min-w-0">
                                    <div className="text-base font-semibold truncate text-slate-900">
                                      {r.name}
                                    </div>
                                    {r.description ? (
                                      <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                        {r.description}
                                      </div>
                                    ) : (
                                      <div className="mt-1 text-sm text-muted-foreground">
                                        No description
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant="secondary" className="shrink-0">
                                    {kind === "none" ? "FILE" : kind.toUpperCase()}
                                  </Badge>
                                </div>

                                <div className="rounded-md border overflow-hidden bg-muted/20 h-44">
                                  {r.url ? (
                                    (() => {
                                      if (kind === "image") {
                                        return (
                                          <img
                                            src={r.url}
                                            alt={r.name}
                                            className="w-full h-full object-cover bg-background"
                                          />
                                        );
                                      }
                                      if (kind === "pdf") {
                                        return (
                                          <iframe
                                            src={r.url}
                                            className="w-full h-full"
                                            title={r.name}
                                          />
                                        );
                                      }
                                      return (
                                        <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
                                          Preview is not available for this file type.
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                                      No file uploaded.
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (!r.url) return toast.error("No file uploaded");
                                      openInNewTab(r.url);
                                    }}
                                    disabled={!r.url}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadFromApi(r.id, r.url)}
                                    disabled={!r.url}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default ThirdPartyTestingOverviewPage;
