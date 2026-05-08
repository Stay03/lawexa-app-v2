'use client';

import { Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMessages } from '@/lib/hooks/useMessages';
import { formatMessageTimestamp } from '@/lib/utils/date';
import type { ActivityMessage } from '@/types/chat';

/******************************************************************************
                               Constants
******************************************************************************/

const PER_PAGE = 20;

/******************************************************************************
                               Helpers
******************************************************************************/

function cleanUserContent(content: string): string {
  return content
    .replace(/<(case_slug|note_slug|statute_slug)>[^<]+<\/\1>\n\n/g, '')
    .replace(/<pasted_content>[\s\S]*?<\/pasted_content>\s*/g, '[pasted content] ')
    .trim();
}

/******************************************************************************
                               Pagination Controls
******************************************************************************/

function ActivityPagination({
  currentPage,
  lastPage,
  total,
  onPageChange,
}: {
  currentPage: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? 'message' : 'messages'}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span className="px-2 text-sm text-muted-foreground">
          Page {currentPage} of {lastPage}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= lastPage}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/******************************************************************************
                               Loading Skeleton
******************************************************************************/

function ActivityTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Message</TableHead>
            <TableHead className="w-[28%]">Conversation</TableHead>
            <TableHead className="w-48 text-right">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-32" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/******************************************************************************
                               Page Content
******************************************************************************/

function ActivityPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const { data, isLoading, isError, refetch } = useMessages({
    page,
    per_page: PER_PAGE,
    role: 'user',
    exclude_errors: true,
    sort_order: 'desc',
  });

  const updateParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      const qs = params.toString();
      router.push(qs ? `/activity?${qs}` : '/activity');
    },
    [router, searchParams]
  );

  const handlePageChange = useCallback(
    (next: number) => {
      updateParams({ page: next === 1 ? null : next });
    },
    [updateParams]
  );

  const renderRow = (m: ActivityMessage) => {
    const cleaned = cleanUserContent(m.content) || '(empty message)';
    return (
      <TableRow
        key={m.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => router.push(`/c/${m.conversation.uuid}`)}
      >
        <TableCell className="align-middle">
          <p className="truncate text-sm" title={cleaned}>{cleaned}</p>
        </TableCell>
        <TableCell className="align-middle">
          <Link
            href={`/c/${m.conversation.uuid}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-sm text-primary hover:underline"
            title={m.conversation.title}
          >
            {m.conversation.title}
          </Link>
        </TableCell>
        <TableCell className="whitespace-nowrap text-right align-middle text-xs text-muted-foreground">
          {formatMessageTimestamp(new Date(m.created_at))}
        </TableCell>
      </TableRow>
    );
  };

  const renderContent = () => {
    if (isLoading && !data) return <ActivityTableSkeleton />;

    if (isError) {
      return (
        <ErrorState
          title="Failed to load activity"
          description="We couldn't load your message history. Please try again."
          retry={() => refetch()}
        />
      );
    }

    const items = data?.data ?? [];
    if (items.length === 0) {
      return (
        <EmptyState
          icon={MessageSquare}
          title="No activity yet"
          description="Your messages will show up here as you chat."
          action={{
            label: 'Start a conversation',
            onClick: () => router.push('/'),
          }}
        />
      );
    }

    return (
      <>
        <div className="rounded-md border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Message</TableHead>
                <TableHead className="w-[28%]">Conversation</TableHead>
                <TableHead className="w-48 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{items.map(renderRow)}</TableBody>
          </Table>
        </div>

        {data && data.pagination.last_page > 1 && (
          <ActivityPagination
            currentPage={data.pagination.current_page}
            lastPage={data.pagination.last_page}
            total={data.pagination.total}
            onPageChange={handlePageChange}
          />
        )}
      </>
    );
  };

  return (
    <PageContainer variant="list">
      <PageHeader
        title="Activity"
        description="Your message history across all conversations."
      />
      {renderContent()}
    </PageContainer>
  );
}

/******************************************************************************
                               Page Wrapper
******************************************************************************/

function ActivityPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Activity"
            description="Your message history across all conversations."
          />
          <ActivityTableSkeleton />
        </PageContainer>
      }
    >
      <ActivityPageContent />
    </Suspense>
  );
}

export default ActivityPage;
