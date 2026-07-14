'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import dynamic from 'next/dynamic';
import { ArrowDown, Loader2, MessagesSquare, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { cn } from '@/lib/utils';
import { formatDayLabel, isSameCalendarDay } from '@/lib/utils/collab';
import { extractApiError } from '@/lib/utils/api-error';
import {
  useChannelMessages,
  useCurrentUserUuid,
  useDeleteMessage,
  useMarkChannelRead,
  useUpdateMessage,
} from '@/lib/hooks/useCollab';
import type { ChannelRealtime, LawexaTurn } from '@/lib/hooks/useChannelRealtime';
import type { Channel, Message } from '@/types/collab';

import { LawexaRespondingRow } from './LawexaRespondingRow';
import { MessageComposer } from './MessageComposer';
import { MessageGroup, type MessageGroupData } from './MessageGroup';
import { MessageListSkeleton } from './skeletons';

// The glance panel loads the full chat-stream engine, so only pull it in when
// the reader actually clicks Watch. ssr:false — it's a live, client-only stream.
const LawexaGlancePanel = dynamic(
  () => import('./LawexaGlancePanel').then((m) => m.LawexaGlancePanel),
  { ssr: false }
);

/** Consecutive messages from one author within this window share an avatar. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

type RenderItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'ai_divider'; key: string; label: string }
  | { kind: 'group'; group: MessageGroupData }
  | { kind: 'responding'; key: string; turn: LawexaTurn };

/** Collapse a chronological message list into day separators + author groups,
 *  splicing an inline "responding" row directly beneath any message that
 *  summoned a still-active Lawexa turn (keyed by that message's uuid). */
function buildRenderItems(
  messages: Message[],
  turnsByMessageUuid: Map<string, LawexaTurn>
): RenderItem[] {
  const items: RenderItem[] = [];
  let group: MessageGroupData | null = null;

  messages.forEach((message, i) => {
    const prev = messages[i - 1];
    const newDay = !prev || !isSameCalendarDay(prev.created_at, message.created_at);

    if (newDay) {
      items.push({
        kind: 'day',
        key: `day-${message.uuid}`,
        label: formatDayLabel(message.created_at),
      });
      group = null;
    }

    // A Lawexa session boundary renders as its own separator (not a bubble) and
    // breaks grouping, like a new day does.
    if (message.metadata.type === 'ai_divider') {
      items.push({
        kind: 'ai_divider',
        key: `ai-divider-${message.uuid}`,
        label: message.content,
      });
      group = null;
      return;
    }

    const last = group?.messages[group.messages.length - 1];
    // Lawexa (`is_ai`, author:null) and a deleted human (author:null) both lack
    // an author, so identity must also require a matching `is_ai` — otherwise a
    // Lawexa reply would merge into a deleted human's run (and vice versa).
    const sameAuthor =
      !!group &&
      group.isAi === message.is_ai &&
      (group.author?.uuid ?? null) === (message.author?.uuid ?? null);
    const withinWindow =
      last &&
      new Date(message.created_at).getTime() -
        new Date(last.created_at).getTime() <
        GROUP_WINDOW_MS;
    const isReply = message.parent_message_uuid !== null;

    if (group && sameAuthor && withinWindow && !isReply) {
      group.messages.push(message);
    } else {
      group = {
        key: message.uuid,
        author: message.author,
        isAi: message.is_ai,
        messages: [message],
      };
      items.push({ kind: 'group', group });
    }

    // If this message summoned a live Lawexa turn, drop the responding row right
    // after it and close the group so the row sits directly under the trigger
    // (and any later message from the same author starts a fresh group below).
    const turn = turnsByMessageUuid.get(message.uuid);
    if (turn) {
      items.push({
        kind: 'responding',
        key: `responding-${turn.executionId}`,
        turn,
      });
      group = null;
    }
  });

  return items;
}

/**
 * A content-based identity for a message, stable across the optimistic→real
 * reconcile (the uuid changes then, but author + content do not). Used to record
 * "already animated" so the entry animation doesn't replay on the swap.
 */
function messageIdentity(message: Message): string {
  return `${message.author?.uuid ?? (message.is_ai ? 'ai' : 'none')}|${message.content}`;
}

/**
 * A message is a genuinely-new tail iff a load-time baseline exists and its
 * `created_at` is strictly newer than it — true for a fresh send (client
 * `created_at` = now) or an incoming realtime message, false for the initial
 * history load and older prepended pages (all at or before the baseline).
 */
function isNewerThanBaseline(message: Message, baseline: number | null): boolean {
  return baseline !== null && new Date(message.created_at).getTime() > baseline;
}

function typingLabel(users: ChannelRealtime['typingUsers']): string | null {
  if (users.length === 0) return null;
  if (users.length === 1) return `${users[0].name} is typing…`;
  if (users.length === 2)
    return `${users[0].name} and ${users[1].name} are typing…`;
  return 'Several people are typing…';
}

interface ChannelConversationProps {
  channel: Channel;
  realtime: ChannelRealtime;
  className?: string;
}

/** Scrollable message history + composer, with live updates (Phase 3). */
export function ChannelConversation({
  channel,
  realtime,
  className,
}: ChannelConversationProps) {
  const query = useChannelMessages(channel.uuid);
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = query;

  const currentUserUuid = useCurrentUserUuid();
  const updateMutation = useUpdateMessage(channel.uuid);
  const deleteMutation = useDeleteMessage(channel.uuid);
  const markRead = useMarkChannelRead(channel.uuid);
  const markReadMutate = markRead.mutate;

  // Pages arrive newest-first; reverse the flattened list to read top-down.
  const messages = useMemo(
    () => (data ? data.pages.flatMap((page) => page.data).reverse() : []),
    [data]
  );
  // Index the in-flight turns by the uuid of the message that summoned them, so
  // buildRenderItems can anchor each responding row under its trigger. Turns
  // without a message_uuid (backend not yet shipping it) simply don't anchor.
  const turnsByMessageUuid = useMemo(() => {
    const map = new Map<string, LawexaTurn>();
    for (const turn of realtime.lawexaTurns) {
      if (turn.messageUuid) map.set(turn.messageUuid, turn);
    }
    return map;
  }, [realtime.lawexaTurns]);

  const renderItems = useMemo(
    () => buildRenderItems(messages, turnsByMessageUuid),
    [messages, turnsByMessageUuid]
  );

  const newestRealUuid = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (!messages[i].uuid.startsWith('optimistic-')) return messages[i].uuid;
    }
    return null;
  }, [messages]);

  // The last message in the feed — used both for the no-yank-on-AI-reply check
  // in the scroll layout-effect and for the entry/reveal animation baseline.
  const newestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  // Glance: which summon's SSE stream the reader is watching, if any. A lingering
  // watchId whose turn has ended renders nothing (no matching 'responding' item)
  // — that IS the auto-hide, so no effect is needed to clear it.
  const [watchId, setWatchId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentObserverRef = useRef<ResizeObserver | null>(null);
  const didInitialScroll = useRef(false);
  const restoreFromHeight = useRef<number | null>(null);
  const atBottomRef = useRef(true);

  // Reactive mirror of `atBottomRef`, so the floating scroll-to-bottom button's
  // visibility is driven by state (updated only from event/observer callbacks,
  // never from an effect body — no setState-in-effect).
  const [isAtBottom, setIsAtBottom] = useState(true);

  // The `created_at` (epoch ms) of the newest message at first load. A message
  // animates its entry/reveal iff it is strictly newer than this — so the
  // initial history load and any older prepended pages never animate, while a
  // fresh send (client `created_at` = now) or an incoming realtime message does.
  // A DATA value captured in the initial-scroll effect (not `Date.now()`).
  const baselineTimeRef = useRef<number | null>(null);
  // Identities already animated once, to defeat the optimistic→real double
  // animation: the optimistic bubble animates, then reconciles to the server
  // message; both share this content-based identity, so the replacement is
  // suppressed. (uuid changes on reconcile, so we can't key on uuid alone.)
  const animatedIdsRef = useRef<Set<string>>(new Set());
  // Execution ids whose inline peek has already been scrolled into view, so the
  // gentle scroll fires once when the peek opens — not on every live re-render.
  const peekScrolledRef = useRef<Set<string>>(new Set());

  // Advance the read pointer to the newest real message whenever it changes.
  useEffect(() => {
    if (channel.is_member && newestRealUuid) markReadMutate(newestRealUuid);
  }, [channel.is_member, newestRealUuid, markReadMutate]);

  // Pin to newest on load; hold position when older pages prepend; follow new
  // messages only when the reader is already at the bottom — EXCEPT a just-
  // arrived Lawexa reply, which we let fade in place (M2/M3) rather than yank to.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (!didInitialScroll.current && messages.length > 0) {
      // Baseline: the newest message at first load. Everything already present
      // is history and must not animate; only strictly-newer messages will.
      baselineTimeRef.current = newestMessage
        ? new Date(newestMessage.created_at).getTime()
        : null;
      el.scrollTop = el.scrollHeight;
      didInitialScroll.current = true;
      return;
    }
    if (restoreFromHeight.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFromHeight.current;
      restoreFromHeight.current = null;
      return;
    }
    // A newly-arrived Lawexa reply reveals block-by-block; don't chase it to the
    // bottom even when the reader was there — surface the scroll button instead.
    const newestIsFreshAi =
      !!newestMessage &&
      newestMessage.is_ai &&
      baselineTimeRef.current !== null &&
      new Date(newestMessage.created_at).getTime() > baselineTimeRef.current;
    if (atBottomRef.current && !newestIsFreshAi) {
      el.scrollTop = el.scrollHeight;
    }
    // `messages.length` catches prepends (older pages) so position is restored;
    // `newestMessage` catches a new/reconciled tail so the no-yank check is
    // evaluated against the right message. Prepends don't change the tail ref.
  }, [messages.length, newestMessage]);

  // Mark the identities we animated this render so the optimistic→real swap
  // (which remounts the row under a new uuid) doesn't replay the animation.
  // Ref writes only — never setState — so this stays clear of the compiler ban.
  useLayoutEffect(() => {
    for (const message of messages) {
      if (isNewerThanBaseline(message, baselineTimeRef.current)) {
        animatedIdsRef.current.add(messageIdentity(message));
      }
    }
  }, [messages]);

  // Stable across renders (uses only refs + the stable setState) so the
  // ResizeObserver below and the scroll listener don't churn every render.
  const syncAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    atBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = true;
    setIsAtBottom(true);
    el.scrollTop = el.scrollHeight;
  };

  // Stable ref callback for an opened inline peek: gently scroll it into view
  // once when it mounts (reads its execution id from a data attribute so the
  // callback identity stays stable across the turn's live re-renders — a fresh
  // inline arrow would re-fire on every render). No setState — event-driven.
  const peekRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const executionId = node.dataset.executionId;
    if (!executionId || peekScrolledRef.current.has(executionId)) return;
    peekScrolledRef.current.add(executionId);
    node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  // The block-by-block reveal grows the AI reply's height below the fold without
  // firing a scroll event, so the button wouldn't otherwise appear. A callback
  // ref observes the content box and re-derives "at bottom" as its size changes.
  // The setState runs inside the ResizeObserver callback (async), not an effect
  // body — lint-clean — and the callback ref attaches whenever the content div
  // (re)mounts, which a mount-time effect would miss during the loading phase.
  const contentRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      contentObserverRef.current?.disconnect();
      contentObserverRef.current = null;
      if (node && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => syncAtBottom());
        observer.observe(node);
        contentObserverRef.current = observer;
      }
    },
    [syncAtBottom]
  );

  const handleLoadOlder = () => {
    const el = scrollRef.current;
    if (el) restoreFromHeight.current = el.scrollHeight;
    fetchNextPage();
  };

  const isAdmin = channel.my_role === 'owner' || channel.my_role === 'admin';
  const permissionsFor = (message: Message) => {
    const isReal = !message.uuid.startsWith('optimistic-');
    const isMine =
      !!message.author &&
      !!currentUserUuid &&
      message.author.uuid === currentUserUuid;
    return { canEdit: isReal && isMine, canDelete: isReal && (isMine || isAdmin) };
  };

  // A message animates iff it's a genuinely-new tail (newer than the load-time
  // baseline) that we haven't animated before — the `animatedIdsRef` guard makes
  // the entry play exactly once across the optimistic→real reconcile. A fresh AI
  // reply additionally reveals block-by-block (M2). Pure read; the "mark as
  // animated" write happens in the layout-effect above, keeping render clean.
  const animationFor = (message: Message) => {
    const fresh =
      isNewerThanBaseline(message, baselineTimeRef.current) &&
      !animatedIdsRef.current.has(messageIdentity(message));
    return { animateEntry: fresh, animateReveal: fresh && message.is_ai };
  };

  const handleSaveEdit = async (messageUuid: string, content: string) => {
    try {
      await updateMutation.mutateAsync({ messageUuid, content });
    } catch (error) {
      toast.error('Edit failed', {
        description: extractApiError(error).message,
      });
      throw error;
    }
  };

  const handleDelete = (messageUuid: string) => {
    deleteMutation.mutate(messageUuid, {
      onError: (error) =>
        toast.error('Delete failed', {
          description: extractApiError(error).message,
        }),
    });
  };

  const renderMessageArea = () => {
    if (isLoading) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-4">
          <MessageListSkeleton />
        </div>
      );
    }
    if (isError) {
      return (
        <div className="flex h-full items-center justify-center px-4">
          <ErrorState
            title="Couldn't load messages"
            description="We couldn't load this channel's history. Please try again."
            retry={() => refetch()}
          />
        </div>
      );
    }
    if (messages.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-4">
          <EmptyState
            icon={MessagesSquare}
            title="No messages yet"
            description={`Say hello in #${channel.name}.`}
          />
        </div>
      );
    }
    return (
      <div
        ref={contentRefCallback}
        className="mx-auto mt-auto w-full max-w-3xl px-4 pt-4 pb-28"
      >
        {hasNextPage ? (
          <div className="flex justify-center pb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadOlder}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
              Load older messages
            </Button>
          </div>
        ) : (
          <p className="pb-4 text-center text-xs text-muted-foreground">
            This is the beginning of #{channel.name}.
          </p>
        )}

        <div className="space-y-5">
          {renderItems.map((item) => {
            if (item.kind === 'day') {
              return (
                <div key={item.key} className="relative py-1 text-center">
                  <span className="absolute inset-x-0 top-1/2 -z-10 border-t" />
                  <span className="rounded-full border bg-background px-3 py-0.5 text-xs font-medium text-muted-foreground">
                    {item.label}
                  </span>
                </div>
              );
            }
            if (item.kind === 'ai_divider') {
              return (
                <div key={item.key} className="relative py-1 text-center">
                  <span className="absolute inset-x-0 top-1/2 -z-10 border-t border-primary/20" />
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background px-3 py-0.5 text-xs font-medium text-primary">
                    <Sparkles className="size-3" />
                    {item.label}
                  </span>
                </div>
              );
            }
            if (item.kind === 'responding') {
              const { turn } = item;
              const watching = watchId === turn.executionId;
              return (
                <div key={item.key} className="space-y-2">
                  <LawexaRespondingRow
                    summonerName={turn.summoner.name}
                    watching={watching}
                    onToggleWatch={() =>
                      setWatchId((cur) => {
                        // Reopening should scroll again: forget the prior open.
                        peekScrolledRef.current.delete(turn.executionId);
                        return cur === turn.executionId ? null : turn.executionId;
                      })
                    }
                  />
                  {watching && (
                    <div
                      ref={peekRefCallback}
                      data-execution-id={turn.executionId}
                      className="pl-11 pr-1"
                    >
                      <LawexaGlancePanel
                        key={turn.executionId}
                        executionId={turn.executionId}
                        summonerName={turn.summoner.name}
                        onClose={() => {
                          peekScrolledRef.current.delete(turn.executionId);
                          setWatchId(null);
                        }}
                        inline
                      />
                    </div>
                  )}
                </div>
              );
            }
            return (
              <MessageGroup
                key={item.group.key}
                group={item.group}
                permissionsFor={permissionsFor}
                animationFor={animationFor}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('relative flex flex-col', className)}>
      <div
        ref={scrollRef}
        onScroll={syncAtBottom}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {renderMessageArea()}
      </div>

      {/* Floating footer — overlaid on the scroll area (not stacked below it) so
          the scrollbar runs the full height and messages stay visible above and
          around the composer. The gutters fall through to the messages behind;
          only the typing label + composer capture pointer events. Lawexa's
          "responding" affordance now lives inline in the feed, anchored under
          the summoning message, not here. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        {/* Scroll-to-bottom — appears only when the reader is scrolled up (or an
            AI reply has grown below the fold). Sits just above the composer and
            is the only interactive element in the non-typing gutter. */}
        {!isAtBottom && !isLoading && !isError && messages.length > 0 && (
          <div className="pointer-events-none mb-2 flex justify-center">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={scrollToBottom}
              aria-label="Scroll to latest messages"
              className="pointer-events-auto size-9 rounded-full border shadow-md animate-in fade-in zoom-in-95 duration-200"
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>
        )}

        {(() => {
          const label = typingLabel(realtime.typingUsers);
          return (
            <div className="mx-auto h-5 w-full max-w-xs px-4 text-xs text-muted-foreground sm:max-w-md">
              {label && (
                <span className="rounded bg-background/80 px-1 backdrop-blur animate-pulse">
                  {label}
                </span>
              )}
            </div>
          );
        })()}

        {channel.is_member ? (
          <MessageComposer
            channelUuid={channel.uuid}
            channelName={channel.name}
            onSent={scrollToBottom}
            onTyping={realtime.notifyTyping}
          />
        ) : (
          <div className="pointer-events-auto mx-auto max-w-xs px-4 pb-4 sm:max-w-md">
            <div className="rounded-2xl border bg-background/80 px-4 py-3 text-center text-sm text-muted-foreground backdrop-blur">
              You&apos;re not a member of this channel.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
