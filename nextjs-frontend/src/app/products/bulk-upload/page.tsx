'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { ProtectedRoute } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BulkPreviewTable } from '@/components/products/BulkPreviewTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import logger from '@/lib/logger';
import { toast } from 'sonner';

export default function ProductsBulkUploadPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [viewRow, setViewRow] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      setRows(parsed as any[]);
      setCurrentPage(1);
      toast.success(`Parsed ${parsed.length} row(s)`);
    } catch (e) {
      logger.error('Failed to parse Excel file:', { error: e });
      toast.error('Failed to parse Excel file');
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async () => {
    if (rows.length === 0) {
      toast.error('No rows to upload');
      return;
    }
    setUploading(true);
    try {
      const resp = await api.bulkUploadProducts(rows);
      if (resp.success) {
        const uploadedCount = (resp as any).data?.count ?? rows.length;
        toast.success(`Uploaded ${uploadedCount} product(s)`);
        router.push('/products');
      } else {
        toast.error(resp.error || 'Bulk upload failed');
      }
    } catch (e) {
      toast.error('Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MANAGER', 'STAFF']}>
      <DashboardLayout>
        <div className="space-y-6 w-full max-w-[100vw] overflow-x-hidden px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 max-w-full">
              <Button variant="ghost" onClick={() => router.push('/products')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Products
              </Button>
            </div>
            {/* <div className="shrink-0">
              <a
                href="/Product_Bulk-UPLOAD.xlsx"
                download
                className="text-sm underline break-words"
              >
                Download Template
              </a>
            </div> */}
          </div>

          <Card className="overflow-x-hidden">
            <CardHeader>
              <CardTitle>Bulk Upload Products</CardTitle>
              <CardDescription>Upload the Excel file and preview data before Uploading.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-x-hidden">
              <div>
                <label className="flex items-center gap-3 border rounded-md p-3 cursor-pointer w-fit">
                  <Upload className="h-4 w-4" />
                  <span>Select Excel File</span>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </label>
              </div>

              {parsing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoadingSpinner size={16} /> Parsing...
                </div>
              )}

              {rows.length > 0 && (
                <div className="space-y-3 w-full max-w-full overflow-x-auto">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm text-muted-foreground">Total product count from the excel: <span className="font-bold text-black">{rows.length}</span></div>
                  </div>
                  <BulkPreviewTable
                    rows={rows.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)}
                    maxRows={25}
                    firstVisibleCount={6}
                    visibleColumnCount={4}
                    onViewRow={(r) => setViewRow(r)}
                  />
                  <div className="flex justify-end w-full">
                    <Button onClick={handleSubmit} disabled={uploading} className="w-full sm:w-auto">
                      {uploading ? (
                        <>
                          <LoadingSpinner size={16} className="mr-2" /> Uploading...
                        </>
                      ) : (
                        'Import Products'
                      )}
                    </Button>
                  </div>
                  {(() => {
                    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
                    const start = (currentPage - 1) * pageSize + 1;
                    const end = Math.min(rows.length, currentPage * pageSize);
                    return (
                      <div className="flex items-center justify-between gap-2 text-sm pt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Rows per page:</span>
                          <select
                            className="border rounded px-2 py-1 bg-background"
                            value={pageSize}
                            onChange={(e) => { setPageSize(parseInt(e.target.value || '10', 10)); setCurrentPage(1); }}
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{rows.length === 0 ? '0-0' : `${start}-${end}`} of {rows.length}</span>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Row details</DialogTitle>
                  </DialogHeader>
                  {!!viewRow && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-auto">
                      {Object.keys(viewRow).map((k) => (
                        <div key={k} className="text-sm">
                          <div className="font-medium text-muted-foreground mb-1">{k}</div>
                          <div className="whitespace-pre-wrap break-words">{String(viewRow[k])}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}


