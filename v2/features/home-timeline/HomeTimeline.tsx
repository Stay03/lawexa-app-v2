'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  Loader2,
  Music,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { Button } from '@/components/ui/button';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { memberStyle } from '@/v2/features/conversations/conversation/member-colour';
import {
  invitationRowKey,
  usePendingInvitationResponses,
  useRespondToInvitation,
} from '@/v2/features/invitations/mutations';
import { useV2Session } from '@/v2/runtime/session-context';
import { CONTENT_FADE, FOCUS_RING } from '@/v2/shell/designs/modules';
import { LogoMark } from '@/v2/shell/Logo';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useMounted } from '@/v2/shell/use-mounted';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { readLastSeen, writeLastSeen } from './last-seen';
import { homeTimelineQueries } from './queries';
import {
  canScrollForMore,
  followEmptyCursor,
  moreFilesLabel,
  newestAt,
  newSinceRowKey,
  timelineDays,
  type TimelineCard,
  type TimelineIcon,
  type TimelineLead,
  type TimelineMeta,
  type TimelineRow,
} from './row-model';
import {
  TimelineEmptyState,
  TimelineErrorState,
  TimelineHeading,
  TimelineNextPageSkeleton,
  TimelinePageError,
  TimelineSkeleton,
} from './states';
import type { TimelineType } from './types';

/**
 * HomeTimeline — the Work and Study tabs: what happened in the reader's
 * Spaces, day by day (Stay said yes to the design, 24 October 2026; the mock
 * is `journeys/results/timeline-final/mocks3.html`; the techlead's nine fixes
 * after Stay's "criticize the ui/ux design", 25 October 2026).
 *
 * ── THE LIST STARTS AT THE TOP ─────────────────────────────────────────────
 * No big heading over it (fix 2): the tab already says Work or Study, and the
 * rows are the content. The page keeps its name for screen readers in an
 * `sr-only` h1.
 *
 * ── ONE ROW, ONE CARD ──────────────────────────────────────────────────────
 * Every event is the Space list's row (`spaces/detail/content/feed-rows.tsx`):
 * a 20px mark, a title that says who did what, one grey line, the time on the
 * title's baseline. The mark is ONE kind (fix 4): the person's initials in
 * their member colour, Lawexa's mark, or a neutral "?" for a deleted account.
 * The grey line starts with the Space's name, its own link (fix 3), so the row
 * opens through its TITLE, whose link is stretched over the row; a link inside
 * a link is not allowed, and the Space link sits above the stretched one.
 * Under a row sits at most one card, and every card is the same card (16px
 * corners, a hairline border, the card ground, the chat cards' padding).
 *
 * GOLD IS ONLY ON ACCEPT. Nothing else on the timeline is an action the reader
 * is being asked to take, so nothing else wears the accent.
 *
 * ── NEW SINCE YOUR LAST VISIT (fix 8) ──────────────────────────────────────
 * A hairline with small muted words between the rows that are new and the ones
 * the reader has seen. The last visit is read ONCE, at mount, so the line
 * never moves while they look; the newest time on screen is written back when
 * they leave (unmount, page hide) or after {@link SEEN_AFTER_MS} on the list
 * (`last-seen.ts`, this device only).
 *
 * ── HAIRLINES ──────────────────────────────────────────────────────────────
 * Between the rows of a day, inset to the title column (the Folders view's
 * `border/40`), and none above a day's first row or below its last.
 *
 * ── TIME ───────────────────────────────────────────────────────────────────
 * The clock is read once, at mount, and only used after hydration (`useMounted`):
 * the server and the browser read it seconds apart, and a row near a minute or
 * a midnight would otherwise print differently on each (React #418). Until then
 * the skeleton stands, so no day heading ever changes under the reader. The
 * days are cut in the browser's own time zone.
 *
 * ── PAGING ─────────────────────────────────────────────────────────────────
 * Cursor-paged; the next page loads 320px before the end, measured against the
 * shell's own scroller. An empty page that still carries a cursor is followed
 * at once, five in a row at most.
 */
export function HomeTimeline({ type }: { type: TimelineType }) {
  const { userId } = useV2Session();
  const mounted = useMounted();
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [clock] = useState(() => Date.now());
  // The last visit, read once: the "new since" line holds still while the list is read.
  const [lastSeen] = useState(() => readLastSeen(type));

  const query = useInfiniteQuery({
    ...homeTimelineQueries.list({ type, viewerId: userId }),
    enabled: userId !== null,
  });

  const pages = query.data?.pages;
  const days = useMemo(
    () => (pages && mounted ? timelineDays(pages.flatMap((page) => page.events), clock) : []),
    [pages, mounted, clock],
  );
  const newSinceKey = useMemo(() => newSinceRowKey(days, lastSeen), [days, lastSeen]);
  const newest = useMemo(() => newestAt(days), [days]);

  // Seen: written when the reader leaves, or once the list has been on screen
  // a while. Never read back during this visit.
  useEffect(() => {
    if (newest === null) return;
    const write = () => writeLastSeen(type, newest);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') write();
    };
    const timer = window.setTimeout(write, SEEN_AFTER_MS);
    window.addEventListener('pagehide', write);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', write);
      document.removeEventListener('visibilitychange', onVisibility);
      write();
    };
  }, [type, newest]);

  // An empty page that still carries a cursor is followed at once, up to five
  // in a row (`followEmptyCursor`): the empty state is only for a timeline
  // that is really empty.
  const following = pages !== undefined && followEmptyCursor(pages, query.hasNextPage);
  const { fetchNextPage, isFetchingNextPage, isFetchNextPageError } = query;
  useEffect(() => {
    if (following && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [following, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    // A failed page is not retried by scrolling; its line carries the retry.
    // Past five empty pages in a row the list stops and shows what it has.
    hasNextPage:
      pages !== undefined && canScrollForMore(pages, query.hasNextPage) && !query.isFetchNextPageError,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const apiError = query.error ? extractApiError(query.error) : null;
  const loaded = pages !== undefined && mounted;

  let body: ReactNode;
  if (query.isError && !pages) {
    body = (
      <TimelineErrorState
        message={apiError && apiError.status >= 400 && apiError.status < 500 ? apiError.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (!loaded) {
    body = <TimelineSkeleton />;
  } else if (days.length === 0 && following) {
    body = <TimelineSkeleton />;
  } else if (days.length === 0) {
    body = <TimelineEmptyState type={type} />;
  } else {
    body = (
      <>
        <div className={cn('flex flex-col gap-8', CONTENT_FADE)}>
          {days.map((day) => {
            // The line sits above a day whose first row is the first one seen,
            // and between two rows otherwise.
            const lineAboveDay = day.rows[0]?.key === newSinceKey;
            return (
              <div key={day.key} className="flex min-w-0 flex-col gap-8">
                {lineAboveDay ? <NewSinceLine /> : null}
                <section aria-label={day.label} className="min-w-0">
                  <h2 className="mb-1.5 text-sm font-semibold text-foreground">{day.label}</h2>
                  <ul className="flex flex-col">
                    {day.rows.map((row, index) =>
                      index > 0 && row.key === newSinceKey ? (
                        <NewSinceRow key={`new-since-${row.key}`} row={row} />
                      ) : (
                        <TimelineRowItem key={row.key} row={row} />
                      ),
                    )}
                  </ul>
                </section>
              </div>
            );
          })}
        </div>
        <div ref={sentinelRef} className="pt-1">
          {query.isFetchingNextPage ? (
            <TimelineNextPageSkeleton />
          ) : query.isFetchNextPageError ? (
            <TimelinePageError onRetry={() => void query.fetchNextPage()} />
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <TimelineHeading type={type} />
      {body}
    </>
  );
}

/** How long the list is on screen before it counts as seen. */
const SEEN_AFTER_MS = 5_000;

/* ── New since your last visit ───────────────────────────────────────────── */

const NEW_SINCE_WORDS = 'New since your last visit';

/** The line itself: small muted words and a hairline. No gold, no dot. */
function NewSinceLine({ className }: { className?: string }) {
  return (
    <div role="separator" aria-label={NEW_SINCE_WORDS} className={cn('flex items-center gap-3 px-3', className)}>
      <span aria-hidden className="shrink-0 text-[11px] leading-4 text-muted-foreground">
        {NEW_SINCE_WORDS}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

/** The line between two rows of one day, then the first row already seen. Its
 *  own hairline replaces that row's. */
function NewSinceRow({ row }: { row: TimelineRow }) {
  return (
    <>
      <li className="py-2">
        <NewSinceLine />
      </li>
      <TimelineRowItem row={row} hairline={false} />
    </>
  );
}

/* ── The row ─────────────────────────────────────────────────────────────── */

const ICONS: Readonly<Record<TimelineIcon, LucideIcon>> = {
  document: FileText,
  image: ImageIcon,
  video: Film,
  audio: Music,
  folder: Folder,
};

/** The row's head: the mark, the title with the time, the grey line. */
const HEAD = 'relative flex min-h-14 min-w-0 items-start gap-3 rounded-xl px-3 py-2.5 text-left';
const HEAD_HOVER = 'transition-colors duration-150 hover:bg-secondary/50 motion-reduce:transition-none';

/** The title's link, stretched over the whole head so the row is the target. */
const TITLE_LINK = cn(
  'v2-interactive min-w-0 truncate text-sm font-medium text-foreground outline-none',
  'after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring',
);

/** A person's face in their member colour (`member-colour.ts`), at the lead's 20px. */
const PERSON_TINT =
  '[&_[data-slot=avatar-fallback]]:bg-[var(--member-bg)] [&_[data-slot=avatar-fallback]]:text-[var(--member-ink)] dark:[&_[data-slot=avatar-fallback]]:bg-[var(--member-bg-dark)] dark:[&_[data-slot=avatar-fallback]]:text-[var(--member-ink-dark)]';

/** The initials at 20px: two letters at 8px fit the disc. */
const INITIALS_20 =
  'size-5 [&_[data-slot=avatar-fallback]]:text-[8px] [&_[data-slot=avatar-fallback]]:font-semibold [&_[data-slot=avatar-fallback]]:tracking-[0.02em]';

function Lead({ lead }: { lead: TimelineLead }) {
  if (lead.type === 'lawexa') return <LogoMark className="size-5 shrink-0" alt="" />;
  if (lead.type === 'unknown') {
    // A deleted account: a neutral "?" circle, no colour, no face.
    return (
      <span aria-hidden className="flex shrink-0">
        <MemberAvatar user={{ name: '?', avatar_url: null }} className={INITIALS_20} />
      </span>
    );
  }
  // The member colour's custom properties ride a wrapper, as in a space
  // chat's turn (`SpaceTurn`): they are per person, so they cannot be classes.
  return (
    <span aria-hidden className="flex shrink-0" style={memberStyle(lead.tint)}>
      <MemberAvatar
        user={{ name: lead.name, avatar_url: lead.avatar }}
        className={cn(INITIALS_20, PERSON_TINT)}
      />
    </span>
  );
}

/**
 * The grey line: the Space's name first, at its own width and its own link,
 * then the rest, which is what a narrow screen cuts.
 */
function MetaLine({ meta }: { meta: TimelineMeta }) {
  return (
    <span className="mt-0.5 flex min-w-0 text-xs text-muted-foreground">
      <Link
        href={meta.space.href}
        title={meta.space.name}
        className="relative z-10 max-w-full shrink-0 truncate rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        {meta.space.name}
      </Link>
      {meta.rest ? (
        <span className="min-w-0 truncate">
          {'\u00a0·\u00a0'}
          {meta.rest}
        </span>
      ) : null}
    </span>
  );
}

function TimelineRowItem({ row, hairline = true }: { row: TimelineRow; hairline?: boolean }) {
  return (
    <li
      className={cn(
        'relative flex min-w-0 flex-col',
        // The hairline between rows, inset to the title column.
        hairline &&
          'not-first:before:absolute not-first:before:top-0 not-first:before:right-3 not-first:before:left-11 not-first:before:h-px not-first:before:bg-border/40',
      )}
    >
      <div className={cn(HEAD, row.href && HEAD_HOVER)}>
        <Lead lead={row.lead} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            {row.href ? (
              <Link href={row.href} title={row.title} className={TITLE_LINK}>
                {row.title}
              </Link>
            ) : (
              <span title={row.title} className="min-w-0 truncate text-sm font-medium text-foreground">
                {row.title}
              </span>
            )}
            {row.time ? (
              <span className="ml-auto shrink-0 pl-1 text-xs tabular-nums text-muted-foreground">{row.time}</span>
            ) : null}
          </span>
          <MetaLine meta={row.meta} />
        </span>
      </div>
      {row.card ? (
        <div className="pr-3 pb-2.5 pl-11">
          <RowCard card={row.card} />
        </div>
      ) : null}
    </li>
  );
}

/* ── The one card ────────────────────────────────────────────────────────── */

/** The one card (DraftCard / CreatedQuizCard's corners and ground). */
const CARD = 'rounded-2xl border border-border bg-card px-3.5 py-3';

/** Reply: a quiet text button, never the accent. */
const QUIET_BUTTON = cn(
  'v2-interactive -my-1 -mr-1.5 shrink-0 rounded-lg px-2 py-1 text-[13px] font-medium leading-5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground motion-reduce:transition-none',
  FOCUS_RING,
);

function RowCard({ card }: { card: TimelineCard }) {
  switch (card.type) {
    case 'quote':
      return (
        <div className={cn(CARD, 'flex items-center gap-3')}>
          <p className="line-clamp-2 min-w-0 flex-1 text-sm text-foreground/88">{card.text}</p>
          <Link href={card.replyHref} className={QUIET_BUTTON}>
            Reply
          </Link>
        </div>
      );
    case 'chat':
      // The question on one line, then the first line of the answer (fix 5).
      return (
        <Link
          href={card.href}
          className={cn(
            CARD,
            'group v2-interactive flex items-center gap-3 transition-colors duration-150 hover:bg-secondary/50 motion-reduce:transition-none',
            FOCUS_RING,
          )}
        >
          <span className="min-w-0 flex-1">
            <span title={card.question} className="block truncate text-sm font-medium text-foreground">
              {card.question}
            </span>
            {card.answer ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{card.answer}</span>
            ) : null}
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      );
    case 'invite':
      return <InviteCard card={card} />;
    case 'files':
      return (
        <div className={CARD}>
          <ul className="flex flex-col gap-2.5">
            {card.files.map((file) => {
              const Icon = ICONS[file.icon];
              return (
                <li key={file.key} className="flex min-w-0 items-center gap-2.5">
                  <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span title={file.name} className="min-w-0 truncate text-sm font-medium text-foreground">
                    {file.name}
                  </span>
                  {file.size ? (
                    <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">{file.size}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {card.more > 0 ? (
            <p className="mt-2.5 text-xs text-muted-foreground">{moreFilesLabel(card.more)}</p>
          ) : null}
        </div>
      );
  }
}

/**
 * The invitation: the Space, what it is, and the answer. Accept and Decline are
 * the invitations inbox's own mutation (`invitations/mutations.ts`), keyed by
 * the member-row id the event's action carries; the answer also re-asks this
 * timeline, so the buttons leave once the server has it. While it is in
 * flight both buttons hold still and the pressed one shows it is working.
 */
function InviteCard({ card }: { card: Extract<TimelineCard, { type: 'invite' }> }) {
  const respond = useRespondToInvitation();
  const pending = usePendingInvitationResponses();
  const id = card.invitationId;
  const busy = id === null ? undefined : pending.get(invitationRowKey('space', id));

  return (
    <div className={cn(CARD, 'flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-3')}>
      <span className="min-w-0 max-w-full flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{card.spaceName}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{card.facts}</span>
      </span>
      {id !== null ? (
        <span className="flex shrink-0 gap-1.5">
          <Button
            size="sm"
            className="h-8 rounded-full px-3.5 text-[13px] font-semibold"
            disabled={busy !== undefined}
            onClick={() => respond.mutate({ kind: 'space', id, action: 'accept' })}
          >
            {busy === 'accept' ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full bg-transparent px-3.5 text-[13px] hover:bg-secondary"
            disabled={busy !== undefined}
            onClick={() => respond.mutate({ kind: 'space', id, action: 'decline' })}
          >
            {busy === 'decline' ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Decline
          </Button>
        </span>
      ) : null}
    </div>
  );
}
