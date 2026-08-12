import Link from 'next/link';
import { GitBranch } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { Channel } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { threadParentHref } from '../thread-model';
import { MESSAGE_MEASURE } from './measure';

/**
 * ThreadOpening — what a thread branched from, at the head of its transcript.
 *
 * It stands where `ChannelIntro` stands in a channel, and for the same
 * reason: a room should say what it is every time you reach its beginning, not
 * only on the day it was empty. What a thread IS, though, is not a crest and a
 * member count — it is one message in another conversation.
 *
 * ── IT BORROWS `ReplyQuote`'s GRAMMAR ON PURPOSE ───────────────────────────
 * A rule down the left, a glyph, the author, then the words. That grammar
 * already means "this is a message from somewhere else" everywhere else in the
 * feed, and the alternative — drawing the root as an ordinary first message —
 * would be a lie the reader acts on: they would reply to it expecting the
 * author to be answered in the place they wrote it, and edit and delete would
 * be missing from a row that looks exactly like every row that has them. The
 * root lives in the PARENT. It is quoted here, never hosted.
 *
 * ── THREE STATES, AND THE THIRD IS TWO THINGS AT ONCE ──────────────────────
 *  - ALIVE — author, preview, and the channel it came from, as one link back to
 *    that message. Tappable because the quote is a pointer and the reader will
 *    want the surrounding conversation.
 *  - DELETED (`is_deleted`) — the author is KEPT and the words are gone
 *    (`content_preview` is `null`, never `""`). Not tappable: the target still
 *    resolves server-side, but there is nothing to land on.
 *  - ABSENT (`root_message: null`) — a thread started cold AND a thread whose
 *    root was HARD-deleted are the same `null` on the wire, indistinguishable.
 *    So the sentence says only what is true of both: there is no first message.
 *
 * IT CARRIES NO TIME, because the payload carries none — `root_message` has no
 * `created_at` (measured against `ChannelResource`, 2026-08-12). A date guessed
 * from the thread's own `created_at` would be the moment somebody branched it,
 * not the moment the message was written, and those can be days apart.
 */
export function ThreadOpening({
  channel,
  parentName,
}: {
  channel: Channel;
  /** `null` while the parent's name is still resolving — a bar, never a word. */
  parentName: string | null;
}) {
  const root = channel.root_message ?? null;
  const href = threadParentHref(channel);

  return (
    <div className="pb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {root === null ? (
        <p className={cn('text-sm text-muted-foreground', MESSAGE_MEASURE)}>
          <GitBranch aria-hidden className="mr-1.5 inline size-3.5 align-[-2px]" />
          This thread doesn&rsquo;t have a first message.
        </p>
      ) : root.is_deleted ? (
        <p className={cn('text-sm text-muted-foreground italic', MESSAGE_MEASURE)}>
          <GitBranch
            aria-hidden
            className="mr-1.5 inline size-3.5 align-[-2px] not-italic"
          />
          {root.author?.name ?? 'A deleted member'}&rsquo;s message started this.
          It has since been deleted.
        </p>
      ) : (
        <RootQuote
          href={href}
          authorName={root.author?.name ?? 'Deleted member'}
          preview={root.content_preview ?? ''}
          parentName={parentName}
        />
      )}
    </div>
  );
}

/**
 * The living root. A LINK, not a button: it goes to a message in another
 * channel, which is an address (`/channels/{parent}?m={root}`) and therefore
 * openable in a new tab, copyable, and restorable by Back.
 *
 * `href` can only be `null` if the payload named no parent, which the server
 * always does for a thread. The quote then stays exactly as it is and simply
 * does not travel — a dead link would be worse than a block that sits still.
 */
function RootQuote({
  href,
  authorName,
  preview,
  parentName,
}: {
  href: string | null;
  authorName: string;
  preview: string;
  parentName: string | null;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs">
        <GitBranch aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate font-medium text-foreground/80">
          {authorName}
        </span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        {parentName === null ? (
          <Skeleton aria-hidden className="h-3 w-20 rounded" />
        ) : (
          <span className="min-w-0 truncate text-muted-foreground">
            in {parentName}
          </span>
        )}
      </span>
      <span className={cn('block pt-1 text-sm leading-relaxed', MESSAGE_MEASURE)}>
        {preview}
      </span>
    </>
  );

  const frame = 'block border-l-2 border-primary/50 pl-3';

  if (href === null) {
    return <div className={frame}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        'v2-interactive',
        frame,
        'rounded-r-sm text-foreground/90',
        'transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
        FOCUS_RING,
      )}
    >
      {body}
    </Link>
  );
}
