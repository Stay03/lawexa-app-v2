'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { useAdminUserTokenUsage } from '@/lib/hooks/useAdmin';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { formatCost } from '@/lib/utils/currency';
import { Hash, Coins, Clock, Bot, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type {
  AdminUserTokenUsageParams,
  TokenUsageGroupBy,
  TokenUsageRecordUngrouped,
  TokenUsageRecordByPeriod,
  TokenUsageRecordByAgent,
  TokenUsageRecordByConversation,
  TokenUsageBreakdownRecord,
} from '@/types/admin';

interface AdminUserTokenUsageProps {
  userUuid: string;
  hideSummary?: boolean;
}

// Type guards for different breakdown record types
function isUngroupedRecord(record: TokenUsageBreakdownRecord): record is TokenUsageRecordUngrouped {
  return 'id' in record && 'conversation' in record;
}

function isPeriodRecord(record: TokenUsageBreakdownRecord): record is TokenUsageRecordByPeriod {
  return 'period' in record && 'request_count' in record && !('agent_id' in record) && !('conversation_uuid' in record);
}

function isAgentRecord(record: TokenUsageBreakdownRecord): record is TokenUsageRecordByAgent {
  return 'agent_id' in record && 'agent_name' in record;
}

function isConversationRecord(record: TokenUsageBreakdownRecord): record is TokenUsageRecordByConversation {
  return 'conversation_uuid' in record && 'conversation_title' in record;
}

export function AdminUserTokenUsage({ userUuid, hideSummary = false }: AdminUserTokenUsageProps) {
  const router = useRouter();
  const { exchangeRate, showNGN } = useCurrencyStore();

  const [params, setParams] = useState<AdminUserTokenUsageParams>({
    group_by: 'none',
    sort_by: 'created_at',
    sort_order: 'desc',
    per_page: 15,
    page: 1,
  });

  const { data, isLoading } = useAdminUserTokenUsage(userUuid, params);

  const updateParams = useCallback((updates: Partial<AdminUserTokenUsageParams>) => {
    setParams((prev) => ({
      ...prev,
      ...updates,
      // Reset to page 1 when changing filters
      page: updates.page !== undefined ? updates.page : 1,
    }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setParams((prev) => ({ ...prev, page }));
  }, []);

  const handleConversationClick = useCallback((conversationUuid: string) => {
    router.push(`/admin/conversations/${conversationUuid}`);
  }, [router]);

  // Parse estimated_cost which can be string or number
  const parseCost = (cost: string | number): number => {
    return typeof cost === 'string' ? parseFloat(cost) : cost;
  };

  // Render table based on grouping type
  const renderBreakdownTable = useMemo(() => {
    if (!data?.data?.breakdown || data.data.breakdown.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No token usage data available
        </div>
      );
    }

    const breakdown = data.data.breakdown;
    const firstRecord = breakdown[0];

    // Ungrouped - individual records
    if (params.group_by === 'none' && isUngroupedRecord(firstRecord)) {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Conversation</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Latency</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(breakdown as TokenUsageRecordUngrouped[]).map((record) => (
              <TableRow
                key={record.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleConversationClick(record.conversation.uuid)}
              >
                <TableCell className="max-w-[200px]">
                  <span className="block truncate">{record.conversation.title || 'Untitled'}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {record.conversation.uuid.slice(0, 8)}...
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{record.agent.name}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {record.total_tokens.toLocaleString()}
                  <div className="text-xs text-muted-foreground">
                    {record.prompt_tokens.toLocaleString()} / {record.completion_tokens.toLocaleString()}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatCost(parseCost(record.estimated_cost), { showNGN, exchangeRate, decimals: 4 })}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {(record.latency_ms / 1000).toFixed(2)}s
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Grouped by period (day/week/month)
    if ((params.group_by === 'day' || params.group_by === 'week' || params.group_by === 'month') && isPeriodRecord(firstRecord)) {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Total Tokens</TableHead>
              <TableHead className="text-right">Prompt / Completion</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(breakdown as TokenUsageRecordByPeriod[]).map((record, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">
                  {record.period}
                  {record.week_start && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (Week of {record.week_start})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {record.request_count}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {record.total_tokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {record.prompt_tokens.toLocaleString()} / {record.completion_tokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatCost(parseCost(record.estimated_cost), { showNGN, exchangeRate, decimals: 4 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Grouped by agent
    if (params.group_by === 'agent' && isAgentRecord(firstRecord)) {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Total Tokens</TableHead>
              <TableHead className="text-right">Prompt / Completion</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(breakdown as TokenUsageRecordByAgent[]).map((record) => (
              <TableRow key={record.agent_id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{record.agent_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{record.agent_slug}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {record.request_count}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {record.total_tokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {record.prompt_tokens.toLocaleString()} / {record.completion_tokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatCost(parseCost(record.estimated_cost), { showNGN, exchangeRate, decimals: 4 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Grouped by conversation
    if (params.group_by === 'conversation' && isConversationRecord(firstRecord)) {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Conversation</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Total Tokens</TableHead>
              <TableHead className="text-right">Prompt / Completion</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(breakdown as TokenUsageRecordByConversation[]).map((record) => (
              <TableRow
                key={record.conversation_uuid}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleConversationClick(record.conversation_uuid)}
              >
                <TableCell className="max-w-[300px]">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{record.conversation_title || 'Untitled'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {record.conversation_uuid.slice(0, 8)}...
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {record.request_count}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {record.total_tokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {record.prompt_tokens.toLocaleString()} / {record.completion_tokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatCost(parseCost(record.estimated_cost), { showNGN, exchangeRate, decimals: 4 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    return null;
  }, [data, params.group_by, showNGN, exchangeRate, handleConversationClick]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const summary = data?.data?.summary;

  return (
    <div className="space-y-4">
      {/* Summary Card - Hidden when hideSummary is true */}
      {!hideSummary && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1 flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Total Tokens
                </p>
                <p className="font-semibold text-lg">{summary.total_tokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Prompt Tokens</p>
                <p className="font-semibold">{summary.prompt_tokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Completion Tokens</p>
                <p className="font-semibold">{summary.completion_tokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 flex items-center gap-1">
                  <Coins className="h-3 w-3" /> Total Cost
                </p>
                <p className="font-mono font-semibold text-lg">
                  {formatCost(summary.total_cost, { showNGN, exchangeRate, decimals: 4 })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Total Requests</p>
                <p className="font-semibold text-lg">{summary.total_requests}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usage Breakdown</CardTitle>
          <CardDescription>
            View detailed token usage with various grouping options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            {/* Group By */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Group By</Label>
              <Select
                value={params.group_by || 'none'}
                onValueChange={(value) => updateParams({ group_by: value as TokenUsageGroupBy })}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="day">By Day</SelectItem>
                  <SelectItem value="week">By Week</SelectItem>
                  <SelectItem value="month">By Month</SelectItem>
                  <SelectItem value="agent">By Agent</SelectItem>
                  <SelectItem value="conversation">By Conversation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <Input
                type="date"
                value={params.start_date || ''}
                onChange={(e) => updateParams({ start_date: e.target.value || undefined })}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">End Date</Label>
              <Input
                type="date"
                value={params.end_date || ''}
                onChange={(e) => updateParams({ end_date: e.target.value || undefined })}
                className="w-[150px]"
              />
            </div>

            {/* Sort By (only for ungrouped) */}
            {params.group_by === 'none' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sort By</Label>
                <Select
                  value={params.sort_by || 'created_at'}
                  onValueChange={(value) => updateParams({ sort_by: value as 'created_at' | 'total_tokens' | 'estimated_cost' })}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Date</SelectItem>
                    <SelectItem value="total_tokens">Tokens</SelectItem>
                    <SelectItem value="estimated_cost">Cost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Per Page */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Per Page</Label>
              <Select
                value={String(params.per_page || 15)}
                onValueChange={(value) => updateParams({ per_page: parseInt(value) })}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="rounded-lg border overflow-hidden">
            {renderBreakdownTable}
          </div>

          {/* Pagination */}
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              itemLabel="records"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
