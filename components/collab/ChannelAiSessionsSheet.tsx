'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  useChannelAiSessions,
  useChannelAiSessionTranscript,
} from '@/lib/hooks/useCollab';
import { cn } from '@/lib/utils';
import { formatFullTimestamp, formatMessageTime } from '@/lib/utils/collab';
import type { AiSession, AiSessionStatus, Message } from '@/types/collab';

import { LawexaAvatar } from './LawexaAvatar';
import { LawexaMessageContent } from './LawexaMessageContent';
import { MemberAvatar } from './MemberAvatar';
import { MessageContent } from './MessageContent';

interface ChannelAiSessionsSheetProps {
  channelUuid: string;
  channelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Subtle status tint — an active session reads as live, the rest as archival. */
const STATUS_TONE: Record<AiSessionStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  expired: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
};

/**
 * Read-only browser for a channel's past Lawexa sessions. A single sheet with a
 * two-level flow: the session list drills into a session's transcript and back.
 * Gated on channel membership by the caller (same as reading messages); nothing
 * fetches until the sheet is open.
 */
export function ChannelAiSessionsSheet({
  channelUuid,
  channelName,
  open,
  onOpenChange,
}: ChannelAiSessionsSheetProps) {
  const [selectedSession, setSelectedSession] = useState<AiSession | null>(null);

  // Reset the drill-down on close so reopening always lands on the list. Done in
  // the event handler (never an effect) to avoid a setState-in-render loop.
  const handleOpenChange = (next: boolean) => {
    if (!next) setSelectedSession(null);
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        {selectedSession ? (
          <TranscriptView
            channelUuid={channelUuid}
            session={selectedSession}
            open={open}
            onBack={() => setSelectedSession(null)}
          />
        ) : (
          <SessionListView
            channelUuid={channelUuid}
            channelName={channelName}
            open={open}
            onSelect={setSelectedSession}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/******************************************************************************
                              List view
******************************************************************************/

interface SessionListViewProps {
  channelUuid: string;
  channelName: string;
  open: boolean;
  onSelect: (session: AiSession) => void;
}

function SessionListView({
  channelUuid,
  channelName,
  open,
  onSelect,
}: SessionListViewProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useChannelAiSessions(channelUuid, { enabled: open });

  const sessions = useMemo(
    () => (data ? data.pages.flatMap((page) => page.data) : []),
    [data]
  );

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Lawexa sessions
        </SheetTitle>
        <p className="text-sm text-muted-foreground">
          Past conversations with Lawexa in #{channelName}
        </p>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <SessionListSkeleton />
        ) : isError ? (
          <div className="flex h-full items-center justify-center px-4">
            <ErrorState
              title="Couldn't load sessions"
              description="We couldn't load Lawexa's session history. Please try again."
              retry={() => refetch()}
            />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <EmptyState
              icon={Sparkles}
              title="No Lawexa sessions yet"
              description="When someone mentions @lawexa here, the conversation will show up in this history."
            />
          </div>
        ) : (
          <div className="divide-y">
            {sessions.map((session) => (
              <SessionRow
                key={session.uuid}
                session={session}
                onSelect={() => onSelect(session)}
              />
            ))}
            {hasNextPage && (
              <div className="flex justify-center p-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

interface SessionRowProps {
  session: AiSession;
  onSelect: () => void;
}

function SessionRow({ session, onSelect }: SessionRowProps) {
  const startedBy = session.started_by?.name ?? 'Someone';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_TONE[session.status]
            )}
          >
            {session.status_label}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(session.started_at), {
                  addSuffix: true,
                })}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {formatFullTimestamp(session.started_at)}
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="mt-1 truncate text-sm text-foreground">
          Started by {startedBy}
        </p>
        <p className="text-xs text-muted-foreground">
          {session.message_count}{' '}
          {session.message_count === 1 ? 'message' : 'messages'}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function SessionListSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/******************************************************************************
                              Transcript view
******************************************************************************/

interface TranscriptViewProps {
  channelUuid: string;
  session: AiSession;
  open: boolean;
  onBack: () => void;
}

function TranscriptView({
  channelUuid,
  session,
  open,
  onBack,
}: TranscriptViewProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useChannelAiSessionTranscript(channelUuid, session.uuid, { enabled: open });

  // Pages arrive newest-first; reverse the flattened list to read top-down.
  const messages = useMemo(
    () => (data ? data.pages.flatMap((page) => page.data).reverse() : []),
    [data]
  );

  return (
    <>
      <SheetHeader className="gap-2 border-b">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 gap-1 px-2 text-muted-foreground"
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4" />
            Sessions
          </Button>
        </div>
        <SheetTitle className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_TONE[session.status]
            )}
          >
            {session.status_label}
          </span>
          <span className="text-base font-semibold">Lawexa session</span>
        </SheetTitle>
        <p className="text-sm text-muted-foreground">
          Started by {session.started_by?.name ?? 'Someone'} ·{' '}
          {formatFullTimestamp(session.started_at)}
        </p>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <TranscriptSkeleton />
        ) : isError ? (
          <div className="flex h-full items-center justify-center px-4">
            <ErrorState
              title="Couldn't load this session"
              description="We couldn't load this session's transcript. Please try again."
              retry={() => refetch()}
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <EmptyState
              icon={MessageSquareText}
              title="Nothing to show"
              description="This session doesn't have any messages."
            />
          </div>
        ) : (
          <div className="space-y-4 px-4 py-4">
            {hasNextPage && (
              <div className="flex justify-center pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Load older
                </Button>
              </div>
            )}
            {messages.map((message) => (
              <TranscriptRow key={message.uuid} message={message} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

interface TranscriptRowProps {
  message: Message;
}

/**
 * A lean, read-only transcript row. Deliberately NOT the editable `MessageRow`
 * (which carries edit/delete affordances) — history is immutable here. Lawexa
 * (`is_ai`) renders as markdown; a human renders as plain text with mentions.
 */
function TranscriptRow({ message }: TranscriptRowProps) {
  const name = message.is_ai
    ? 'Lawexa'
    : message.author?.name ?? 'Deleted user';

  return (
    <div className="flex gap-3">
      {message.is_ai ? (
        <LawexaAvatar size="sm" className="mt-0.5 shrink-0" />
      ) : (
        <MemberAvatar
          user={message.author}
          size="sm"
          className="mt-0.5 shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">
            {formatMessageTime(message.created_at)}
          </span>
        </div>
        <div className="mt-0.5">
          {message.is_ai ? (
            <LawexaMessageContent
              content={message.content}
              metadata={message.metadata}
            />
          ) : (
            <MessageContent
              content={message.content}
              metadata={message.metadata}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TranscriptSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      {[70, 55, 80, 45].map((width, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="mt-0.5 h-6 w-6 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-4" style={{ width: `${width}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
