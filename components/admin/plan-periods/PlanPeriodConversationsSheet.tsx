'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { cn, stripPastedTags } from '@/lib/utils';
import { formatCost, getCurrencySymbol } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import { useAdminUserPlanPeriodConversations } from '@/lib/hooks/useAdmin';

/** Identifies the slot whose conversations the sheet is drilling into. */
export interface PlanPeriodSlotSelection {
  key: string;
  title: string;
  subtitle: string;
}

interface PlanPeriodConversationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userUuid: string;
  slot: PlanPeriodSlotSelection | null;
}

const PER_PAGE = 15;

export function PlanPeriodConversationsSheet({
  open,
  onOpenChange,
  userUuid,
  slot,
}: PlanPeriodConversationsSheetProps) {
  const [page, setPage] = useState(1);
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();

  const { data, isLoading } = useAdminUserPlanPeriodConversations(
    open ? userUuid : '',
    slot?.key ?? '',
    { page, per_page: PER_PAGE }
  );

  // Reset paging whenever the sheet closes so the next slot starts on page 1.
  const handleOpenChange = (next: boolean) => {
    if (!next) setPage(1);
    onOpenChange(next);
  };

  const pagination = data?.pagination;
  const conversations = data?.data ?? [];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{slot?.title ?? 'Conversations'}</SheetTitle>
          <SheetDescription>{slot?.subtitle ?? ''}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : conversations.length ? (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">Conversation</TableHead>
                      <TableHead className="w-[90px] text-right font-semibold">
                        Messages
                      </TableHead>
                      <TableHead className="w-[90px] text-right font-semibold">
                        Tokens
                      </TableHead>
                      <TableHead className="w-[100px] text-right font-semibold">
                        Cost ({getCurrencySymbol(showNGN)})
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations.map((conversation, index) => (
                      <TableRow
                        key={`${conversation.id}-${index}`}
                        className={cn(index % 2 === 1 && 'bg-muted/30')}
                      >
                        <TableCell className="max-w-[320px]">
                          {conversation.is_confidential && !conversation.title ? (
                            <span className="flex items-center gap-1.5">
                              <span className="italic text-muted-foreground truncate">
                                Confidential conversation
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] gap-1 text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900/50 dark:bg-amber-950/50"
                              >
                                <Lock className="h-2.5 w-2.5" />
                                confidential
                              </Badge>
                            </span>
                          ) : (
                            <Link
                              href={`/admin/conversations/${conversation.id}`}
                              className="font-medium hover:text-primary hover:underline transition-colors block truncate"
                            >
                              {stripPastedTags(conversation.title || 'Untitled')}
                            </Link>
                          )}
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {conversation.agent?.name && (
                              <span className="truncate">{conversation.agent.name}</span>
                            )}
                            <span className="capitalize">· {conversation.status}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {conversation.messages_in_period}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {conversation.usage_in_period.tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatCost(conversation.usage_in_period.cost, {
                            showNGN,
                            exchangeRate,
                            decimals: 4,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {pagination.from || 0}–{pagination.to || 0} of{' '}
                    {pagination.total} conversations
                  </p>
                  {pagination.last_page > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.current_page <= 1}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                      <span className="px-1 text-sm text-muted-foreground">
                        {pagination.current_page} / {pagination.last_page}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={pagination.current_page >= pagination.last_page}
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Counts are scoped to this slot — a conversation spanning two periods
                appears in each, with its slot-scoped usage.
              </p>
            </>
          ) : (
            <div className="rounded-lg border py-12 text-center text-muted-foreground">
              No conversations in this slot.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
