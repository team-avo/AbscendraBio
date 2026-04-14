"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Search,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

type TypeFilter = "ALL" | ThirdPartyReportCategory;

const ThirdPartyTestingOverviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ThirdPartyReport[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

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
    Object.keys(base).forEach((cat) => {
      base[cat as ThirdPartyReportCategory].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );
    });
    return base;
  }, [reports, searchTerm]);

  const counts = useMemo(() => ({
    PURITY: grouped.PURITY.length,
    ENDOTOXICITY: grouped.ENDOTOXICITY.length,
    STERILITY: grouped.STERILITY.length,
  }), [grouped]);

  const totalCount = counts.PURITY + counts.ENDOTOXICITY + counts.STERILITY;

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
    { category: "PURITY", href: "/third-party-testing/purity", title: "Purity & Net Peptide Content" },
    { category: "ENDOTOXICITY", href: "/third-party-testing/endotoxicity", title: "Endotoxicity" },
    { category: "STERILITY", href: "/third-party-testing/sterility", title: "Sterility" },
  ];

  const typePills: Array<{ label: string; value: TypeFilter }> = [
    { label: "All", value: "ALL" },
    { label: "Purity", value: "PURITY" },
    { label: "Endotoxicity", value: "ENDOTOXICITY" },
    { label: "Sterility", value: "STERILITY" },
  ];

  const visibleCategories = (
    ["PURITY", "ENDOTOXICITY", "STERILITY"] as ThirdPartyReportCategory[]
  ).filter((cat) => typeFilter === "ALL" || typeFilter === cat);

  return (
    <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-5">
          {/* Dark hero strip */}
          <div className="bg-[#070B14] rounded-2xl mx-1 sm:mx-0 overflow-hidden relative">
            {/* Grid texture */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
                backgroundSize: "32px 32px",
              }}
            />
            {/* Blue glow */}
            <div className="absolute top-0 left-1/4 w-72 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative px-5 pt-5 pb-4 space-y-3">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">3rd Party Testing</h1>
                  <p className="text-blue-200/60 text-xs mt-0.5">Lab certifications and purity verification reports</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-400/20 rounded-full px-3 py-1.5">
                    <FlaskConical className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-300">
                      {loading ? "—" : `${reports.length} Report${reports.length !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Type filter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {typePills.map((pill) => (
                  <button
                    key={pill.value}
                    onClick={() => setTypeFilter(pill.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      typeFilter === pill.value
                        ? "bg-blue-500 text-white"
                        : "bg-white/8 text-blue-200/70 hover:bg-white/15 hover:text-white border border-white/10"
                    }`}
                  >
                    {pill.label}
                    {pill.value !== "ALL" && !loading && (
                      <span className="ml-1 opacity-70">
                        {counts[pill.value as ThirdPartyReportCategory]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Search filter row */}
              <div className="pb-1">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300/50" />
                  <Input
                    placeholder="Search reports by name..."
                    className="pl-8 h-8 text-sm bg-white/5 border-white/15 text-white placeholder:text-blue-200/40 focus-visible:ring-blue-400/30 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Category navigation cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mx-1 sm:mx-0">
            {cards.map((c) => (
              <Link key={c.category} href={c.href} className="block group">
                <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4 hover:border-gray-300 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      {c.title}
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {loading ? <span className="text-muted-foreground">—</span> : counts[c.category]}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">Reports</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* All Reports table panel */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
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
                  {visibleCategories.map((cat) => {
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
                                className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5 overflow-hidden"
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
                                      <div className="mt-1 text-sm text-muted-foreground">No description</div>
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
