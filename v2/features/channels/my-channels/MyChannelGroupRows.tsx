'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CountBadge, FOCUS_RING, UnreadDot } from '@/v2/shell/designs/modules';
import { MyChannelRow } from './MyChannelRow';
import { MyThreadRow } from './MyThreadRow';
import type { MyChannelGroup } from './model';

/**
 * One channel, and the threads branched out of it, drawn underneath it.
 *
 * ── WHY (the owner, 20 August 2026, with two screenshots) ──────────────────
 * "I want the threads to be under the channel for every channel. If the channel
 * has too many threads then there should be see more. The point is that
 * visually if I see that a thread is under a channel I understand the hierarchy
 * but still the most recent shows top."
 *
 * Before this, a thread and a channel were siblings in one flat list and the
 * only thing saying "Errors and failures lives in Product Development" was a
 * line of grey text under the title. The shape had to be read. Now it is drawn.
 *
 * ── IT RETURNS SIBLINGS, NOT A NESTED ROW ──────────────────────────────────
 * The heading and the indented block are two `<li>`s in the screen's one list,
 * not a row containing rows. `MyChannelRow` draws its own `<li>`, so wrapping
 * the group in another one would put an `<li>` directly inside an `<li>`, which
 * is invalid and would leave the list's semantics to the browser's recovery.
 * A fragment keeps every direct child of that `<ul>` a list item.
 *
 * ── THE INDENT IS THE WHOLE DESIGN, SO IT IS DRAWN NOT IMPLIED ─────────────
 * A left inset alone reads as an accident at a glance, especially on a phone
 * where the eye has no column to measure against. A hairline down the inset
 * gives the group a spine: it starts under the heading, runs past every thread,
 * and stops. That is what makes three rows read as "inside" rather than "after".
 *
 * One border on the block, not one per row, so it cannot break into dashes
 * between rows of different heights.
 *
 * ── THE BUTTON SAYS WHAT IS BEHIND IT, INCLUDING WHO WANTS YOU ────────────
 * "4 more", and if any of those four are unread it carries the dot, and if any
 * of them name you it carries the count. That last part is the reason the whole
 * thing was asked for: collapsing threads without it would hide a message
 * addressed to the reader behind a button that said nothing about it, which is
 * strictly worse than the flat list this replaces.
 *
 * The numbers come from the SERVER (`my_threads_count` and its two siblings,
 * live 2026-08-22), never from counting the rows we hold. This screen holds one
 * page of the newest threads across every channel, so what it holds for any one
 * channel can be short of the truth — measured the day the fields landed,
 * `general` reported 5 while this screen held 4. Counting locally would quietly
 * under-report, and the thing under-reported would be a mention.
 *
 * A payload without those fields draws the old silent "See more" rather than a
 * guess.
 *
 * ── IT EXPANDS IN PLACE, THEN IT HANDS OVER ────────────────────────────────
 * Pressing it shows the rest of what we HOLD, right there. A reader triaging
 * their channels is mid-scan, and sending them to another screen for two rows
 * that were already in memory loses their place for nothing.
 *
 * But when everything held is on screen and the server still says there are
 * more, there is nothing left to expand — so the control stops being a button
 * and becomes a link into the channel's own thread list, which can page through
 * all of them. A button that silently does nothing is the outcome to avoid.
 */
export const MyChannelGroupRows = memo(function MyChannelGroupRows({
  group,
  now,
  index,
}: {
  group: MyChannelGroup;
  /** Frozen clock — threaded from the screen so no `Date.now()` runs in render. */
  now: number;
  /** Position across all sections — drives the entrance stagger. */
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? [...group.threads, ...group.rest] : group.threads;

  /* What is genuinely still hidden: the server's total minus what is drawn.
     Falls back to the rows we hold when the server sent no total, so an older
     payload still gets a working control rather than none. */
  const remaining =
    group.total === null
      ? expanded
        ? 0
        : group.rest.length
      : Math.max(0, group.total - shown.length);

  /* More exist than we were sent, so expanding cannot reach them. */
  const beyondWhatWeHold = expanded || remaining > group.rest.length;
  const unreadHidden = (group.hiddenUnread ?? 0) > 0;
  const mentionsHidden = group.hiddenMentions ?? 0;

  const label = (
    <MoreLabel
      remaining={remaining}
      known={group.total !== null}
      unread={unreadHidden}
      mentions={mentionsHidden}
      channel={group.channel.name}
    />
  );

  return (
    <>
      <MyChannelRow
        channel={group.channel}
        now={now}
        index={index}
        activityAt={group.activityAt}
      />

      {shown.length > 0 || remaining > 0 ? (
        <li className="pb-1">
          <div className="ml-5 border-l border-border/70 pl-2">
            <ul className="flex flex-col divide-y divide-border/40">
              {shown.map((thread, threadIndex) => (
                <MyThreadRow
                  key={thread.uuid}
                  thread={thread}
                  now={now}
                  index={index + threadIndex + 1}
                  nested
                />
              ))}
            </ul>

            {remaining > 0 ? (
              beyondWhatWeHold ? (
                <Link
                  href={`/channels/${group.channel.uuid}?panel=threads&mine=1`}
                  className={MORE_CLASS}
                >
                  <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className={MORE_CLASS}
                >
                  <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              )
            ) : null}
          </div>
        </li>
      ) : null}
    </>
  );
});

const MORE_CLASS = cn(
  'flex w-full items-center gap-1.5 rounded-lg px-2 py-2',
  'text-left text-xs font-medium text-muted-foreground',
  'transition-colors duration-150 hover:bg-secondary/50 hover:text-foreground',
  'motion-reduce:transition-none v2-interactive',
  FOCUS_RING,
);

/**
 * What the control says, and the two marks it can carry.
 *
 * The dot and the badge are the ones a row already uses, so a reader who has
 * learnt "gold dot means unread, gold number means somebody said my name" needs
 * to learn nothing new to read a collapsed group.
 *
 * The spoken sentence names the CHANNEL. "4 more", read out of context by a
 * screen reader, says nothing about which group the reader is standing in.
 */
function MoreLabel({
  remaining,
  known,
  unread,
  mentions,
  channel,
}: {
  remaining: number;
  known: boolean;
  unread: boolean;
  mentions: number;
  channel: string;
}) {
  const spokenCount = known
    ? `${remaining} more ${remaining === 1 ? 'thread' : 'threads'} in ${channel}`
    : `More threads in ${channel}`;
  const spokenSignal =
    mentions > 0 ? `, ${mentions} mentioning you` : unread ? ', some unread' : '';

  return (
    <>
      <span aria-hidden className="flex-1">
        {known ? `${remaining} more` : 'See more'}
      </span>
      <span className="sr-only">{spokenCount + spokenSignal}</span>
      {mentions > 0 ? (
        /* Label emptied: the sentence above already says it, and CountBadge's
           own label would repeat the number a second time to a screen reader. */
        <CountBadge count={mentions} label="" />
      ) : unread ? (
        <UnreadDot />
      ) : null}
    </>
  );
}
