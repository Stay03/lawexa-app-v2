'use client';

import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
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
 * ── "SEE MORE" AND WHY IT DOES NOT SAY A NUMBER YET ────────────────────────
 * The button reveals the threads this screen ALREADY HOLDS and is not drawing.
 * It deliberately does not claim a count. The screen holds only the newest page
 * of threads, so the number it is not drawing is not the number that exist — a
 * channel can have forty and have sent us three.
 *
 * @backendclaude is adding a real per-channel count (threads you are in, unread
 * among them, mentions among them). When it lands this becomes "4 more" and
 * carries the unread dot and the mention badge, which is the part that matters:
 * without them, collapsing threads would hide a message addressed to you behind
 * a button that says nothing. Until then a silent "See more" is the honest
 * version — a number we cannot stand behind is worse than no number.
 *
 * ── IT EXPANDS IN PLACE ────────────────────────────────────────────────────
 * Pressing it shows the rest of what we hold, right there, rather than
 * navigating away. A reader triaging their channels is mid-scan; sending them
 * to another screen for two more rows loses their place for information that
 * was already in memory.
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
  const hidden = expanded ? 0 : group.rest.length;

  return (
    <>
      <MyChannelRow
        channel={group.channel}
        now={now}
        index={index}
        activityAt={group.activityAt}
      />

      {shown.length > 0 || hidden > 0 ? (
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

            {hidden > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-lg px-2 py-2',
                  'text-left text-xs font-medium text-muted-foreground',
                  'transition-colors duration-150 hover:bg-secondary/50 hover:text-foreground',
                  'motion-reduce:transition-none v2-interactive',
                  FOCUS_RING,
                )}
              >
                <ChevronDown aria-hidden className="h-3.5 w-3.5" />
                {/* No count. See the note above — we cannot stand behind one yet. */}
                See more
              </button>
            ) : null}
          </div>
        </li>
      ) : null}
    </>
  );
});
