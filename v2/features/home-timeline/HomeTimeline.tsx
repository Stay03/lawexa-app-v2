'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  AtSign,
  FileText,
  Folder,
  Loader2,
  Mail,
  MessageCircle,
  Reply,
  UserCog,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { Button } from '@/components/ui/button';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
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
  newestAt,
  newSinceRowKey,
  timelineDays,
  todayUpdates,
  type TimelineBadge,
  type TimelineLead,
  type TimelineRow,
  type TimelineSentence,
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
 * ── ACTIVITY (Stay, 24 October 2026: "It's too raw, basically and empty. Use
 * these for inspiration and make it simple but pop") ────────────────────────
 * A header: "Activity", what the tab shows in one grey line, and today's
 * "N updates" in a quiet pill. Each day under a small centred label between
 * thin rules (TODAY, YESTERDAY, 22 OCT). Each row is one sentence (who in
 * bold, what they did in grey, what to in bold, the Space in grey) with the
 * time on the right, and one muted second line only where it carries meaning
 * (row-model.ts). The avatar is the person's photo or neutral grey initials,
 * with a small badge of what happened; a thin line joins the avatars of a day.
 * No boxed cards.
 *
 * The row opens through its sentence's link, stretched over the row; Reply
 * and an invitation's Accept and Decline sit above it.
 *
 * GOLD IS ONLY ON ACCEPT. Nothing else on the timeline is an action the reader
 * is being asked to take, so nothing else wears the accent.
 *
 * ── BEFORE YOUR LAST VISIT (fix 8) ─────────────────────────────────────────
 * The day labels' centred line with "Before your last visit", between the rows
 * that are new and the ones the reader has seen; the words name the rows
 * below. The last visit is read ONCE, at mount, so the line never moves while
 * they look; the newest time on screen is written back when they leave
 * (unmount, page hide) or after {@link SEEN_AFTER_MS} on the list
 * (`last-seen.ts`, this device only).
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
        <div className={cn('flex flex-col gap-5', CONTENT_FADE)}>
          {days.map((day) => {
            // The line sits above a day whose first row is the first one seen,
            // and between two rows otherwise.
            const lineAboveDay = day.rows[0]?.key === newSinceKey;
            return (
              <div key={day.key} className="flex min-w-0 flex-col gap-5">
                {lineAboveDay ? <CentredLabel as="span" label={NEW_SINCE_WORDS} /> : null}
                <section aria-label={day.label} className="flex min-w-0 flex-col gap-2">
                  <CentredLabel label={day.label} />
                  <ul className="flex flex-col">
                    {day.rows.map((row, index) => {
                      // The avatars of a day are joined, except across the last-visit line.
                      const next = day.rows[index + 1];
                      const joined = next !== undefined && next.key !== newSinceKey;
                      return index > 0 && row.key === newSinceKey ? (
                        <Fragment key={row.key}>
                          <li className="py-2">
                            <CentredLabel as="span" label={NEW_SINCE_WORDS} />
                          </li>
                          <TimelineRowItem row={row} joined={joined} />
                        </Fragment>
                      ) : (
                        <TimelineRowItem key={row.key} row={row} joined={joined} />
                      );
                    })}
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
      <TimelineHeading type={type} updates={todayUpdates(days)} />
      {body}
    </>
  );
}

/** How long the list is on screen before it counts as seen. */
const SEEN_AFTER_MS = 5_000;

/* ── Day labels and the last-visit line ──────────────────────────────────── */

/**
 * A small centred label between two thin rules: TODAY, YESTERDAY, 22 OCT, and
 * the last visit's line in the same dress. `as="h2"` names a day's section.
 */
function CentredLabel({ label, as: Tag = 'h2' }: { label: string; as?: 'h2' | 'span' }) {
  return (
    <div className="flex items-center gap-3 py-1" role={Tag === 'span' ? 'separator' : undefined} aria-label={Tag === 'span' ? label : undefined}>
      <span aria-hidden className="h-px flex-1 bg-border" />
      <Tag className="shrink-0 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{label}</Tag>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

/** It labels what follows it, the rows from before the last visit (the
 *  techlead, 24 October 2026: "New since…" read as naming the old rows). */
const NEW_SINCE_WORDS = 'Before your last visit';

/* ── The row ─────────────────────────────────────────────────────────────── */

const BADGES: Readonly<Record<TimelineBadge, LucideIcon>> = {
  file: FileText,
  folder: Folder,
  chat: MessageCircle,
  reply: Reply,
  mention: AtSign,
  join: UserPlus,
  invite: Mail,
  request: UserCog,
};

/**
 * The avatar at 36px: the person's photo, else their initials on ONE neutral
 * grey for everyone (no coloured tiles, Stay, 24 October 2026); Lawexa's mark;
 * a "?" on the same grey for a deleted account. The badge, a small round icon
 * of what happened, sits on its lower right corner.
 */
const AVATAR =
  'size-9 [&_[data-slot=avatar-fallback]]:bg-secondary [&_[data-slot=avatar-fallback]]:text-xs [&_[data-slot=avatar-fallback]]:font-semibold [&_[data-slot=avatar-fallback]]:text-muted-foreground';

function Lead({ lead, badge }: { lead: TimelineLead; badge: TimelineBadge | null }) {
  const Icon = badge ? BADGES[badge] : null;
  return (
    <span aria-hidden className="relative z-[1] flex size-9 shrink-0">
      {lead.type === 'lawexa' ? (
        <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
          <LogoMark className="size-5" alt="" />
        </span>
      ) : (
        <MemberAvatar
          user={lead.type === 'unknown' ? { name: '?', avatar_url: null } : { name: lead.name, avatar_url: lead.avatar }}
          className={AVATAR}
        />
      )}
      {Icon ? (
        <span className="absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full bg-background ring-1 ring-border">
          <Icon className="size-2.5 text-muted-foreground" />
        </span>
      ) : null}
    </span>
  );
}

/** The sentence: who and what in the foreground's weight, the doing and the Space in grey. */
function Sentence({ sentence }: { sentence: TimelineSentence }) {
  return (
    <>
      <span className="font-semibold text-foreground">{sentence.actor}</span>{' '}
      <span className="text-muted-foreground">{sentence.verb}</span>
      {sentence.object ? (
        <>
          {' '}
          <span className="font-semibold text-foreground">{sentence.object}</span>
        </>
      ) : null}
      {sentence.place ? (
        <span className="text-muted-foreground">
          {' '}
          {sentence.place.word} {sentence.place.name}
        </span>
      ) : null}
    </>
  );
}

/** The whole row opens its target through the sentence's link, stretched over the row. */
const STRETCHED = cn(
  'v2-interactive outline-none',
  'after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring',
);

/** Reply: a quiet text link, never the accent. */
const QUIET_LINK = cn(
  'v2-interactive relative z-10 -mx-1 rounded-md px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none',
  FOCUS_RING,
);

/**
 * One row: the avatar with its badge, the sentence (two lines at most), a
 * muted second line where it carries meaning, the light actions, and the time
 * on the right. `joined` draws the thin line down to the next avatar of the day.
 */
function TimelineRowItem({ row, joined }: { row: TimelineRow; joined: boolean }) {
  return (
    <li className="relative">
      {joined ? (
        <span aria-hidden className="absolute top-12 -bottom-2.5 left-[30px] w-px -translate-x-1/2 bg-border" />
      ) : null}
      <div
        className={cn(
          'relative flex min-w-0 items-start gap-3 rounded-xl px-3 py-2.5',
          row.href && 'transition-colors duration-150 hover:bg-secondary/50 motion-reduce:transition-none',
        )}
      >
        <Lead lead={row.lead} badge={row.badge} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 items-start gap-3">
            <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-5" title={row.title}>
              {row.href ? (
                <Link href={row.href} aria-label={row.title} className={STRETCHED}>
                  <Sentence sentence={row.sentence} />
                </Link>
              ) : (
                <Sentence sentence={row.sentence} />
              )}
            </p>
            {row.time ? (
              <span className="shrink-0 pt-px text-xs whitespace-nowrap text-muted-foreground tabular-nums">{row.time}</span>
            ) : null}
          </div>
          {row.detail ? <p className="mt-0.5 truncate text-[13px] leading-5 text-muted-foreground">{row.detail}</p> : null}
          {row.replyHref ? (
            <div className="mt-1">
              <Link href={row.replyHref} className={QUIET_LINK}>
                Reply
              </Link>
            </div>
          ) : null}
          {row.invite && row.invite.invitationId !== null ? <InviteActions id={row.invite.invitationId} /> : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Accept (the only gold on the timeline) and Decline, small, under the
 * sentence. They are the invitations inbox's own mutation
 * (`invitations/mutations.ts`), keyed by the member-row id the event's action
 * carries; the answer also re-asks this timeline, so the buttons leave once
 * the server has it. While it is in flight both hold still and the pressed
 * one shows it is working.
 */
function InviteActions({ id }: { id: number }) {
  const respond = useRespondToInvitation();
  const pending = usePendingInvitationResponses();
  const busy = pending.get(invitationRowKey('space', id));
  return (
    <span className="relative z-10 mt-2 flex gap-1.5">
      <Button
        size="sm"
        className="h-7 rounded-full px-3 text-xs font-semibold"
        disabled={busy !== undefined}
        onClick={() => respond.mutate({ kind: 'space', id, action: 'accept' })}
      >
        {busy === 'accept' ? <Loader2 aria-hidden className="animate-spin" /> : null}
        Accept
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 rounded-full px-3 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        disabled={busy !== undefined}
        onClick={() => respond.mutate({ kind: 'space', id, action: 'decline' })}
      >
        {busy === 'decline' ? <Loader2 aria-hidden className="animate-spin" /> : null}
        Decline
      </Button>
    </span>
  );
}
