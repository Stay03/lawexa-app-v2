'use client';

import { useQuery } from '@tanstack/react-query';
import { Bookmark, BookmarkX, CornerUpRight, Pin, PinOff, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { Channel, Message, PinnedMessage } from '@/types/collab';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useTogglePin, useToggleSave } from '../engagement-mutations';
import { useEngagementThrottled } from '../engagement-throttle';
import { messagePreviewText } from '../model';
import { channelsQueries } from '../queries';
import { channelDisplayName } from '../thread-model';
import { LawexaAvatar, MemberAvatar } from '../ui/avatars';
import { RelativeTime } from '../ui/RelativeTime';

/**
 * MessageCollectionSheet — ONE panel grammar, two collections: the channel's
 * pins (shared) and the viewer's saves (private). Phase-5 W3; sources: plan W3
 * items 2–3, study A4 (both BUILD NEW), design-research DIRECTION 5 ("pins get
 * a small pinned surface off the channel header") and DIRECTION 14 (one feed,
 * one triage point — these are LENSES over the feed, never a second inbox) —
 * 2026-08-04.
 *
 * WHY ONE COMPONENT FOR BOTH. They answer the same question — "the messages
 * this channel decided were worth keeping" vs "the messages I decided were
 * worth keeping" — with the same row, the same jump, and one remove verb each.
 * Two near-identical panels would drift within a wave.
 *
 * WHAT A ROW IS: the author, when it was written, a two-line excerpt, and a
 * quiet second meta line for the collection's own fact (who pinned it, and
 * when). Not a message renderer — mentions, markdown and reactions belong in
 * the transcript. Clicking the row goes THERE, which is the whole point: a
 * pinned surface that becomes a second place to read messages is how a chat app
 * ends up with two feeds.
 *
 * MOUNTS ON OPEN. Both queries are `enabled: open`, so a channel nobody has
 * asked about pays nothing, and the pins list is only invalidated by a
 * `.message.pinned` event when it is already cached (the room's rule).
 *
 * THE JUMP DOES NOT CLOSE THIS SHEET; the screen does, and it must. Closing is
 * a history move now (`useUrlOverlay`): a dismissal POPS the entry the sheet
 * was opened on, so the `?tab=` write that `ChannelScreen.jumpToMessage` makes
 * in the same handler would land on an entry about to be discarded and be
 * undone the moment the popstate arrived. The screen closes IN PLACE instead.
 */

type CollectionKind = 'pins' | 'saved';

export function PinnedMessagesSheet({
  channel,
  viewerId,
  canUnpin,
  open,
  onOpenChange,
  onJumpToMessage,
}: {
  channel: Channel;
  viewerId: number | null;
  /**
   * False for a space member previewing a `space_public` channel they never
   * joined: the pins LIST is open to them, unpinning is not. The list keeps
   * every other affordance — the jump especially, which is the whole point of
   * the panel — and simply loses the verb, rather than showing a control that
   * only 403s.
   */
  canUnpin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJumpToMessage: (messageUuid: string) => void;
}) {
  const query = useQuery({
    ...channelsQueries.pins({ channelUuid: channel.uuid, viewerId }),
    enabled: open,
  });
  const pin = useTogglePin(channel.uuid);
  const pinMutate = pin.mutate;

  return (
    <CollectionSheet
      kind="pins"
      open={open}
      onOpenChange={onOpenChange}
      title="Pinned messages"
      subtitle={`Kept by everyone in ${channelDisplayName(channel)}`}
      emptyTitle="Nothing pinned yet"
      emptyDescription={
        canUnpin
          ? 'Pin a message to keep the decision, the link or the deadline where the whole channel can find it.'
          : 'Nobody has pinned anything in this channel yet.'
      }
      errorDescription="We couldn't load this channel's pins. Please try again."
      isPending={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      rows={query.data?.data ?? []}
      onJumpToMessage={onJumpToMessage}
      removeLabel="Unpin"
      removeIcon={PinOff}
      onRemove={
        canUnpin
          ? (message) => pinMutate({ messageUuid: message.uuid, pinned: false })
          : undefined
      }
    />
  );
}

export function SavedMessagesSheet({
  channel,
  viewerId,
  open,
  onOpenChange,
  onJumpToMessage,
}: {
  channel: Channel;
  viewerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJumpToMessage: (messageUuid: string) => void;
}) {
  const query = useQuery({
    ...channelsQueries.saved({ channelUuid: channel.uuid, viewerId }),
    enabled: open,
  });
  const save = useToggleSave(channel.uuid);
  const saveMutate = save.mutate;
  const throttled = useEngagementThrottled('bookmark');

  return (
    <CollectionSheet
      kind="saved"
      open={open}
      onOpenChange={onOpenChange}
      title="Saved messages"
      subtitle="Private to you — nobody else can see this list"
      emptyTitle="Nothing saved yet"
      emptyDescription="Save a message to come back to it. Saves are private: they never notify anyone and never appear on the message."
      errorDescription="We couldn't load your saved messages. Please try again."
      isPending={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      rows={query.data?.data ?? []}
      onJumpToMessage={onJumpToMessage}
      removeLabel="Remove from saved"
      removeIcon={BookmarkX}
      removeDisabled={throttled}
      onRemove={(message) => saveMutate({ messageUuid: message.uuid, saved: false })}
    />
  );
}

/* ── The shared shell ─────────────────────────────────────────────────────── */

function CollectionSheet({
  kind,
  open,
  onOpenChange,
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  errorDescription,
  isPending,
  isError,
  onRetry,
  rows,
  onJumpToMessage,
  removeLabel,
  removeIcon: RemoveIcon,
  removeDisabled = false,
  onRemove,
}: {
  kind: CollectionKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  errorDescription: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  rows: readonly Message[];
  onJumpToMessage: (messageUuid: string) => void;
  removeLabel: string;
  removeIcon: React.ComponentType<{ className?: string }>;
  removeDisabled?: boolean;
  /** Absent = the collection is READ-ONLY for this viewer and rows carry no
   *  remove button at all (never a disabled one — see `PinnedMessagesSheet`). */
  onRemove?: (message: Message) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Variant-matched width, or these are dead classes — see `SpaceDrawer`.
          The primitive's `data-[side=right]:*` sizing outranks a bare utility,
          so `w-full sm:max-w-md` lost silently and this sheet has been drawing
          at three quarters of a phone screen. */}
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            {kind === 'pins' ? (
              <Pin aria-hidden className="size-4 text-primary" />
            ) : (
              <Bookmark aria-hidden className="size-4 text-primary" />
            )}
            {title}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </SheetHeader>

        <div className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto">
          {isPending ? (
            <CollectionSkeleton />
          ) : isError ? (
            <div className="px-4 py-6">
              <CollabMessage
                icon={WifiOff}
                tone="alert"
                title="Couldn't load this list"
                description={errorDescription}
                action={
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-6">
              <CollabMessage
                icon={kind === 'pins' ? Pin : Bookmark}
                tone="neutral"
                title={emptyTitle}
                description={emptyDescription}
              />
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((message) => (
                <CollectionRow
                  key={message.uuid}
                  message={message}
                  onJump={() => onJumpToMessage(message.uuid)}
                  removeLabel={removeLabel}
                  removeIcon={RemoveIcon}
                  removeDisabled={removeDisabled}
                  onRemove={onRemove ? () => onRemove(message) : undefined}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** `pinned_by`/`pinned_at` only exist on the pins list — narrow rather than
 *  branch on the panel's kind, so the row stays one component. */
function pinnedDetail(message: Message): PinnedMessage | null {
  return 'pinned_at' in message ? (message as PinnedMessage) : null;
}

function CollectionRow({
  message,
  onJump,
  removeLabel,
  removeIcon: RemoveIcon,
  removeDisabled,
  onRemove,
}: {
  message: Message;
  onJump: () => void;
  removeLabel: string;
  removeIcon: React.ComponentType<{ className?: string }>;
  removeDisabled: boolean;
  /** Absent = read-only row: no remove button, and the jump gets the full
   *  width back (`pr-12` reserved space for a control that isn't there). */
  onRemove?: () => void;
}) {
  const authorName = message.is_ai
    ? 'Lawexa'
    : (message.author?.name ?? 'Deleted member');
  const detail = pinnedDetail(message);
  // A pinned or saved message may be nothing but files (backend, 2026-08-05),
  // and `content: ""` would leave this row as an author's name over a blank
  // line. It says what the message carries instead, in italics so the count is
  // never mistaken for something somebody wrote.
  const hasText = message.content.trim() !== '';
  const preview = messagePreviewText(message);

  return (
    <li className="group/row relative">
      {/* The row is the jump. The remove button sits ON it rather than inside
          it — nesting an interactive element in a button is invalid, and a
          stretched-link overlay would swallow the remove click. */}
      <button
        type="button"
        onClick={onJump}
        className={cn(
          'v2-interactive flex w-full items-start gap-3 px-4 py-3 text-left',
          'transition-colors duration-150 hover:bg-muted/60 motion-reduce:transition-none',
          onRemove ? 'pr-12' : 'pr-4',
          FOCUS_RING,
        )}
      >
        {message.is_ai ? (
          <LawexaAvatar size="sm" className="mt-0.5 shrink-0" />
        ) : (
          <MemberAvatar user={message.author} size="sm" className="mt-0.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                'truncate text-sm font-medium',
                !message.is_ai && !message.author && 'text-muted-foreground',
              )}
            >
              {authorName}
            </span>
            <RelativeTime
              iso={message.created_at}
              className="shrink-0 text-xs text-muted-foreground"
            />
          </span>
          <span
            className={cn(
              'mt-0.5 line-clamp-2 block text-sm break-words text-muted-foreground',
              !hasText && 'italic',
            )}
          >
            {preview}
          </span>
          {/* Second meta zone — the collection's own fact, never the
              message's. */}
          {detail && (
            <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80">
              <Pin aria-hidden className="size-3 shrink-0" />
              Pinned by {detail.pinned_by?.name ?? 'a member'}
              <span aria-hidden>·</span>
              <RelativeTime iso={detail.pinned_at} />
            </span>
          )}
          <span className="sr-only">Jump to this message</span>
        </span>
        <CornerUpRight
          aria-hidden
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 motion-reduce:transition-none"
        />
      </button>

      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          title={removeLabel}
          disabled={removeDisabled}
          onClick={onRemove}
          className={cn(
            'v2-interactive absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground',
            'transition-[color,background-color,opacity] duration-150 motion-reduce:transition-none',
            'hover:bg-muted hover:text-foreground',
            // Reachable on touch (always visible there), quiet on pointer devices
            // until the row is hovered or the button itself is focused.
            '[@media(hover:hover)_and_(pointer:fine)]:opacity-0',
            '[@media(hover:hover)_and_(pointer:fine)]:group-hover/row:opacity-100',
            'focus-visible:opacity-100',
            removeDisabled && 'pointer-events-none opacity-50',
            FOCUS_RING,
          )}
        >
          <RemoveIcon className="size-4" />
        </button>
      )}
    </li>
  );
}

function CollectionSkeleton() {
  return (
    <div aria-hidden className="divide-y">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="flex items-start gap-3 px-4 py-3"
          style={{ opacity: Math.max(0.3, 1 - index * 0.2) }}
        >
          <Skeleton className="mt-0.5 size-6 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
            <Skeleton className="h-3.5 w-4/5 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
