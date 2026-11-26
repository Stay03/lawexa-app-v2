'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowDown, ArrowLeft, Bot, Cpu, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  adminKeys,
  useAdminConversation,
  useAdminConversationAgents,
  useAdminConversationJobs,
} from '@/lib/hooks/useAdmin';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { getInitials } from '@/lib/utils/collab';
import { formatCost } from '@/lib/utils/currency';
import { isNotFoundError } from '@/lib/utils/api-error';
import type { AdminConversationView } from '@/types/admin-conversation-view';
import type { AgentConversation } from '@/types/agent-conversations';
import { AdminTranscript } from '@/v2/features/conversations/admin-view/AdminTranscript';
import { answerRowIds, callsLine, fundingLine, planLine, tokensLine, turnFactsByRow, type TurnFacts } from './admin-view-model';
import { AdminRawMessages } from './AdminRawMessages';

/**
 * The admin conversation view (Stay, thread 085a980c, 25 November 2026): a
 * chat as its owner saw it, drawn with the owner's own components, under a
 * header with the staff facts (owner and plan, agent, model and cost, the
 * agents it asked) and each turn's tokens, cost, model and funding in a quiet
 * line under its answer. Raw shows the messages as the server sent them.
 *
 * ONE SCROLL, FROM THE TOP (Stay, 26 November 2026). The page scrolls as one:
 * the transcript keeps no scroll box of its own and opens at the chat's first
 * message. "Jump to latest" goes to its end.
 *
 * THE SIDE PANEL. A draft or a file opens beside the chat, read only, as on
 * the owner's page (Stay, 26 November 2026: "like for like as user side").
 * On a computer the page keeps a box for it beside the column, which moves
 * to the left while it is open; below xl the panel is the owner's sheet.
 *
 * A SNAPSHOT. Read when the page opens and on Refresh; nothing streams and
 * nothing can be sent. A confidential chat shows the header and "nothing
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
  const endRef = useRef<HTMLDivElement>(null);
  // The side panel's box beside the column, and whether the panel is open (the transcript says).
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

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

  const jumpToLatest = useCallback(() => {
    const end = endRef.current;
    if (!end) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    end.scrollIntoView({ block: 'end', behavior: smooth ? 'smooth' : 'auto' });
    // Rows far above are sized by estimate until they draw, so a long smooth
    // scroll can stop short of the end: once it has stopped, go the rest.
    if (smooth) {
      const scroller = scrollParent(end);
      scroller?.addEventListener('scrollend', () => end.scrollIntoView({ block: 'end', behavior: 'auto' }), { once: true });
    }
  }, []);

  if (chat.isLoading) return <ScreenSkeleton />;

  if (!view) {
    return (
      <div className={`${COLUMN} space-y-4`}>
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

  const hasMessages = view.messages.length > 0;
  const panelShown = panelOpen && mode === 'chat';
  return (
    <div className={cn(panelShown && 'xl:flex xl:items-start xl:gap-6')}>
      <div className={cn(COLUMN, 'flex flex-col gap-5', panelShown && 'xl:mx-0 xl:min-w-0 xl:flex-1')}>
        <BackLink />
        <ChatHeader
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
          <section aria-label="The chat" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Tabs value={mode} onValueChange={(value) => setMode(value === 'raw' ? 'raw' : 'chat')}>
                <TabsList>
                  <TabsTrigger value="chat">As the owner sees it</TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                </TabsList>
              </Tabs>
              {hasMessages && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={jumpToLatest}>
                  <ArrowDown aria-hidden />
                  Jump to latest
                </Button>
              )}
            </div>
            {!hasMessages ? (
              <div className="rounded-lg border px-6 py-10 text-center text-sm text-muted-foreground">
                No messages in this chat.
              </div>
            ) : mode === 'raw' ? (
              <AdminRawMessages conversationId={view.id} messages={view.messages} />
            ) : (
              <OwnerTranscript
                view={view}
                agents={agents.data ?? []}
                jobs={jobs.data ?? []}
                panelHost={panelHost}
                onPanelOpenChange={setPanelOpen}
              />
            )}
            <div ref={endRef} aria-hidden />
          </section>
        )}
      </div>
      {/* The side panel's box: beside the column on a computer, as tall as the page's scroll (AdminSidePanel). */}
      <div
        ref={setPanelHost}
        data-admin-side-panel-host=""
        className={cn(panelShown && 'xl:sticky xl:top-0 xl:h-[var(--admin-side-panel-h,100dvh)] xl:w-[min(50%,52rem)] xl:shrink-0 xl:py-3')}
      />
    </div>
  );
}

/**
 * One centred column for the header, the tabs and the chat (Techlead's check,
 * 26 November 2026): on a wide screen they line up, as the owner's chat
 * centres its own column.
 */
const COLUMN = 'mx-auto w-full max-w-[50rem]';

/** The nearest box that scrolls (the admin shell's content region). */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

function OwnerTranscript({
  view,
  agents,
  jobs,
  panelHost,
  onPanelOpenChange,
}: {
  view: AdminConversationView;
  agents: readonly AgentConversation[];
  jobs: NonNullable<ReturnType<typeof useAdminConversationJobs>['data']>;
  panelHost: HTMLElement | null;
  onPanelOpenChange: (open: boolean) => void;
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
    <AdminTranscript
      view={view}
      agentConversations={agents}
      jobs={jobs}
      turnFooter={turnFooter}
      panelHost={panelHost}
      onPanelOpenChange={onPanelOpenChange}
    />
  );
}

/** Staff only, under an answer: what its turn cost, which model wrote it, what paid. Quiet, so the answer leads. */
function TurnLine({ facts, cost }: { facts: TurnFacts; cost: string }) {
  return (
    <p
      data-admin-turn-line=""
      className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] leading-4 tabular-nums text-muted-foreground/80"
    >
      <span className="text-muted-foreground">
        {cost}
        {facts.estimated ? ' estimated' : ''}
      </span>
      <span>{tokensLine(facts)}</span>
      {facts.models.length > 0 && <span>{facts.models.join(', ')}</span>}
      <span>{callsLine(facts)}</span>
      {facts.funding && <span>{fundingLine(facts.funding)}</span>}
    </p>
  );
}

function ChatHeader({
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
    <header aria-label="About this chat" className="flex flex-col gap-3 border-b pb-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-xl font-semibold tracking-tight text-balance">{view.title || 'Untitled chat'}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Read at {format(new Date(readAt), 'HH:mm:ss')}</span>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Who owns it: face, name, plan and email on one line. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
        {owner ? (
          <>
            <Link
              href={`/admin/users/${owner.uuid}`}
              className="inline-flex min-w-0 items-center gap-2 font-medium underline-offset-2 hover:underline"
            >
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px] font-medium">{getInitials(owner.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{owner.name}</span>
            </Link>
            <Badge variant="secondary" className="font-normal">
              {planLine(owner)}
            </Badge>
            <span className="min-w-0 truncate text-muted-foreground">{owner.email}</span>
            {owner.deleted_at && <span className="text-xs text-destructive">Account deleted</span>}
          </>
        ) : (
          <span className="text-muted-foreground">Owner unknown</span>
        )}
      </div>

      {/* What answered and what it cost, then the chat's own marks. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip icon={<Bot aria-hidden className="size-3.5" />}>{view.agent?.name ?? 'No agent'}</Chip>
        {view.agent?.model && <Chip icon={<Cpu aria-hidden className="size-3.5" />}>{view.agent.model.name}</Chip>}
        <Chip>
          <span className="font-medium tabular-nums">{formatCost(usage?.total_cost ?? 0, { showNGN, exchangeRate, decimals: 4 })}</span>
        </Chip>
        {view.is_confidential && <Badge variant="secondary">Confidential</Badge>}
        {view.is_redacted && <Badge variant="secondary">Redacted</Badge>}
        <Badge variant="outline" className="font-normal">
          {view.is_private ? 'Private' : 'Public'}
        </Badge>
        {view.status === 'archived' && (
          <Badge variant="outline" className="font-normal">
            Archived
          </Badge>
        )}
        {view.parent_conversation && (
          <Link
            href={`/admin/conversations/${view.parent_conversation.id}`}
            className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Asked by {view.parent_conversation.title || 'a chat'}
          </Link>
        )}
      </div>

      {/* The counts, second to the rest. */}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
        <span>
          {(usage?.total_tokens ?? 0).toLocaleString()} tokens (
          {tokensLine({ promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0 })})
        </span>
        <span>
          {view.messages_count} {view.messages_count === 1 ? 'message' : 'messages'}
        </span>
        <span>
          {view.views_count ?? 0} {view.views_count === 1 ? 'view' : 'views'}
        </span>
        <span>Started {format(new Date(view.created_at), 'd MMM yyyy, HH:mm')}</span>
      </p>

      {agents.length > 0 && (
        <ul aria-label="Agents this chat asked" className="flex flex-wrap gap-1.5">
          {agents.map((agent) => (
            <li key={agent.id}>
              <Link
                href={`/admin/conversations/${agent.id}`}
                title={`${agent.messages_count} ${agent.messages_count === 1 ? 'message' : 'messages'}. Open its conversation`}
                className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs transition-colors hover:bg-muted"
              >
                <Avatar className="size-5">
                  <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                    {getInitials(agent.agent.name)}
                  </AvatarFallback>
                </Avatar>
                {agent.agent.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border bg-muted/40 px-2 text-xs">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      {children}
    </span>
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
    <div className={`${COLUMN} flex flex-col gap-5`}>
      <Skeleton className="h-8 w-32" />
      <div className="flex flex-col gap-3 border-b pb-5">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-6 w-80 max-w-full" />
      </div>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-[50vh] rounded-lg" />
    </div>
  );
}
