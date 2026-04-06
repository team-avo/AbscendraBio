'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type BulkPreviewTableProps = {
  rows: any[];
  maxRows?: number;
  firstVisibleCount?: number;
  visibleColumnCount?: number;
  onViewRow?: (row: any) => void;
  className?: string;
};

export function BulkPreviewTable({ rows, maxRows = 25, firstVisibleCount = 6, visibleColumnCount = 5, onViewRow, className }: BulkPreviewTableProps) {
  if (!rows || rows.length === 0) return null;

  const columns = Object.keys(rows[0]);
  const visibleColumns = columns.slice(0, visibleColumnCount);
  const limitedRows = rows.slice(0, Math.min(maxRows, rows.length));

  return (
    <div className={(className ? className + ' ' : '') + 'relative block w-full max-w-full overflow-x-auto overflow-y-hidden border rounded-md'}>
      <div className="inline-block min-w-full align-middle">
        <Table className="min-w-[720px] w-full border-separate border-spacing-x-2 border-spacing-y-0">
        <TableHeader>
          <TableRow>
            {visibleColumns.map((key) => (
              <TableHead
                key={key}
                className={'px-3 py-2 whitespace-normal break-words align-middle'}
              >
                {key}
              </TableHead>
            ))}
            <TableHead className={'min-w-[140px] px-4 py-2 whitespace-nowrap'}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {limitedRows.map((r, idx) => (
            <TableRow key={idx}>
              {visibleColumns.map((key) => (
                <TableCell
                  key={key}
                  className={'align-top px-3 py-2 whitespace-normal break-words'}
                >
                  {String(r[key])}
                </TableCell>
              ))}
              <TableCell className={'min-w-[140px] px-4 py-2'}>
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border px-3 py-1 text-sm hover:bg-muted"
                  onClick={() => onViewRow && onViewRow(r)}
                >
                  View
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
      
    </div>
  );
}


