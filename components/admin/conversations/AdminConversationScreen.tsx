'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Bot, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  adminKeys,
  useAdminConversation,
  useAdminConversationAgents,
  useAdminConversationJobs,
} from '@/lib/hooks/useAdmin';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { formatCost } from '@/lib/utils/currency';
import { isNotFoundError } from '@/lib/utils/api-error';
import type { AdminConversationView } from '@/types/admin-conversation-view';
import type { AgentConversation } from '@/types/agent-conversations';
import { AdminTranscript } from '@/v2/features/conversations/admin-view/AdminTranscript';
import { answerRowIds, callsLine, fundingLine, planLine, tokensLine, turnFactsByRow, type TurnFacts } from './admin-view-model';
import { AdminRawMessages } from './AdminRawMessages';

/**
 * The admin conversation view (Stay, thread 085a980c, 25 November 2026): a
 * chat as its owner saw it, drawn with the owner's own components, with a
 * staff strip above it (owner, plan, agent and model, totals) and each
 * turn's tokens, cost, model and funding under its answer. Raw shows the
 * messages as the server sent them.
 *
 * A SNAPSHOT. Read when the page opens and on Refresh; nothing streams and
 * nothing can be sent. A confidential chat shows the strip and "nothing
 * kept"; a redacted chat shows the redacted text, as its owner sees it.
 */
export function AdminConversationScreen({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const chat = useAdminConversation(id);
  const view = chat.data?.data ?? null;
  const confidential = view?.is_confidential === true;
  const agents = useAdminConversationAgents(id, view !== null && !confidential);
  const jobs = useAdminConversationJobs(id, view !== null && !confidential);
  const [mode, setMode] = useState<'chat' | 'raw'>('chat');

  const { setOverride, clearOverride } = useBreadcrumbStore();
  const title = view?.title ?? null;
  useEffect(() => {
    if (title) setOverride(id, title);
    return () => clearOverride(id);
  }, [title, id, setOverride, clearOverride]);

  const refreshing = chat.isFetching || agents.isFetching || jobs.isFetching;
  const refresh = useCallback(() => {
    void queryClient.refetchQueries({ queryKey: adminKeys.conversationDetail(id) });
  }, [queryClient, id]);

  if (chat.isLoading) return <ScreenSkeleton />;

  if (!view) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border px-6 py-10 text-center">
          <p className="font-medium">
            {isNotFoundError(chat.error) ? 'This chat cannot be opened here' : 'The chat did not load'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isNotFoundError(chat.error)
              ? 'It was deleted, or it belongs to a Space. Space chats do not open in the admin view.'
              : 'Check the connection and try again.'}
          </p>
          {!isNotFoundError(chat.error) && (
            <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <ConversationStrip
        view={view}
        readAt={chat.dataUpdatedAt}
        refreshing={refreshing}
        onRefresh={refresh}
        agents={agents.data ?? []}
      />

      {confidential ? (
        <div className="flex flex-col items-center rounded-lg border px-6 py-12 text-center">
          <ShieldCheck aria-hidden className="mb-3 size-6 text-emerald-600 dark:text-emerald-500" />
          <p className="font-medium">Confidential: nothing kept</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            A confidential chat lives only on the device that made it. The server keeps none of its messages.
          </p>
        </div>
      ) : (
        <>
          <Tabs value={mode} onValueChange={(value) => setMode(value === 'raw' ? 'raw' : 'chat')}>
            <TabsList>
              <TabsTrigger value="chat">As the owner sees it</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>
          </Tabs>
          {view.messages.length === 0 ? (
            <div className="rounded-lg border px-6 py-10 text-center text-sm text-muted-foreground">
              No messages in this chat.
            </div>
          ) : mode === 'raw' ? (
            <AdminRawMessages conversationId={view.id} messages={view.messages} />
          ) : (
            <OwnerTranscript view={view} agents={agents.data ?? []} jobs={jobs.data ?? []} />
          )}
        </>
      )}
    </div>
  );
}

function OwnerTranscript({
  view,
  agents,
  jobs,
}: {
  view: AdminConversationView;
  agents: readonly AgentConversation[];
  jobs: NonNullable<ReturnType<typeof useAdminConversationJobs>['data']>;
}) {
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();
  const facts = useMemo(() => turnFactsByRow(view.messages, answerRowIds(view.messages)), [view.messages]);
  const turnFooter = useCallback(
    (rowId: string) => {
      const turn = facts.get(rowId);
      return turn ? <TurnLine facts={turn} cost={formatCost(turn.cost, { showNGN, exchangeRate, decimals: 4 })} /> : null;
    },
    [facts, showNGN, exchangeRate],
  );
  return (
    // The transcript scrolls in its own frame, as it does on the chat page.
    <div className="h-[calc(100dvh-12rem)] min-h-[28rem] overflow-hidden rounded-lg border">
      <AdminTranscript view={view} agentConversations={agents} jobs={jobs} turnFooter={turnFooter} />
    </div>
  );
}

/** Staff only, under an answer: what its turn cost, which model wrote it, what paid. */
function TurnLine({ facts, cost }: { facts: TurnFacts; cost: string }) {
  return (
    <p
      data-admin-turn-line=""
      className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] tabular-nums text-muted-foreground"
    >
      <span>{tokensLine(facts)}</span>
      <span className="font-medium text-foreground/80">
        {cost}
        {facts.estimated ? ' estimated' : ''}
      </span>
      {facts.models.length > 0 && <span>{facts.models.join(', ')}</span>}
      <span>{callsLine(facts)}</span>
      {facts.funding && <span>{fundingLine(facts.funding)}</span>}
    </p>
  );
}

function ConversationStrip({
  view,
  readAt,
  refreshing,
  onRefresh,
  agents,
}: {
  view: AdminConversationView;
  readAt: number;
  refreshing: boolean;
  onRefresh: () => void;
  agents: readonly AgentConversation[];
}) {
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();
  const owner = view.owner;
  const usage = view.usage;
  return (
    <section aria-label="About this chat" className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-balance">{view.title || 'Untitled chat'}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {view.is_confidential && <Badge variant="secondary">Confidential</Badge>}
            {view.is_redacted && <Badge variant="secondary">Redacted</Badge>}
            <Badge variant="outline">{view.is_private ? 'Private' : 'Public'}</Badge>
            {view.status === 'archived' && <Badge variant="outline">Archived</Badge>}
            {view.parent_conversation && (
              <Link
                href={`/admin/conversations/${view.parent_conversation.id}`}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Asked by {view.parent_conversation.title || 'a chat'}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Read at {format(new Date(readAt), 'HH:mm:ss')}</span>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
            Refresh
          </Button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="Owner">
          {owner ? (
            <>
              <Link href={`/admin/users/${owner.uuid}`} className="font-medium underline-offset-2 hover:underline">
                {owner.name}
              </Link>
              <span className="block truncate text-xs text-muted-foreground">{owner.email}</span>
              {owner.deleted_at && <span className="block text-xs text-destructive">Account deleted</span>}
            </>
          ) : (
            <span className="text-muted-foreground">Unknown</span>
          )}
        </Fact>
        <Fact label="Plan">{owner ? planLine(owner) : 'Unknown'}</Fact>
        <Fact label="Agent and model">
          <span className="font-medium">{view.agent?.name ?? 'None'}</span>
          {view.agent?.model && <span className="block text-xs text-muted-foreground">{view.agent.model.name}</span>}
        </Fact>
        <Fact label="Tokens">
          <span className="tabular-nums">{(usage?.total_tokens ?? 0).toLocaleString()}</span>
          <span className="block text-xs tabular-nums text-muted-foreground">
            {tokensLine({ promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0 })}
          </span>
        </Fact>
        <Fact label="Cost">
          <span className="tabular-nums">{formatCost(usage?.total_cost ?? 0, { showNGN, exchangeRate, decimals: 4 })}</span>
        </Fact>
        <Fact label="Messages">
          <span className="tabular-nums">{view.messages_count}</span>
          <span className="block text-xs text-muted-foreground">
            {view.views_count ?? 0} {view.views_count === 1 ? 'view' : 'views'}, started {format(new Date(view.created_at), 'd MMM yyyy')}
          </span>
        </Fact>
      </dl>

      {agents.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Agents this chat asked</p>
          <ul className="flex flex-wrap gap-2">
            {agents.map((agent) => (
              <li key={agent.id}>
                <Link
                  href={`/admin/conversations/${agent.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-muted"
                >
                  <Bot aria-hidden className="size-3.5" />
                  {agent.agent.name}
                  <span className="text-muted-foreground">
                    {agent.messages_count} {agent.messages_count === 1 ? 'message' : 'messages'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
      <Link href="/admin/conversations">
        <ArrowLeft aria-hidden className="mr-1.5 size-4" />
        Conversations
      </Link>
    </Button>
  );
}

function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-[60vh] rounded-lg" />
    </div>
  );
}
