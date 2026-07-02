'use client';

import { useRouter } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import { useState } from 'react';
import { ArrowUpDown, Lock, Globe, Coins, Hash, Paperclip, FolderPlus } from 'lucide-react';
import { AddToFolderDialog } from '@/components/folders';
import { cn, stripPastedTags } from '@/lib/utils';
import { formatCost, getCurrencySymbol } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type {
  AdminConversationListItem,
  AdminConversationsParams,
} from '@/types/admin';

function SortButton({
  field,
  activeField,
  onSort,
  children,
}: {
  field: 'created_at' | 'updated_at' | 'title';
  activeField: AdminConversationsParams['sort_by'];
  onSort: (sortBy: 'created_at' | 'updated_at' | 'title') => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => onSort(field)}
    >
      {children}
      <ArrowUpDown
        className={cn('ml-2 h-4 w-4', activeField === field && 'text-primary')}
      />
    </Button>
  );
}

interface AdminConversationsTableProps {
  conversations: AdminConversationListItem[];
  isLoading: boolean;
  params: AdminConversationsParams;
  onSort: (sortBy: 'created_at' | 'updated_at' | 'title') => void;
  hideUserColumn?: boolean;
  /** Hide the Files / Tokens / Cost columns (e.g. on the per-user detail page
   *  where user-level totals already live in the KPI strip). */
  hideUsageColumns?: boolean;
  /** Show each conversation's course topics (inline under the title, rank 1 first).
   *  Only populated on the course-scoped listing. */
  showTopics?: boolean;
}

export function AdminConversationsTable({
  conversations,
  isLoading,
  params,
  onSort,
  hideUserColumn = false,
  hideUsageColumns = false,
  showTopics = false,
}: AdminConversationsTableProps) {
  const router = useRouter();
  const { exchangeRate, showNGN } = useCurrencyStore();
  const [folderConvId, setFolderConvId] = useState<string | null>(null);

  const handleRowClick = (id: string) => {
    router.push(`/admin/conversations/${id}`);
  };

  const handleUserClick = (e: React.MouseEvent, userUuid: string) => {
    e.stopPropagation();
    router.push(`/admin/users/${userUuid}`);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3">
          <Skeleton className="h-5 w-full max-w-[600px]" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-4">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No conversations found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[280px] font-semibold">
              <SortButton field="title" activeField={params.sort_by} onSort={onSort}>
                Title
              </SortButton>
            </TableHead>
            {!hideUserColumn && (
              <TableHead className="w-[120px] font-semibold">User</TableHead>
            )}
            <TableHead className="w-[50px] text-center font-semibold">
              <span className="sr-only">Privacy</span>
            </TableHead>
            <TableHead className="w-[120px] font-semibold">Agent</TableHead>
            <TableHead className="w-[80px] text-right font-semibold">Messages</TableHead>
            {!hideUsageColumns && (
              <>
                <TableHead className="w-[80px] text-right font-semibold">
                  <span className="flex items-center justify-end gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Files
                  </span>
                </TableHead>
                <TableHead className="w-[100px] text-right font-semibold">
                  <span className="flex items-center justify-end gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> Tokens
                  </span>
                </TableHead>
                <TableHead className="w-[110px] text-right font-semibold">
                  <span className="flex items-center justify-end gap-1.5">
                    <Coins className="h-3.5 w-3.5" /> Cost ({getCurrencySymbol(showNGN)})
                  </span>
                </TableHead>
              </>
            )}
            <TableHead className="w-[140px] font-semibold">
              <SortButton field="created_at" activeField={params.sort_by} onSort={onSort}>
                Created
              </SortButton>
            </TableHead>
            <TableHead className="w-[50px] font-semibold" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversations.map((conversation, index) => (
            <TableRow
              key={conversation.id}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/40',
                index % 2 === 1 && 'bg-muted/30'
              )}
              onClick={() => handleRowClick(conversation.id)}
            >
              <TableCell className="font-medium max-w-[280px]">
                <span className="block truncate">
                  {stripPastedTags(conversation.title || 'Untitled')}
                </span>
                {showTopics && conversation.topics && conversation.topics.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {[...conversation.topics]
                      .sort((a, b) => a.rank - b.rank)
                      .map((t) => (
                        <Badge
                          key={`${t.topic}-${t.rank}`}
                          variant={t.rank === 1 ? 'secondary' : 'outline'}
                          className="text-[10px] font-normal"
                        >
                          {t.topic}
                        </Badge>
                      ))}
                  </div>
                )}
              </TableCell>
              {!hideUserColumn && (
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => handleUserClick(e, conversation.user_uuid)}
                        className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline transition-colors cursor-pointer"
                      >
                        {conversation.user_uuid.slice(0, 8)}...
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-mono text-xs">{conversation.user_uuid}</p>
                      <p className="text-xs text-muted-foreground mt-1">Click to view user</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              )}
              <TableCell className="text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    {conversation.is_private ? (
                      <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                    ) : (
                      <Globe className="h-4 w-4 text-green-600 mx-auto" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {conversation.is_private ? 'Private' : 'Public'}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-sm">
                <span className="block truncate max-w-[120px]">
                  {conversation.agent?.name || '-'}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {conversation.messages_count}
              </TableCell>
              {!hideUsageColumns && (
              <>
              <TableCell className="text-right tabular-nums">
                {conversation.attachments_count > 0 ? (
                  <span className="inline-flex items-center gap-1 text-sm">
                    {conversation.attachments_count}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {conversation.usage ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="tabular-nums cursor-help">
                        {conversation.usage.total_tokens.toLocaleString()}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">
                        {conversation.usage.prompt_tokens.toLocaleString()} in / {conversation.usage.completion_tokens.toLocaleString()} out
                      </p>
                      {conversation.usage.orchestrator && conversation.usage.specialist && (
                        <div className="mt-1.5 border-t border-border/40 pt-1.5 space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            Orchestrator: {conversation.usage.orchestrator.total_tokens.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Specialist: {conversation.usage.specialist.total_tokens.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {conversation.usage ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">
                        {formatCost(conversation.usage.total_cost, {
                          showNGN,
                          exchangeRate,
                          decimals: 4,
                        })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {conversation.usage.orchestrator && conversation.usage.specialist ? (
                        <div className="space-y-0.5">
                          <p className="text-xs">
                            Orchestrator: {formatCost(conversation.usage.orchestrator.cost, { showNGN, exchangeRate, decimals: 4 })}
                          </p>
                          <p className="text-xs">
                            Specialist: {formatCost(conversation.usage.specialist.cost, { showNGN, exchangeRate, decimals: 4 })}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs">No breakdown available</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-muted-foreground">{formatCost(0, { showNGN, exchangeRate, decimals: 4 })}</span>
                )}
              </TableCell>
              </>
              )}
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help">
                      {formatDistanceToNow(new Date(conversation.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{format(new Date(conversation.created_at), 'PPpp')}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderConvId(conversation.id);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Add to folder</TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {folderConvId && (
        <AddToFolderDialog
          open={!!folderConvId}
          onOpenChange={(open) => { if (!open) setFolderConvId(null); }}
          itemType="conversation"
          itemId={folderConvId}
        />
      )}
    </div>
  );
}
