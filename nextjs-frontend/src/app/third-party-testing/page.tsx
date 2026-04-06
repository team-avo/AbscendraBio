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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
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
        <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">3rd Party Testing</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage third-party testing reports by category. Files can be previewed and downloaded.
              </p>
            </div>
          </div>

          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports by name..."
              className="pl-9 bg-background w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {cards.map((c) => (
              <Link key={c.category} href={c.href} className="block group">
                <Card className="hover:border-primary/50 transition-colors py-0 gap-0">
                  <CardHeader className="p-3 sm:p-4 pb-0 sm:pb-0">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      {c.title}
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {loading ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          counts[c.category]
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">Reports</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <CardTitle className="text-lg sm:text-xl">All Reports</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                All uploaded files across Purity, Endotoxicity, and Sterility.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                              <Card key={r.id} className="overflow-hidden">
                                <CardHeader className="pb-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <CardTitle className="text-base truncate">
                                        {r.name}
                                      </CardTitle>
                                      {r.description ? (
                                        <CardDescription className="mt-1 line-clamp-2">
                                          {r.description}
                                        </CardDescription>
                                      ) : (
                                        <CardDescription className="mt-1">
                                          No description
                                        </CardDescription>
                                      )}
                                    </div>
                                    <Badge variant="secondary" className="shrink-0">
                                      {kind === "none" ? "FILE" : kind.toUpperCase()}
                                    </Badge>
                                  </div>
                                </CardHeader>

                                <CardContent className="pt-0">
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
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default ThirdPartyTestingOverviewPage;
