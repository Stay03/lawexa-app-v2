'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminPagination } from '@/components/admin';
import { format } from 'date-fns';
import { History, Trash2, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useStatuteImports } from '@/lib/hooks/useAdminStatutes';
import { ImportDeleteDialog } from './ImportDeleteDialog';
import type { StatuteImport, ImportStatus, AdminStatuteImportsParams } from '@/types/admin-statutes';

/******************************************************************************
                                Helpers
******************************************************************************/

function statusBadgeVariant(status: ImportStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'processing':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

/******************************************************************************
                                Main Component
******************************************************************************/

interface StatuteImportHistoryTableProps {
  params: AdminStatuteImportsParams;
  onPageChange: (page: number) => void;
}

export function StatuteImportHistoryTable({
  params,
  onPageChange,
}: StatuteImportHistoryTableProps) {
  const { data, isLoading } = useStatuteImports(params);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<StatuteImport | null>(null);

  const imports = data?.data || [];

  const handleDelete = (record: StatuteImport) => {
    setDeletingRecord(record);
    setDeleteOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Import History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : imports.length === 0 ? (
          <div className="rounded-lg border py-8 text-center text-muted-foreground">
            No imports yet
          </div>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold">Filename</TableHead>
                    <TableHead className="w-[100px] font-semibold">Status</TableHead>
                    <TableHead className="w-[100px] font-semibold">Progress</TableHead>
                    <TableHead className="w-[150px] font-semibold">Statute</TableHead>
                    <TableHead className="w-[130px] font-semibold">Date</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((record, index) => (
                    <TableRow
                      key={record.id}
                      className={cn(index % 2 === 1 && 'bg-muted/20')}
                    >
                      <TableCell className="font-medium truncate max-w-[200px]">
                        {record.original_filename}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(record.status)}>
                          {record.status_label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">
                          {Math.round(record.progress)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.statute_slug ? (
                          <Link
                            href={`/admin/statutes/${record.statute_slug}`}
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(record.created_at), 'MMM d, yyyy')}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(record.status === 'completed' || record.status === 'failed') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(record)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data?.pagination && (
              <AdminPagination
                pagination={data.pagination}
                onPageChange={onPageChange}
                itemLabel="imports"
              />
            )}
          </>
        )}

        <ImportDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          importRecord={deletingRecord}
        />
      </CardContent>
    </Card>
  );
}
