'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  FileText,
  Files,
  Film,
  Folder,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Music,
  UserCheck,
  UserCog,
  UserPlus,
  UserRound,
  UserRoundPlus,
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
import { homeTimelineQueries } from './queries';
import {
  canScrollForMore,
  followEmptyCursor,
  moreFilesLabel,
  timelineDays,
  type TimelineCard,
  type TimelineIcon,
  type TimelineLead,
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
 * is `journeys/results/timeline-final/mocks3.html`).
 *
 * ── ONE ROW, ONE CARD ──────────────────────────────────────────────────────
 * Every event is the Space list's row (`spaces/detail/content/feed-rows.tsx`):
 * a 20px lead, the title, one grey meta line, the time on the title's
 * baseline. Under a row sits at most one card, and every card is the same
 * card (16px corners, a hairline border, the card ground, the chat cards'
 * padding). `row-model.ts` decides which row and which card; this file only
 * draws them.
 *
 * GOLD IS ONLY ON ACCEPT. Nothing else on the timeline is an action the reader
 * is being asked to take, so nothing else wears the accent: the leads are grey,
 * Reply is a quiet text button, Decline is an outline.
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
 * shell's own scroller.
 */
export function HomeTimeline({ type }: { type: TimelineType }) {
  const { userId } = useV2Session();
  const mounted = useMounted();
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [clock] = useState(() => Date.now());

  const query = useInfiniteQuery({
    ...homeTimelineQueries.list({ type, viewerId: userId }),
    enabled: userId !== null,
  });

  const pages = query.data?.pages;
  const days = useMemo(
    () => (pages && mounted ? timelineDays(pages.flatMap((page) => page.events), clock) : []),
    [pages, mounted, clock],
  );

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
        <div className={cn('mt-[42px] flex flex-col gap-8', CONTENT_FADE)}>
          {days.map((day) => (
            <section key={day.key} aria-label={day.label} className="min-w-0">
              <h2 className="mb-1.5 text-sm font-semibold text-foreground">{day.label}</h2>
              <ul className="flex flex-col">
                {day.rows.map((row) => (
                  <TimelineRowItem key={row.key} row={row} />
                ))}
              </ul>
            </section>
          ))}
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

/* ── The row ─────────────────────────────────────────────────────────────── */

const ICONS: Readonly<Record<TimelineIcon, LucideIcon>> = {
  document: FileText,
  image: ImageIcon,
  video: Film,
  audio: Music,
  files: Files,
  folder: Folder,
  chat: MessageSquare,
  invite: UserPlus,
  joined: UserCheck,
  'join-request': UserRoundPlus,
  'role-request': UserCog,
  person: UserRound,
};

/** The row's head: the lead, the title with the time, the meta line. */
const HEAD = 'flex min-h-14 min-w-0 items-start gap-3 rounded-xl px-3 py-2.5 text-left';
const HEAD_LINK = cn(
  HEAD,
  'group v2-interactive transition-colors duration-150 hover:bg-secondary/50 motion-reduce:transition-none',
  FOCUS_RING,
);

/** A person's face in their member colour (`member-colour.ts`), at the lead's 20px. */
const PERSON_TINT =
  '[&_[data-slot=avatar-fallback]]:bg-[var(--member-bg)] [&_[data-slot=avatar-fallback]]:text-[var(--member-ink)] dark:[&_[data-slot=avatar-fallback]]:bg-[var(--member-bg-dark)] dark:[&_[data-slot=avatar-fallback]]:text-[var(--member-ink-dark)]';

function Lead({ lead }: { lead: TimelineLead }) {
  if (lead.type === 'lawexa') return <LogoMark className="size-5 shrink-0" alt="" />;
  if (lead.type === 'person') {
    // The member colour's custom properties ride a wrapper, as in a space
    // chat's turn (`SpaceTurn`): they are per person, so they cannot be classes.
    return (
      <span className="flex shrink-0" style={memberStyle(lead.tint)}>
        <MemberAvatar
          user={{ name: lead.name, avatar_url: lead.avatar }}
          className={cn(
            'size-5 [&_[data-slot=avatar-fallback]]:text-[8px] [&_[data-slot=avatar-fallback]]:font-semibold [&_[data-slot=avatar-fallback]]:tracking-[0.02em]',
            PERSON_TINT,
          )}
        />
      </span>
    );
  }
  const Icon = ICONS[lead.icon];
  return (
    <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
  );
}

function TimelineRowItem({ row }: { row: TimelineRow }) {
  const head = (
    <>
      <Lead lead={row.lead} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span title={row.title} className="min-w-0 truncate text-sm font-medium text-foreground">
            {row.title}
          </span>
          {row.time ? (
            <span className="ml-auto shrink-0 pl-1 text-xs tabular-nums text-muted-foreground">{row.time}</span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{row.meta}</span>
      </span>
    </>
  );

  return (
    <li
      className={cn(
        'relative flex min-w-0 flex-col',
        // The hairline between rows, inset to the title column.
        'not-first:before:absolute not-first:before:top-0 not-first:before:right-3 not-first:before:left-11 not-first:before:h-px not-first:before:bg-border/40',
      )}
    >
      {row.href ? (
        <Link href={row.href} className={HEAD_LINK}>
          {head}
        </Link>
      ) : (
        <div className={HEAD}>{head}</div>
      )}
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
            <span className="line-clamp-2 text-sm font-medium text-foreground">{card.title}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{card.meta}</span>
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
