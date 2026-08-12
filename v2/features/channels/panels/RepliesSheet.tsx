'use client';

import { useQuery } from '@tanstack/react-query';
import { MessagesSquare } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { messagesApi } from '@/lib/api/collab';
import { formatFullTimestamp, formatMessageTime } from '@/lib/utils/collab';
import type { Message, SlimUser } from '@/types/collab';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { MemberAvatar } from '../ui/avatars';
import { MessageContent } from '../feed/MessageContent';

/**
 * RepliesSheet — one message and everything said in answer to it, gathered.
 *
 * ── WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT ──────────────────────────
 * It is a READING surface. The replies it shows are still in the channel where
 * they always were; this only lets somebody follow one conversation without
 * scrolling past everything else that happened around it. It is NOT a thread:
 * a thread would take the answers out of the room and make the channel quieter,
 * and that is a separate, larger feature (a sub-channel, per the channels plan).
 * Saying so here because the difference is easy to blur, and the owner asked us
 * to stop blurring it.
 *
 * ── ONE LEVEL, ON PURPOSE ─────────────────────────────────────────────────
 * A reply can itself have replies — the data is a tree, and each row carries its
 * own `reply_count`. This shows the root and its direct answers and stops. A
 * panel that recursed would be a second feed with its own scroll and its own
 * unread problem, which is the thing the design rules out.
 *
 * ── AND IT IS READ-ONLY ───────────────────────────────────────────────────
 * There is no composer here. Replying still happens in the channel, through the
 * existing reply action, which keeps ONE place where messages are written. A
 * composer in this panel would make it a second room to type in without any of
 * the machinery a room needs — drafts, mentions, attachments, the outbox.
 */

function ReplyRow({
  message,
  viewerUuid,
}: {
  message: Message;
  viewerUuid: string | null;
}) {
  const author: SlimUser | null = message.author;
  return (
    <li className="flex gap-2.5 py-2.5">
      {author ? (
        <MemberAvatar user={author} size="sm" />
      ) : (
        <span
          aria-hidden
          className="size-8 shrink-0 rounded-full bg-secondary"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">
            {author?.name ?? 'Deleted account'}
          </span>
          {/* The clock, not the full date. A conversation is read as a run, so
              repeating "Aug 12, 2026" on every row is noise; the exact stamp
              stays on hover, exactly as the feed does it. */}
          <time
            dateTime={message.created_at}
            title={formatFullTimestamp(message.created_at)}
            className="shrink-0 text-[11px] text-muted-foreground"
          >
            {formatMessageTime(message.created_at)}
          </time>
        </div>
        <MessageContent
          content={message.content}
          metadata={message.metadata}
          viewerUuid={viewerUuid}
        />
      </div>
    </li>
  );
}

export function RepliesSheet({
  channelUuid,
  root,
  viewerUuid,
  open,
  onOpenChange,
}: {
  channelUuid: string;
  /** The message being answered. `null` while the panel is closing. */
  root: Message | null;
  /** So a mention of the reader lights up here exactly as it does in the feed. */
  viewerUuid: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ['message-replies', channelUuid, root?.uuid],
    queryFn: () => messagesApi.replies(channelUuid, root!.uuid),
    enabled: open && root !== null,
  });

  const replies = query.data?.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Replies</SheetTitle>
          <SheetDescription>
            Everything said in answer to this message. They are still in the
            channel too.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {root && (
            /* The message being answered, so the panel opens with its subject
               rather than with a list of answers to something off screen. */
            <div className="rounded-xl border border-border/60 bg-secondary/40 p-3">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">
                  {root.author?.name ?? 'Deleted account'}
                </span>
                <time
                  dateTime={root.created_at}
                  title={formatFullTimestamp(root.created_at)}
                  className="shrink-0 text-[11px] text-muted-foreground"
                >
                  {formatMessageTime(root.created_at)}
                </time>
              </div>
              <MessageContent
                content={root.content}
                metadata={root.metadata}
                viewerUuid={viewerUuid}
              />
            </div>
          )}

          {query.isPending ? (
            <div aria-hidden className="space-y-3 pt-4">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : query.isError ? (
            <CollabFailure
              presentation="panel"
              icon={MessagesSquare}
              title="Couldn't load the replies"
              message="Something went wrong at our end. Try again in a moment."
              onRetry={() => void query.refetch()}
            />
          ) : replies.length === 0 ? (
            /* Reachable: the count comes from a list that may be seconds old,
               and a reply can be deleted between the feed drawing "1 reply" and
               this panel asking for it. Deleted replies leave both the count and
               the list, so the honest answer is that there is nothing here now. */
            <CollabMessage
              icon={MessagesSquare}
              tone="neutral"
              title="No replies now"
              description="They may have been deleted since this was last loaded."
            />
          ) : (
            <ul className="divide-y pt-2">
              {replies.map((reply) => (
                <ReplyRow key={reply.uuid} message={reply} viewerUuid={viewerUuid} />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
