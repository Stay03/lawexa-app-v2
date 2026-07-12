'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Loader2, MessagesSquare } from 'lucide-react';
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
import type { ChannelRealtime } from '@/lib/hooks/useChannelRealtime';
import type { Channel, Message } from '@/types/collab';

import { MessageComposer } from './MessageComposer';
import { MessageGroup, type MessageGroupData } from './MessageGroup';
import { MessageListSkeleton } from './skeletons';

/** Consecutive messages from one author within this window share an avatar. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

type RenderItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'group'; group: MessageGroupData };

/** Collapse a chronological message list into day separators + author groups. */
function buildRenderItems(messages: Message[]): RenderItem[] {
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

    const last = group?.messages[group.messages.length - 1];
    const sameAuthor =
      group && (group.author?.uuid ?? null) === (message.author?.uuid ?? null);
    const withinWindow =
      last &&
      new Date(message.created_at).getTime() -
        new Date(last.created_at).getTime() <
        GROUP_WINDOW_MS;
    const isReply = message.parent_message_uuid !== null;

    if (group && sameAuthor && withinWindow && !isReply) {
      group.messages.push(message);
    } else {
      group = { key: message.uuid, author: message.author, messages: [message] };
      items.push({ kind: 'group', group });
    }
  });

  return items;
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
  const renderItems = useMemo(() => buildRenderItems(messages), [messages]);

  const newestRealUuid = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (!messages[i].uuid.startsWith('optimistic-')) return messages[i].uuid;
    }
    return null;
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const restoreFromHeight = useRef<number | null>(null);
  const atBottomRef = useRef(true);

  // Advance the read pointer to the newest real message whenever it changes.
  useEffect(() => {
    if (channel.is_member && newestRealUuid) markReadMutate(newestRealUuid);
  }, [channel.is_member, newestRealUuid, markReadMutate]);

  // Pin to newest on load; hold position when older pages prepend; follow new
  // messages only when the reader is already at the bottom.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (!didInitialScroll.current && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
      didInitialScroll.current = true;
      return;
    }
    if (restoreFromHeight.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFromHeight.current;
      restoreFromHeight.current = null;
      return;
    }
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = true;
    el.scrollTop = el.scrollHeight;
  };

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
      <div className="mx-auto mt-auto w-full max-w-3xl px-4 pt-4 pb-28">
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
          {renderItems.map((item) =>
            item.kind === 'day' ? (
              <div key={item.key} className="relative py-1 text-center">
                <span className="absolute inset-x-0 top-1/2 -z-10 border-t" />
                <span className="rounded-full border bg-background px-3 py-0.5 text-xs font-medium text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ) : (
              <MessageGroup
                key={item.group.key}
                group={item.group}
                permissionsFor={permissionsFor}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
              />
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('relative flex flex-col', className)}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {renderMessageArea()}
      </div>

      {/* Floating footer — overlaid on the scroll area (not stacked below it) so
          the scrollbar runs the full height and messages stay visible above and
          around the composer. Only the pill captures pointer events; the gutters
          fall through to the messages behind. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        {(() => {
          const label = typingLabel(realtime.typingUsers);
          return (
            <div className="mx-auto h-5 w-full max-w-2xl px-4 text-xs text-muted-foreground">
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
          <div className="pointer-events-auto mx-auto max-w-2xl px-4 pb-4">
            <div className="rounded-2xl border bg-background/80 px-4 py-3 text-center text-sm text-muted-foreground backdrop-blur">
              You&apos;re not a member of this channel.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
