"use client";


import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Barlow } from "next/font/google";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Eye, Search } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

type ThirdPartyReportCategory = "PURITY" | "ENDOTOXICITY" | "STERILITY";

type ThirdPartyReport = {
  id: string;
  category: ThirdPartyReportCategory;
  name: string;
  description?: string | null;
  url?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const CATEGORY_LABELS: Record<ThirdPartyReportCategory, string> = {
  PURITY: "Purity & Net Peptide Content",
  ENDOTOXICITY: "Endotoxicity",
  STERILITY: "Sterility",
};

const CATEGORY_FILTERS: Array<{ key: "ALL" | ThirdPartyReportCategory; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PURITY", label: "Purity & Net Peptide Content" },
  { key: "ENDOTOXICITY", label: "Endotoxicity" },
  { key: "STERILITY", label: "Sterility" },
];

function guessFileKind(url?: string | null): "pdf" | "image" | "other" | "none" {
  if (!url) return "none";
  const u = url.toLowerCase();
  if (u.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?|#|$)/)) return "image";
  if (u.match(/\.(pdf)(\?|#|$)/)) return "pdf";
  return "other";
}

function downloadUrl(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getFilenameFromUrl(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last || "download";
  } catch {
    const last = url.split("?")[0].split("#")[0].split("/").filter(Boolean).pop();
    return last || "download";
  }
}

async function forceDownload(url: string, filename?: string) {
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    downloadUrl(objectUrl, filename || getFilenameFromUrl(url));
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  } catch {
    // Fallback: open in new tab if we can't fetch (e.g. CORS)
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function downloadFromApi(reportId: string, fallbackUrl?: string | null) {
  try {
    const res = await api.get<{ url: string }>(`/public-third-party-reports/${reportId}/download-url`);
    const signed = res.success ? res.data?.url : null;
    if (!signed) throw new Error(res.error || "Failed to get download URL");
    window.open(signed, "_blank", "noopener,noreferrer");
  } catch {
    if (fallbackUrl) {
      await forceDownload(fallbackUrl);
    } else {
      toast.error("No file available");
    }
  }
}

export default function LandingThirdPartyTestingPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ThirdPartyReport[]>([]);
  const [filter, setFilter] = useState<"ALL" | ThirdPartyReportCategory>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get<ThirdPartyReport[]>("/public-third-party-reports");
        if (res.success) {
          setReports(res.data || []);
        } else {
          toast.error(res.error || "Failed to load reports");
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    let result = reports;
    if (filter !== "ALL") {
      result = result.filter((r) => r.category === filter);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(lower) ||
          (r.description && r.description.toLowerCase().includes(lower)),
      );
    }
    // Alphabetical sort by name
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [reports, filter, searchTerm]);

  const grouped = useMemo(() => {
    const base: Record<ThirdPartyReportCategory, ThirdPartyReport[]> = {
      PURITY: [],
      ENDOTOXICITY: [],
      STERILITY: [],
    };
    for (const r of filtered) base[r.category].push(r);
    return base;
  }, [filtered]);

  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="force-light min-h-screen bg-white text-ink">

      <div className="bg-gradient-to-r from-gray-50 to-gray-100 py-14 sm:py-18">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className={`text-5xl font-black mb-4 text-foreground ${barlow.className}`}>
              Certificates of Analysis
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              View and download our COAs — independent third-party lab reports (purity, endotoxicity, and sterility) for every batch.
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col gap-6 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              aria-label="Search test reports"
              placeholder="Search reports by name or description..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Browse by category</div>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map((c) => {
                  const active = filter === c.key;
                  return (
                    <Button
                      key={c.key}
                      variant={active ? "default" : "outline"}
                      onClick={() => setFilter(c.key)}
                      className={active ? "bg-[#043061] text-white hover:bg-[#0b4f96]" : "border-gray-300 text-gray-700 hover:bg-gray-50"}
                    >
                      {c.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {loading ? "Loading…" : `${filtered.length} report${filtered.length === 1 ? "" : "s"}`}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <LoadingSpinner size={48} className="mx-auto mb-4 border-gray-900" />
              <p className="text-gray-600">Loading reports...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed rounded-lg p-10 text-center text-gray-600">
            No reports available.
          </div>
        ) : (
          <div className="space-y-10">
            {(Object.keys(CATEGORY_LABELS) as ThirdPartyReportCategory[]).map((cat) => {
              const items = grouped[cat];
              if (items.length === 0) return null;
              return (
                <section key={cat} className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className={`text-2xl font-extrabold text-gray-900 ${barlow.className}`}>
                      {CATEGORY_LABELS[cat]}
                    </h2>
                    <div className="text-sm text-gray-600">{items.length} report{items.length === 1 ? "" : "s"}</div>
                  </div>

                  <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((r) => {
                      const kind = guessFileKind(r.url);
                      return (
                        <Card key={r.id} className="overflow-hidden border-gray-200 shadow-sm">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <CardTitle className="text-base truncate">{r.name}</CardTitle>
                                {r.description ? (
                                  <CardDescription className="mt-1 line-clamp-2">
                                    {r.description}
                                  </CardDescription>
                                ) : (
                                  <CardDescription className="mt-1">No description</CardDescription>
                                )}
                              </div>
                              <Badge variant="secondary" className="shrink-0">
                                {kind === "none" ? "FILE" : kind.toUpperCase()}
                              </Badge>
                            </div>
                          </CardHeader>

                          <CardContent className="pt-0">
                            <div className="rounded-md border border-gray-200 bg-gray-50 overflow-hidden h-44">
                              {r.url ? (
                                (() => {
                                  if (kind === "image") {
                                    return (
                                      <img
                                        src={r.url}
                                        alt={r.name}
                                        className="w-full h-full object-cover bg-white"
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
                                    <div className="h-full w-full flex items-center justify-center text-sm text-gray-600 p-4 text-center">
                                      Preview is not available for this file type.
                                    </div>
                                  );
                                })()
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-sm text-gray-600">
                                  No file available.
                                </div>
                              )}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => (r.url ? openInNewTab(r.url) : toast.error("No file available"))}
                                disabled={!r.url}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFromApi(r.id, r.url)}
                                disabled={!r.url}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {loading && (
        <div className="sr-only" aria-live="polite">
          <LoadingSpinner size={16} />
        </div>
      )}
    </div>
  );
}
