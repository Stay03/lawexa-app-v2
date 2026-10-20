'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageSquareWarning, ShieldAlert } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { LoadFailed } from '@/components/admin/case-enrichments/LoadFailed';
import { ChatErrorSummaryCards } from '@/components/admin/observability/chat-errors/ChatErrorSummaryCards';
import { ChatErrorFilters } from '@/components/admin/observability/chat-errors/ChatErrorFilters';
import { ChatErrorsTable } from '@/components/admin/observability/chat-errors/ChatErrorsTable';
import { useAuth } from '@/lib/hooks/useAuth';
import { useChatErrors, useChatErrorSummary } from '@/lib/hooks/useAdminChatErrors';
import {
  CHAT_ERROR_SUMMARY_HOURS_DEFAULT,
  chatErrorsQueryString,
  readChatErrorsParams,
  type ChatErrorsParams,
} from '@/types/admin-chat-errors';

const PATH = '/admin/operations/chat-errors';
const SUMMARY_PARAMS = { hours: CHAT_ERROR_SUMMARY_HOURS_DEFAULT };

function PageContent() {
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  const params = useMemo(
    () => readChatErrorsParams((key) => searchParams.get(key)),
    [searchParams]
  );

  const summaryQuery = useChatErrorSummary(SUMMARY_PARAMS, { enabled: isSuperadmin });
  const listQuery = useChatErrors(params, { enabled: isSuperadmin });
  const summary = summaryQuery.data?.data;

  // The URL is written with history.pushState, not router.push: in next 16.2.12
  // a router.push to a page opened with a query string can be dropped (measured
  // on the enrichments page, 11 Sep 2026; app/(admin)/admin/cases/enrichments).
  // The App Router syncs useSearchParams with a native pushState whose state is
  // null (lib/utils/url-params.ts says why it must be null), and Back returns
  // to the previous list. The query is read from window.location so a second
  // change before the first has synced builds on the real URL.
  const updateParams = useCallback((updates: Partial<ChatErrorsParams>) => {
    const live = new URLSearchParams(window.location.search);
    const qs = chatErrorsQueryString({
      ...readChatErrorsParams((key) => live.get(key)),
      ...updates,
    });
    window.history.pushState(null, '', qs ? `${PATH}?${qs}` : PATH);
  }, []);

  if (authLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!isSuperadmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Superadmin access required</p>
            <p className="text-sm text-muted-foreground">
              The chat error log is restricted to superadmins.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // A failed request with nothing to show says so, rather than staying a
  // skeleton or reading as an empty list. A failed background refetch keeps
  // what is already on screen.
  const summaryFailed = summaryQuery.isError && summary === undefined;
  const listFailed = listQuery.isError && listQuery.data === undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessageSquareWarning className="h-6 w-6 text-primary" />
          Chat errors
        </h1>
        <p className="text-sm text-muted-foreground">
          Every failed chat turn the server or the app recorded: where it stopped, what the
          service said, and whose it was.
        </p>
      </div>

      {summaryFailed ? (
        <LoadFailed
          message="The last 24 hours could not be loaded."
          onRetry={() => summaryQuery.refetch()}
          retrying={summaryQuery.isFetching}
        />
      ) : (
        <ChatErrorSummaryCards summary={summary} isLoading={summaryQuery.isPending} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Errors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChatErrorFilters params={params} onParamsChange={updateParams} />

          {listFailed ? (
            <LoadFailed
              message="The error list could not be loaded."
              onRetry={() => listQuery.refetch()}
              retrying={listQuery.isFetching}
            />
          ) : (
            <ChatErrorsTable errors={listQuery.data?.data ?? []} isLoading={listQuery.isPending} />
          )}

          {listQuery.data?.pagination && (
            <AdminPagination
              pagination={listQuery.data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="errors"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ChatErrorsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PageContent />
    </Suspense>
  );
}
