'use client';

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
import type { TopBotRow } from '@/types/admin';
import { BOT_TYPE_COLORS, formatBotType } from './_bot-style';

interface TopBotsTableProps {
  data: TopBotRow[];
}

export function TopBotsTable({ data }: TopBotsTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Bots</CardTitle>
          <CardDescription>Most active bot crawlers</CardDescription>
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
        <CardTitle>Top Bots</CardTitle>
        <CardDescription>Most active bot crawlers</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bot Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Crawls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={`${row.bot_name}-${index}`}>
                <TableCell className="font-medium">{row.bot_name}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={BOT_TYPE_COLORS[row.bot_type] || BOT_TYPE_COLORS.other}
                  >
                    {formatBotType(row.bot_type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {row.count.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
