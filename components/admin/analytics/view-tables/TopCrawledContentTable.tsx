'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
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
import { viewableHref, viewableLabel } from '@/lib/utils/viewable-content';
import type { TopCrawledContentRow } from '@/types/admin';

interface TopCrawledContentTableProps {
  data: TopCrawledContentRow[];
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function TopCrawledContentTable({ data }: TopCrawledContentTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Crawled Content</CardTitle>
          <CardDescription>Most crawled content by bots</CardDescription>
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
        <CardTitle>Top Crawled Content</CardTitle>
        <CardDescription>Most crawled content by bots</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Content</TableHead>
              <TableHead className="text-right">Crawls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => {
              const label = viewableLabel(row);
              const href = viewableHref(row);
              return (
                <TableRow key={`${row.viewable_type}-${row.viewable_id}`}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{capitalize(row.viewable_type)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[400px] truncate">
                    {href ? (
                      <Link href={href} className="hover:underline text-primary">
                        {label}
                      </Link>
                    ) : (
                      <span>{label}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {row.crawl_count.toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
