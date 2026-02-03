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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpDown, Lock, Globe, Coins, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AdminConversationListItem,
  AdminConversationsParams,
} from '@/types/admin';

interface AdminConversationsTableProps {
  conversations: AdminConversationListItem[];
  isLoading: boolean;
  params: AdminConversationsParams;
  onSort: (sortBy: 'created_at' | 'updated_at' | 'title') => void;
}

export function AdminConversationsTable({
  conversations,
  isLoading,
  params,
  onSort,
}: AdminConversationsTableProps) {
  const router = useRouter();

  const handleRowClick = (id: string) => {
    router.push(`/admin/conversations/${id}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: 'created_at' | 'updated_at' | 'title';
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => onSort(field)}
    >
      {children}
      <ArrowUpDown
        className={cn('ml-2 h-4 w-4', params.sort_by === field && 'text-primary')}
      />
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No conversations found
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">
              <SortButton field="title">Title</SortButton>
            </TableHead>
            <TableHead>User UUID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Privacy</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Messages</TableHead>
            <TableHead className="text-right">
              <span className="flex items-center justify-end gap-1">
                <Hash className="h-3 w-3" /> Tokens
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="flex items-center justify-end gap-1">
                <Coins className="h-3 w-3" /> Cost
              </span>
            </TableHead>
            <TableHead>
              <SortButton field="created_at">Created</SortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversations.map((conversation) => (
            <TableRow
              key={conversation.id}
              className="cursor-pointer"
              onClick={() => handleRowClick(conversation.id)}
            >
              <TableCell className="font-medium max-w-[300px] truncate">
                {conversation.title || 'Untitled'}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {conversation.user_uuid.slice(0, 8)}...
              </TableCell>
              <TableCell>
                <Badge
                  variant={conversation.status === 'active' ? 'default' : 'secondary'}
                >
                  {conversation.status}
                </Badge>
              </TableCell>
              <TableCell>
                {conversation.is_private ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Lock className="h-3 w-3" /> Private
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-green-600">
                    <Globe className="h-3 w-3" /> Public
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {conversation.agent?.name || '-'}
              </TableCell>
              <TableCell className="text-right">
                {conversation.messages_count}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {conversation.usage.total_tokens.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                ${conversation.usage.total_cost.toFixed(6)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(conversation.created_at), {
                  addSuffix: true,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
