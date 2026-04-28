'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
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
import type { BotActivityRow } from '@/types/admin';
import { BOT_TYPE_COLORS, formatBotType } from './_bot-style';

interface BotActivityTableProps {
  data: BotActivityRow[];
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function BotActivityTable({ data }: BotActivityTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bot Activity</CardTitle>
          <CardDescription>Recent bot views</CardDescription>
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
        <CardTitle>Bot Activity</CardTitle>
        <CardDescription>Recent bot views</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bot Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Content</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => {
              const label = viewableLabel(row);
              const href = viewableHref(row);
              return (
                <TableRow key={`${row.viewed_at}-${index}`}>
                  <TableCell className="font-medium">
                    {row.bot_name || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={BOT_TYPE_COLORS[row.bot_type] || BOT_TYPE_COLORS.other}
                    >
                      {formatBotType(row.bot_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="shrink-0">
                        {capitalize(row.viewable_type)}
                      </Badge>
                      <span className="truncate">
                        {href ? (
                          <Link href={href} className="hover:underline text-primary">
                            {label}
                          </Link>
                        ) : (
                          label
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(row.viewed_at), { addSuffix: true })}
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
