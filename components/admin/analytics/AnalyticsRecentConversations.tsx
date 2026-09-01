'use client';

import { useRouter } from 'next/navigation';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow, format } from 'date-fns';
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import type { AnalyticsRecentConversation } from '@/types/admin';

interface AnalyticsRecentConversationsProps {
  conversations: AnalyticsRecentConversation[];
}

/**
 * Default component. Recent conversations table for the analytics dashboard.
 */
function AnalyticsRecentConversations({
  conversations,
}: AnalyticsRecentConversationsProps) {
  const router = useRouter();
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();

  if (!conversations.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Conversations</CardTitle>
          <CardDescription>Latest conversations in this period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No conversations in this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Conversations</CardTitle>
        <CardDescription>Latest conversations in this period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Msgs</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Latency</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.map((conv) => (
              <TableRow
                key={conv.uuid}
                className="cursor-pointer"
                onClick={() => router.push(`/admin/conversations/${conv.uuid}`)}
              >
                <TableCell className="max-w-[200px] truncate font-medium">
                  {conv.title || 'Untitled'}
                </TableCell>
                <TableCell className="max-w-[120px] truncate text-muted-foreground">
                  {conv.user_name}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {conv.messages_count}
                </TableCell>
                <TableCell className="text-right tabular-nums font-mono text-xs">
                  {formatCost(conv.total_cost, {
                    showNGN,
                    exchangeRate,
                    decimals: 4,
                  })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {(conv.avg_latency_ms / 1000).toFixed(1)}s
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(conv.created_at), 'PPpp')}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { AnalyticsRecentConversations };
