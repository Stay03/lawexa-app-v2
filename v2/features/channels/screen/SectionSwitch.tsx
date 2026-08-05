'use client';

import { ListTodo, MessagesSquare, Paperclip, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { TabRow } from '@/v2/shell/TabRow';
import type { ChannelTab } from '../model';

/**
 * SectionSwitch — Chat / Lists / Files as ONE segmented object, in two
 * densities, on the single `TabRow` primitive. Phase-5 redesign wave, W2
 * (2026-08-05): the permanent tab strip and its hairline are gone.
 *
 * ── WHY A SEGMENT AND NOT A STRIP ──────────────────────────────────────────
 * The strip it replaces cost a full row plus a rule on every channel forever,
 * ~41px above the first message, to carry three words. A segment is the same
 * three words as one control, small enough to ride inside the header bar at
 * `md:`+ and inside a bottom bar on a phone — so the transcript pays nothing
 * for it in the state the reader is in almost all of the time (Chat).
 *
 * ── THE COUNTS ARE QUANTITIES, NOT BADGES, AND THE DIFFERENCE IS THE RULE ──
 * "A number is only ever a mention count" governs the UNREAD grammar: bold,
 * the gold dot, the badge. A count here says how many task lists and how many
 * files exist — a label on a destination, not a signal about attention. So it
 * is rendered as muted text at the tab's own size, never a pill, never the
 * accent, and it is omitted entirely at zero. Nothing about it can be mistaken
 * for the one badge in this product that means "you were named".
 *
 * The counts come from the caller reading its EXISTING caches; this component
 * never fetches, so a section that has not been opened simply shows no number
 * rather than a zero it has not earned.
 */

export interface ChannelSection {
  id: ChannelTab;
  label: string;
  icon: LucideIcon;
}

/** Every section, in reading order. The caller filters by what access allows. */
export const CHANNEL_SECTIONS: readonly ChannelSection[] = [
  { id: 'chat', label: 'Chat', icon: MessagesSquare },
  { id: 'lists', label: 'Lists', icon: ListTodo },
  { id: 'files', label: 'Files', icon: Paperclip },
];

/** How many rows a section holds. Absent = the cache has not been filled. */
export type SectionCounts = Partial<Record<ChannelTab, number>>;

const DENSITY = {
  /** Inside the header bar at `md:`+ — as small as a control can be and stay hittable. */
  header: {
    list: 'inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5',
    tab: 'min-h-7 rounded-[7px] px-2.5 text-xs',
    icon: 'hidden',
  },
  /** The phone's bottom bar — thumb-sized, full width, glyph + word. */
  bar: {
    list: 'flex w-full items-center gap-1 rounded-xl bg-secondary/60 p-1',
    tab: 'min-h-10 flex-1 rounded-lg px-2 text-sm',
    icon: 'size-4',
  },
} as const;

export function SectionSwitch({
  sections,
  value,
  onChange,
  counts,
  density,
  className,
}: {
  /** Only the sections THIS reader can reach — the access model decides. */
  sections: readonly ChannelSection[];
  value: ChannelTab;
  onChange: (next: ChannelTab) => void;
  counts: SectionCounts;
  density: keyof typeof DENSITY;
  className?: string;
}) {
  const shape = DENSITY[density];
  return (
    <TabRow
      tabs={sections}
      value={value}
      onChange={onChange}
      ariaLabel="Channel sections"
      className={cn(shape.list, className)}
      tabClassName={(selected) =>
        cn(
          'v2-interactive flex items-center justify-center gap-1.5 font-medium',
          'transition-colors duration-150 motion-reduce:transition-none',
          shape.tab,
          selected
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {(section) => {
        const count = counts[section.id];
        return (
          <>
            <section.icon aria-hidden className={cn('shrink-0', shape.icon)} />
            {section.label}
            {/* NOT `aria-hidden`: the quantity is part of what the tab is,
                so it joins the tab's accessible name ("Lists 4") instead of
                being kept from the one audience that cannot see it. */}
            {count !== undefined && count > 0 ? (
              <span className="tabular-nums font-normal text-muted-foreground">
                {count}
              </span>
            ) : null}
          </>
        );
      }}
    </TabRow>
  );
}
