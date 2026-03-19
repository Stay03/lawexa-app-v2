'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { FileRecentUploadRow } from '@/types/admin-files';

interface RecentUploadsTableProps {
  data: FileRecentUploadRow[];
}

const STATUS_STYLES: Record<string, string> = {
  completed:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900/50',
  pending:
    'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-900/50',
  processing:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/50',
  failed:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50',
};

export function RecentUploadsTable({ data }: RecentUploadsTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Uploads</CardTitle>
          <CardDescription>Latest file uploads within the selected period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Uploads</CardTitle>
        <CardDescription>Latest file uploads within the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploader</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium max-w-[200px] truncate" title={row.original_name}>
                  {row.original_name}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBytes(row.size)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.category}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs capitalize',
                      STATUS_STYLES[row.upload_status] || ''
                    )}
                  >
                    {row.upload_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.uploader_name}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {new Date(row.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
