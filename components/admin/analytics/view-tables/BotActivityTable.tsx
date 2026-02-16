'use client';

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
import type { BotActivityRow } from '@/types/admin';

interface BotActivityTableProps {
  data: BotActivityRow[];
}

const BOT_TYPE_COLORS: Record<string, string> = {
  search_engine: 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
  social_media: 'text-purple-600 border-purple-200 bg-purple-50 dark:text-purple-400 dark:border-purple-900/50 dark:bg-purple-950/50',
  other: 'text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-400 dark:border-gray-700/50 dark:bg-gray-900/50',
};

function formatBotType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
            {data.map((row, index) => (
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
                <TableCell>
                  <Badge variant="outline">{capitalize(row.viewable_type)}</Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(row.viewed_at), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
