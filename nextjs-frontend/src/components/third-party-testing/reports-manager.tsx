"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, getToken } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Download,
  Eye,
  FileUp,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { ThirdPartyReport, ThirdPartyReportCategory } from "@/lib/api";
import logger from '@/lib/logger';

const CATEGORY_LABELS: Record<ThirdPartyReportCategory, string> = {
  PURITY: "Purity & Net Peptide Content",
  ENDOTOXICITY: "Endotoxicity",
  STERILITY: "Sterility",
};

const CATEGORY_OPTIONS: Array<{ value: ThirdPartyReportCategory; label: string }> = [
  { value: "PURITY", label: "Purity & Net Peptide Content" },
  { value: "ENDOTOXICITY", label: "Endotoxicity" },
  { value: "STERILITY", label: "Sterility" },
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
    const res = await api.get<{ url: string }>(`/third-party-reports/${reportId}/download-url`);
    const signed = res.success ? res.data?.url : null;
    if (!signed) throw new Error(res.error || "Failed to get download URL");
    window.open(signed, "_blank", "noopener,noreferrer");
  } catch {
    if (fallbackUrl) {
      await forceDownload(fallbackUrl);
    } else {
      toast.error("No file uploaded");
    }
  }
}

async function putFormData(endpoint: string, formData: FormData) {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const baseUrl =
    typeof window === "undefined"
      ? process.env.SERVER_API_URL || "http://api:3001/api"
      : API_BASE_URL;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "PUT",
    headers,
    credentials: 'include',
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`
    );
  }
  return data;
}

async function uploadThirdPartyReportFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.postFormData<{ url: string; key: string; filename: string }>(
    "/third-party-reports/upload",
    formData
  );
  if (!res.success || !res.data?.url) {
    throw new Error(res.error || "Upload failed");
  }
  return res.data;
}

export function ThirdPartyReportsManager(props: {
  category: ThirdPartyReportCategory;
  title?: string;
  description?: string;
  backHref?: string;
}) {
  const { category } = props;

  const pageTitle = props.title || `${CATEGORY_LABELS[category]} Reports`;
  const pageDescription =
    props.description ||
    "Upload reports and keep them organized. Files can be previewed and downloaded.";

  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [reports, setReports] = useState<ThirdPartyReport[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState<ThirdPartyReportCategory>(category);
  const [createName, setCreateName] = useState("");
  const [createDescriptionText, setCreateDescriptionText] = useState("");
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createProductLinks, setCreateProductLinks] = useState<Array<{ id: string; name: string }>>([]);
  const [createVariantLinks, setCreateVariantLinks] = useState<Array<{ id: string; name: string; sku: string; productName?: string }>>([]);
  const createFileInputRef = useRef<HTMLInputElement | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ThirdPartyReport | null>(null);
  const [editCategory, setEditCategory] = useState<ThirdPartyReportCategory>(category);
  const [editName, setEditName] = useState("");
  const [editDescriptionText, setEditDescriptionText] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [productResults, setProductResults] = useState<any[]>([]);
  const [variantResults, setVariantResults] = useState<any[]>([]);
  const [reportSearchTerm, setReportSearchTerm] = useState("");

  const filteredReports = useMemo(() => {
    let result = reports;
    if (reportSearchTerm) {
      const lower = reportSearchTerm.toLowerCase();
      result = result.filter((r) => r.name?.toLowerCase().includes(lower));
    }
    // Alphabetical sort by name
    return [...result].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [reports, reportSearchTerm]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get<ThirdPartyReport[]>(`/third-party-reports?category=${category}`);
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

  useEffect(() => {
    fetchReports();
    setCreateCategory(category);
    setEditCategory(category);
  }, [category]);

  const resetCreateForm = () => {
    setCreateCategory(category);
    setCreateName("");
    setCreateDescriptionText("");
    setCreateFile(null);
    setCreateProductLinks([]);
    setCreateVariantLinks([]);
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      setWorking(true);
      let url: string | null = null;
      if (createFile) {
        const uploaded = await uploadThirdPartyReportFile(createFile);
        url = uploaded.url;
      }

      const res = await api.post<ThirdPartyReport>("/third-party-reports", {
        category: createCategory,
        name: createName.trim(),
        description: createDescriptionText.trim()
          ? createDescriptionText.trim()
          : null,
        url,
      });

      if (res.success) {
        const reportId = res.data!.id;

        // Link products and variants if any selected
        if (createProductLinks.length > 0 || createVariantLinks.length > 0) {
          await api.linkReportToItems(reportId, {
            productIds: createProductLinks.map(p => p.id),
            variantIds: createVariantLinks.map(v => v.id),
          });
        }

        toast.success("Report created");
        setCreateOpen(false);
        resetCreateForm();
        fetchReports();
      } else {
        toast.error(res.error || "Failed to create report");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to create report");
    } finally {
      setWorking(false);
    }
  };

  const openEdit = (r: ThirdPartyReport) => {
    setEditing(r);
    setEditCategory(r.category || category);
    setEditName(r.name || "");
    setEditDescriptionText(r.description || "");
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      setWorking(true);
      const res = await api.put<ThirdPartyReport>(`/third-party-reports/${editing.id}`, {
        category: editCategory,
        name: editName.trim(),
        description: editDescriptionText.trim()
          ? editDescriptionText.trim()
          : null,
      });

      if (res.success) {
        toast.success("Report updated");
        setEditOpen(false);
        setEditing(null);
        fetchReports();
      } else {
        toast.error(res.error || "Failed to update report");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update report");
    } finally {
      setWorking(false);
    }
  };

  const handleReplaceFile = async (reportId: string, file: File) => {
    try {
      setWorking(true);
      const formData = new FormData();
      formData.append("file", file);
      await putFormData(`/third-party-reports/${reportId}/file`, formData);
      toast.success("File replaced");
      fetchReports();
    } catch (e: any) {
      toast.error(e?.message || "Failed to replace file");
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteFile = async (reportId: string) => {
    try {
      setWorking(true);
      const res = await api.delete(`/third-party-reports/${reportId}/file`);
      if (res.success) {
        toast.success("File deleted");
        fetchReports();
      } else {
        toast.error(res.error || "Failed to delete file");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete file");
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      setWorking(true);
      const res = await api.delete(`/third-party-reports/${reportId}`);
      if (res.success) {
        toast.success("Report deleted");
        fetchReports();
      } else {
        toast.error(res.error || "Failed to delete report");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete report");
    } finally {
      setWorking(false);
    }
  };

  const categoryBadge = useMemo(() => CATEGORY_LABELS[category], [category]);

  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const searchItems = async (query: string = "") => {
    // If query is provided but too short, don't search (allow empty string for pre-load)
    if (query && query.length < 2) return;

    try {
      setSearching(true);
      const res = await api.getProducts({
        search: query || undefined,
        limit: 15,
        status: 'ACTIVE'
      });
      if (res.success) {
        const products = res.data?.products || [];
        setProductResults(products);

        // Extract variants
        const variants: any[] = [];
        products.forEach((p: any) => {
          (p.variants || []).forEach((v: any) => {
            if (
              !query ||
              v.name?.toLowerCase().includes(query.toLowerCase()) ||
              v.sku?.toLowerCase().includes(query.toLowerCase())
            ) {
              variants.push({ ...v, productName: p.name });
            }
          });
        });
        setVariantResults(variants);
      }
    } catch (e) {
      logger.error("Search failed", { error: e });
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchItems(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pre-load when dialogs open
  useEffect(() => {
    if (createOpen || editOpen) {
      searchItems("");
    }
  }, [createOpen, editOpen]);

  const handleLink = async (reportId: string, itemType: 'product' | 'variant', itemId: string) => {
    try {
      setWorking(true);
      const res = await api.linkReportToItems(reportId, {
        productIds: itemType === 'product' ? [itemId] : [],
        variantIds: itemType === 'variant' ? [itemId] : [],
      });
      if (res.success) {
        toast.success(`Linked to ${itemType}`);
        // Refresh the linking report state to show updated links
        const updatedRes = await api.get<ThirdPartyReport>(`/third-party-reports/${reportId}`);
        if (updatedRes.success) setEditing(updatedRes.data!);
        fetchReports();
      } else {
        toast.error(res.error || "Linking failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Linking failed");
    } finally {
      setWorking(false);
    }
  };

  const handleUnlink = async (reportId: string, itemType: 'product' | 'variant', itemId: string) => {
    try {
      setWorking(true);
      const res = await api.unlinkReportFromItems(reportId, {
        productIds: itemType === 'product' ? [itemId] : [],
        variantIds: itemType === 'variant' ? [itemId] : [],
      });
      if (res.success) {
        toast.success(`Unlinked from ${itemType}`);
        const updatedRes = await api.get<ThirdPartyReport>(`/third-party-reports/${reportId}`);
        if (updatedRes.success) setEditing(updatedRes.data!);
        fetchReports();
      } else {
        toast.error(res.error || "Unlinking failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Unlinking failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-0">

      {/* ════════ DARK HERO STRIP ════════ */}
      <div className="relative bg-mist border border-line border-t-2 border-t-[#5A9ADA] rounded-2xl mx-1 sm:mx-0 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-[#5A9ADA]/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {props.backHref && (
                <Link href={props.backHref} className="inline-flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-600 mb-2 transition-colors">
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </Link>
              )}
              <h1 className="text-xl font-black text-[#043061] tracking-tight">{pageTitle}</h1>
              <p className="text-xs text-gray-500 mt-0.5">{pageDescription}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2.5 bg-white border border-line rounded-xl px-4 py-2">
                <FileUp className="h-4 w-4 text-[#5A9ADA]" />
                <div>
                  <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest leading-none">Reports</p>
                  <p className="text-base font-black text-[#043061] tabular-nums leading-tight">{reports.length}</p>
                </div>
              </div>
              <button onClick={fetchReports} disabled={loading} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-line text-xs font-bold text-gray-600 hover:bg-mist-2 transition-colors disabled:opacity-40">
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                onClick={() => { resetCreateForm(); setCreateOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#043061] text-white hover:bg-[#0b4f96] text-xs font-black uppercase tracking-widest transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════ COMPACT FILTER ROW ════════ */}
      <div className="px-1 sm:px-0 py-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search reports by name…"
            className="pl-10 h-9 bg-white border-gray-200 rounded-xl text-xs placeholder:text-gray-400"
            value={reportSearchTerm}
            onChange={(e) => setReportSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* ════════ REPORTS GRID ════════ */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mx-1 sm:mx-0 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
              {reportSearchTerm ? "No reports match your search." : "No reports added yet."}
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredReports.map((r) => {
                const fileKind = guessFileKind(r.url);
                return (
                  <Card key={r.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{r.name}</CardTitle>
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
                        <Badge variant="outline" className="shrink-0">
                          {fileKind.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div
                        className={cn(
                          "rounded-md border bg-muted/30 p-3",
                          !r.url && "bg-muted/10"
                        )}
                      >
                        <div className="text-sm">
                          <div className="font-medium">File</div>
                          <div className="text-muted-foreground mt-1">
                            {r.url ? (
                              <span className="truncate block max-w-[18rem]">{r.url}</span>
                            ) : (
                              <span>No file uploaded</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-md border overflow-hidden bg-muted/20 h-40 sm:h-44">
                        {r.url ? (
                          (() => {
                            if (fileKind === "image") {
                              return (
                                <img
                                  src={r.url}
                                  alt={r.name}
                                  className="w-full h-full object-cover bg-background"
                                />
                              );
                            }
                            if (fileKind === "pdf") {
                              return (
                                <iframe
                                  src={r.url}
                                  className="w-full h-full"
                                  title={r.name}
                                />
                              );
                            }
                            return (
                              <div className="h-full w-full flex items-center justify-center text-xs sm:text-sm text-muted-foreground p-4 text-center">
                                Preview is not available for this file type.
                              </div>
                            );
                          })()
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs sm:text-sm text-muted-foreground">
                            No file uploaded.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => (r.url ? openInNewTab(r.url) : toast.error("No file uploaded"))}
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
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>

                        <label className="inline-flex">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const f = e.target.files?.[0];
                              e.currentTarget.value = "";
                              if (!f) return;
                              handleReplaceFile(r.id, f);
                            }}
                          />
                          <Button variant="outline" size="sm" asChild>
                            <span>
                              <FileUp className="h-4 w-4 mr-2" />
                              Replace File
                            </span>
                          </Button>
                        </label>

                        {r.url && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete File
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete file?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes the file from storage but keeps the report record.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteFile(r.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Report
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete report?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This deletes the report record and the associated file (if any).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteReport(r.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(o: boolean) => {
          setCreateOpen(o);
          if (!o) resetCreateForm();
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 sm:p-6 pb-2">
            <DialogTitle className="text-xl sm:text-2xl">Add Report</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Add a new report and optionally upload a file. You can manage the file later too.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="general">General Info</TabsTrigger>
                <TabsTrigger value="links" className="text-xs sm:text-sm">
                  Links ({createProductLinks.length + createVariantLinks.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="flex-1 overflow-y-auto px-6 pb-6 mt-0">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Category</Label>
                    <Select value={createCategory} onValueChange={(v) => setCreateCategory(v as any)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Report Name</Label>
                    <Input
                      value={createName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateName(e.target.value)}
                      placeholder="e.g. Semaglutide Batch Purity Report"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={createDescriptionText}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCreateDescriptionText(e.target.value)}
                      placeholder="Optional notes for internal organization or customer context"
                      rows={5}
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div>
                    <Label>File</Label>
                    <div className="mt-2 rounded-lg border border-dashed p-4 bg-muted/20">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-md border bg-background p-2">
                          <UploadCloud className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium">Upload any file</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            This file will be stored securely and can be viewed/downloaded by customers.
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 truncate">
                            {createFile ? createFile.name : "No file selected"}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              ref={createFileInputRef}
                              type="file"
                              className="hidden"
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const f = e.target.files?.[0] || null;
                                setCreateFile(f);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => createFileInputRef.current?.click()}
                            >
                              Choose File
                            </Button>
                            {createFile && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setCreateFile(null)}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="links" className="flex-1 overflow-y-auto px-6 pb-6 mt-0 space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Currently Selected
                </h3>
                <div className="grid gap-2">
                  {createProductLinks.length === 0 && createVariantLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-md p-4 text-center border border-dashed">
                      No products or variants selected yet. These will be linked after creation.
                    </p>
                  ) : (
                    <>
                      {createProductLinks.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-md border bg-card gap-3">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium break-words whitespace-normal">{p.name}</span>
                            <Badge variant="secondary" className="w-fit scale-75 origin-left">Product</Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => setCreateProductLinks(prev => prev.filter(x => x.id !== p.id))}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      {createVariantLinks.map(v => (
                        <div key={v.id} className="flex items-center justify-between p-3 rounded-md border bg-card gap-3">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium break-words whitespace-normal">{v.productName || 'Variant'}: {v.name}</span>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="secondary" className="w-fit scale-75 origin-left">Variant</Badge>
                              <span className="text-xs text-muted-foreground">{v.sku}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => setCreateVariantLinks(prev => prev.filter(x => x.id !== v.id))}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <hr />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Search Products or Variants to Link</Label>
                  <div className="relative">
                    <Input
                      placeholder="Search by name or SKU..."
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                      className="pr-10"
                    />
                    {searching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>

                <div className="space-y-4">
                  {productResults.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-extrabold uppercase tracking-wide text-foreground">Products</h4>
                      <div className="grid gap-2">
                        {productResults.map(p => {
                          const isSelected = createProductLinks.some(link => link.id === p.id);
                          return (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/5 gap-2">
                              <span className="text-sm break-words whitespace-normal flex-1 min-w-0">{p.name}</span>
                              <Button
                                size="sm"
                                variant={isSelected ? "outline" : "secondary"}
                                className="shrink-0"
                                onClick={() => {
                                  if (isSelected) {
                                    setCreateProductLinks(prev => prev.filter(x => x.id !== p.id));
                                  } else {
                                    setCreateProductLinks(prev => [...prev, { id: p.id, name: p.name }]);
                                  }
                                }}
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {variantResults.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-extrabold uppercase tracking-wide text-foreground">Variants</h4>
                      <div className="grid gap-2">
                        {variantResults.map(v => {
                          const isSelected = createVariantLinks.some(link => link.id === v.id);
                          return (
                            <div key={v.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/5 gap-2">
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm break-words whitespace-normal">[{v.sku}] {v.productName}: {v.name}</span>
                              </div>
                              <Button
                                size="sm"
                                variant={isSelected ? "outline" : "secondary"}
                                className="shrink-0"
                                onClick={() => {
                                  if (isSelected) {
                                    setCreateVariantLinks(prev => prev.filter(x => x.id !== v.id));
                                  } else {
                                    setCreateVariantLinks(prev => [...prev, { id: v.id, name: v.name, sku: v.sku, productName: v.productName }]);
                                  }
                                }}
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="p-4 sm:p-6 pt-2 border-t bg-muted/5 gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={working} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={working} className="w-full sm:w-auto">
              {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o: boolean) => {
          setEditOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 sm:p-6 pb-2">
            <DialogTitle className="text-xl sm:text-2xl">Edit Report</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update report details and manage product/variant links.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="general">General Info</TabsTrigger>
                <TabsTrigger value="links" className="text-xs sm:text-sm">
                  Links ({(editing?.products?.length || 0) + (editing?.variants?.length || 0)})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="flex-1 overflow-y-auto px-6 pb-6 mt-0">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={editCategory} onValueChange={(v) => setEditCategory(v as any)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Report Name</Label>
                    <Input value={editName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editDescriptionText}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditDescriptionText(e.target.value)}
                      rows={5}
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/10 p-4">
                  <div className="text-sm font-medium">Current file</div>
                  <div className="text-xs text-muted-foreground mt-2 break-words">
                    {editing?.url || "No file uploaded"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-3">
                    Use the actions on the card to replace or delete the file.
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="links" className="flex-1 overflow-y-auto px-6 pb-6 mt-0 space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Currently Linked
                </h3>
                <div className="grid gap-2">
                  {editing?.products?.length === 0 && editing?.variants?.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-md p-4 text-center border border-dashed">
                      Not linked to any products or variants yet.
                    </p>
                  ) : (
                    <>
                      {editing?.products?.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-md border bg-card gap-3">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium break-words whitespace-normal">{p.name}</span>
                            <Badge variant="secondary" className="w-fit scale-75 origin-left">Product</Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => handleUnlink(editing.id, 'product', p.id)}
                          >
                            Unlink
                          </Button>
                        </div>
                      ))}
                      {editing?.variants?.map(v => (
                        <div key={v.id} className="flex items-center justify-between p-3 rounded-md border bg-card gap-3">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium break-words whitespace-normal">{v.productName || 'Variant'}: {v.name}</span>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="secondary" className="w-fit scale-75 origin-left">Variant</Badge>
                              <span className="text-xs text-muted-foreground">{v.sku}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => handleUnlink(editing.id, 'variant', v.id)}
                          >
                            Unlink
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <hr />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Search Products or Variants to Link</Label>
                  <div className="relative">
                    <Input
                      placeholder="Search by name or SKU..."
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                      className="pr-10"
                    />
                    {searching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>

                <div className="space-y-4">
                  {productResults.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-extrabold uppercase tracking-wide text-foreground">Products</h4>
                      <div className="grid gap-2">
                        {productResults.map(p => {
                          const isLinked = editing?.products?.some(lp => lp.id === p.id);
                          return (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/5 gap-2">
                              <span className="text-sm break-words whitespace-normal flex-1 min-w-0">{p.name}</span>
                              <Button
                                size="sm"
                                variant={isLinked ? "outline" : "secondary"}
                                className="shrink-0"
                                disabled={isLinked || working}
                                onClick={() => handleLink(editing!.id, 'product', p.id)}
                              >
                                {isLinked ? 'Linked' : 'Link'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {variantResults.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-extrabold uppercase tracking-wide text-foreground">Variants</h4>
                      <div className="grid gap-2">
                        {variantResults.map(v => {
                          const isLinked = editing?.variants?.some(lv => lv.id === v.id);
                          return (
                            <div key={v.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/5 gap-2">
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm break-words whitespace-normal">[{v.sku}] {v.productName}: {v.name}</span>
                              </div>
                              <Button
                                size="sm"
                                variant={isLinked ? "outline" : "secondary"}
                                className="shrink-0"
                                disabled={isLinked || working}
                                onClick={() => handleLink(editing!.id, 'variant', v.id)}
                              >
                                {isLinked ? 'Linked' : 'Link'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="p-4 sm:p-6 pt-2 border-t bg-muted/5 gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={working} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={working} className="w-full sm:w-auto">
              {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {working && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Working...
          </div>
        </div>
      )}
    </div>
  );
}
