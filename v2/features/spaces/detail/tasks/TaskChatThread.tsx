'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { extractApiError } from '@/lib/utils/api-error';
import type { Channel, Message } from '@/types/collab';
import { Button } from '@/components/ui/button';
import { ChannelComposer, type ChannelComposerHandle } from '@/v2/features/channels/composer/ChannelComposer';
import { ChannelFeed, type ChannelFeedHandle } from '@/v2/features/channels/feed/ChannelFeed';
import { useChannelReadPointer } from '@/v2/features/channels/mark-read';
import { useJoinChannel } from '@/v2/features/channels/membership-mutations';
import { channelsQueries } from '@/v2/features/channels/queries';
import { useChannelRoom } from '@/v2/features/channels/room';
import { threadAccess } from '@/v2/features/collab/access';
import { useV2Session } from '@/v2/runtime/session-context';

/**
 * TaskChatThread — a task's linked thread inside the task box's chat pane
 * (design 1805492d: "reuse the channel code instead of building a new feed").
 *
 * The thread's own feed and composer, wired as the thread's page wires them,
 * with a pane's fewer doors:
 *  - the live room only for a reader who may post (`can_post`), as the page
 *    gates it: the presence room admits members of the thread's channel alone;
 *  - the read pointer for a reader who follows the thread, as the page has it,
 *    so "Mark as read" here works as it does there;
 *  - a reader who may read but not post gets "Join #channel to reply" where the
 *    composer stands, which joins the thread's channel (threads themselves are
 *    not joined), and then the composer;
 *  - the AI-session and game doors open the thread's own page, which has the
 *    room for them.
 */
export function TaskChatThread({ channel, canPost, threadHref }: { channel: Channel; canPost: boolean; threadHref: string }) {
  const router = useRouter();
  const session = useV2Session();
  const room = useChannelRoom(channel.uuid, { enabled: canPost });
  // The read pointer as the thread's page gates it: only a reader who follows the thread has one.
  const reporter = useChannelReadPointer(channel.uuid, { enabled: threadAccess(channel).isFollowing });
  const composerRef = useRef<ChannelComposerHandle>(null);
  const feedRef = useRef<ChannelFeedHandle>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const openThreadPage = useCallback(() => router.push(threadHref), [router, threadHref]);

  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0 flex min-h-0 flex-col">
        <ChannelFeed
          ref={feedRef}
          channel={channel}
          parentName={channel.parent_channel_name ?? null}
          viewerId={session.userId}
          viewerUuid={session.userUuid}
          reporter={reporter}
          canParticipate={canPost}
          active
          targetMessageUuid={null}
          members={NO_FACES}
          respondingTurns={room.respondingTurns}
          onStartReply={(message) => {
            setReplyTo(message);
            composerRef.current?.focus();
          }}
          onFocusComposer={() => composerRef.current?.focus()}
          onViewAiSession={openThreadPage}
          onOpenGame={openThreadPage}
          composer={
            canPost ? (
              <ChannelComposer
                ref={composerRef}
                channel={channel}
                viewerId={session.userId}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                onTyping={room.notifyTyping}
                typingUsers={room.typingUsers}
                // The feed shows the reader's own send at once; the pane keeps no read pointer to advance.
                onSentSuccess={NO_OP}
                onOpenFiles={openThreadPage}
                onJumpToMessage={openThreadPage}
              />
            ) : (
              <JoinToReply channel={channel} />
            )
          }
        />
      </div>
    </div>
  );
}

/** The way in for a reader who may read but not post: join the thread's channel. */
function JoinToReply({ channel }: { channel: Channel }) {
  // Threads are not joined (the service answers 422): the parent's membership decides who may reply.
  const join = useJoinChannel(channel.parent_channel_uuid ?? channel.uuid);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const name = channel.parent_channel_name ? `#${channel.parent_channel_name}` : 'the channel';
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-3">
      <p className="text-sm text-muted-foreground">You can read this chat. Join {name} to reply.</p>
      <Button
        type="button"
        size="sm"
        className="w-fit gap-1.5"
        disabled={join.isPending}
        onClick={() => {
          setError(null);
          join.mutate(undefined, {
            // The thread's own answer now says the reader may post: the composer takes the button's place.
            onSuccess: () => void queryClient.invalidateQueries({ queryKey: channelsQueries.detailsOf(channel.uuid) }),
            onError: (failure) => setError(extractApiError(failure).message),
          });
        }}
      >
        {join.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Join {name} to reply
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const NO_FACES: readonly never[] = [];
const NO_OP = () => {};
