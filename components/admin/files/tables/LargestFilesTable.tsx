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
import { formatBytes } from '@/lib/utils/format-bytes';
import type { FileLargestFileRow } from '@/types/admin-files';

interface LargestFilesTableProps {
  data: FileLargestFileRow[];
}

export function LargestFilesTable({ data }: LargestFilesTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Largest Files</CardTitle>
          <CardDescription>Biggest files by size (all-time)</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Largest Files</CardTitle>
        <CardDescription>Biggest files by size (all-time)</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>MIME Type</TableHead>
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
                <TableCell className="text-right tabular-nums font-medium">
                  {formatBytes(row.size)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.category}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {row.mime_type}
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
