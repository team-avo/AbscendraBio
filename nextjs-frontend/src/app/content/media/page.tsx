"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute, useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Upload, Trash2, Image as ImageIcon, FileText, Video } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function MediaLibraryPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(24);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setSelectedPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setSelectedPreviewUrl(null);
  }, [selectedFile]);

  const load = async (p = 1) => {
    setLoading(true);
    const resp = await api.getMediaFiles({ page: p, limit });
    setLoading(false);
    if (resp.success && resp.data) {
      setFiles(resp.data.files || []);
      setPage(resp.data.pagination.page);
      setPages(resp.data.pagination.pages);
    }
  };

  useEffect(() => { load(1); }, []);

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const onSave = async () => {
    if (!user) return;
    if (!selectedFile) return toast.error('Please choose a file first');
    try {
      setUploading(true);
      const up = await api.uploadFile(selectedFile);
      if (!up.success || !up.data) throw new Error(up.error || 'Upload failed');
      const created = await api.createMediaRecord({
        filename: up.data.filename || selectedFile.name,
        originalName: selectedFile.name,
        mimeType: selectedFile.type,
        size: selectedFile.size,
        url: up.data.url,
        uploadedBy: user.id,
        isPublic,
        altText: altText || undefined,
        caption: caption || undefined,
      });
      if (!created.success) throw new Error(created.error || 'Failed to save media');
      toast.success('Saved');
      setSelectedFile(null);
      setAltText(""); setCaption(""); setIsPublic(true);
      await load(1);
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setUploading(false);
    }
  };

  const onCancel = () => {
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
    setAltText("");
    setCaption("");
    setIsPublic(true);
    if (headerInputRef.current) headerInputRef.current.value = '';
    if (quickInputRef.current) quickInputRef.current.value = '';
  };

  const onDelete = async (id: string) => {
    const resp = await api.deleteMedia(id);
    if (!resp.success) return toast.error(resp.error || 'Delete failed');
    toast.success('Deleted');
    await load(page);
  };

  return (
    <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-5 px-2 sm:px-0">
          <div className="grid gap-5 md:grid-cols-3">
            {/* Media Library — table card style */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              {/* Icon header row */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100">
                    <ImageIcon className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Media Library</p>
                    <p className="text-xs text-slate-500">Browse your uploaded assets</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input ref={headerInputRef} type="file" className="hidden" onChange={onFilePicked} disabled={uploading} />
                  <Button
                    disabled={uploading}
                    onClick={() => headerInputRef.current?.click()}
                    className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
                  >
                    <Upload className="h-4 w-4 mr-2" /> {uploading ? "Uploading..." : "Choose Files"}
                  </Button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((f) => {
                    const isImage = String(f.mimeType || '').startsWith('image/');
                    const isVideo = String(f.mimeType || '').startsWith('video/');
                    const sizeMB = (f.size || 0) / (1024 * 1024);
                    return (
                      <div key={f.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                          {isImage ? <ImageIcon className="h-4 w-4" /> : isVideo ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" title={f.originalName}>{f.originalName}</p>
                            <p className="text-sm text-muted-foreground">{sizeMB >= 1 ? `${sizeMB.toFixed(1)} MB` : `${Math.round((f.size || 0) / 1024)} KB`}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(f.url)}>Copy URL</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => onDelete(f.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {isImage && <div>Type: Image</div>}
                          {isVideo && <div>Type: Video</div>}
                          {!isImage && !isVideo && <div>Type: Document</div>}
                          <div>Uploaded: {f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : ''}</div>
                        </div>
                        {isImage && (
                          <div className="mt-3">
                            <img src={f.url} alt={f.altText || f.originalName} className="w-full h-32 object-cover rounded" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Upload panel */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="mb-4">
                <p className="font-semibold text-slate-900 text-sm">Quick Upload</p>
                <p className="text-xs text-slate-500 mt-0.5">Drag and drop files here</p>
              </div>

              <div
                className={`border-2 border-dashed ${isDragging ? 'border-primary' : 'border-muted-foreground/25'} rounded-lg p-8 text-center transition-colors`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (e) => { e.preventDefault(); setIsDragging(false); if (!user) return; const file = e.dataTransfer.files?.[0]; if (file) { setSelectedFile(file); } }}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">Drag files here or click to browse</p>
                <input ref={quickInputRef} type="file" className="hidden" onChange={onFilePicked} disabled={uploading} />
                <Button variant="outline" disabled={uploading} onClick={() => quickInputRef.current?.click()}>{uploading ? 'Uploading...' : 'Choose Files'}</Button>
                {selectedPreviewUrl && (
                  <div className="mt-4 relative">
                    <img src={selectedPreviewUrl} alt={selectedFile?.name || 'Selected image'} className="w-full h-32 object-cover rounded" />
                    <button
                      type="button"
                      onClick={() => { setSelectedFile(null); setSelectedPreviewUrl(null); }}
                      className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full h-7 w-7 flex items-center justify-center shadow hover:bg-black/80"
                      aria-label="Remove selected image"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-4">
                {selectedFile && (
                  <div className="text-sm text-muted-foreground">Selected: {selectedFile.name}</div>
                )}
                <div>
                  <Label htmlFor="alt-text">Alt Text</Label>
                  <Input id="alt-text" placeholder="Describe the image..." value={altText} onChange={(e) => setAltText(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="caption">Caption</Label>
                  <Input id="caption" placeholder="Optional caption..." value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
                  <Label htmlFor="public">Make public</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onCancel} disabled={uploading}>Cancel</Button>
                  <Button
                    onClick={onSave}
                    disabled={uploading || !selectedFile}
                    className="h-9 px-4 bg-[#1B2D4F] hover:bg-[#243d6b] text-white rounded-xl text-sm font-medium"
                  >
                    {uploading ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
