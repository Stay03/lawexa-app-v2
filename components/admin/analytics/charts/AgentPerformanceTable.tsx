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
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type { AgentPerformanceRow } from '@/types/admin';

interface AgentPerformanceTableProps {
  data: AgentPerformanceRow[];
}

export function AgentPerformanceTable({ data }: AgentPerformanceTableProps) {
  const { showNGN, exchangeRate } = useCurrencyStore();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>Per-agent metrics</CardDescription>
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
        <CardTitle>Agent Performance</CardTitle>
        <CardDescription>Per-agent metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Avg Latency</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Avg Tokens</TableHead>
              <TableHead className="text-right">Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((agent) => (
              <TableRow key={agent.agent_slug}>
                <TableCell className="font-medium">{agent.agent_name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {agent.request_count.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {(agent.avg_latency_ms / 1000).toFixed(1)}s
                </TableCell>
                <TableCell className="text-right tabular-nums font-mono">
                  {formatCost(agent.total_cost, { showNGN, exchangeRate, decimals: 4 })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {agent.avg_tokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {agent.error_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
