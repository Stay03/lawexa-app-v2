import type { Ref, ReactNode } from 'react';
import {
  BadgeCheck,
  CircleHelp,
  Clock,
  FilePen,
  ShieldCheck,
  ShieldX,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { StageTone, StageView, VerificationStage } from './model';

const STAGE_ICON: Record<VerificationStage, LucideIcon> = {
  not_started: ShieldCheck,
  draft: FilePen,
  pending: Clock,
  approved: BadgeCheck,
  rejected: ShieldX,
  unknown: CircleHelp,
};

/**
 * One colour family per tone, written once for the tile and the badge.
 *
 * The text shades are the 700s in the light theme and the 400s in the dark,
 * the pair v2 already uses for its emerald and amber messages: the 600s on a
 * 10-15% tint of themselves sit under the 4.5:1 a 12px badge label needs.
 */
const TONE: Record<StageTone, { tile: string; badge: string }> = {
  neutral: {
    tile: 'bg-background text-muted-foreground',
    badge: 'border-border bg-background text-muted-foreground',
  },
  progress: {
    tile: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  positive: {
    tile: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  negative: {
    tile: 'bg-destructive/10 text-destructive',
    badge: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
};

/**
 * StatusPanel — where the reader stands, in one filled block at the top of the
 * screen: a badge naming the stage, a heading, the sentence that says what to
 * do next, the dates the profile holds, and the reviewer's words when there
 * are some.
 *
 * It is KEYED BY STAGE by its caller, so a change of stage (sending for
 * review, a decision arriving on refocus) replays its entrance instead of
 * swapping words in place under the reader's eye.
 *
 * The heading takes focus after a submit (`headingRef`, `tabIndex={-1}`): the
 * button that was pressed is gone from the page, and the new status is the
 * thing a screen reader should land on.
 */
export function StatusPanel({
  view,
  dates,
  note,
  action,
  headingRef,
}: {
  view: StageView;
  dates: readonly string[];
  note: { kind: 'reason' | 'note'; text: string } | null;
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const Icon = STAGE_ICON[view.stage];
  const tone = TONE[view.tone];

  return (
    <section
      aria-labelledby="verification-status"
      className="rounded-2xl bg-secondary p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300"
    >
      <div className="flex gap-3.5">
        <span
          aria-hidden
          className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone.tile)}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Badge variant="outline" className={cn('h-5', tone.badge)}>
            {view.badge}
          </Badge>
          <h2
            id="verification-status"
            ref={headingRef}
            tabIndex={-1}
            className="mt-1.5 text-base leading-snug font-semibold text-foreground outline-none"
          >
            {view.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{view.description}</p>
          {dates.length > 0 ? (
            <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
              {dates.join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      {note ? (
        <figure
          className={cn(
            'mt-4 rounded-xl border px-3.5 py-3',
            note.kind === 'reason'
              ? 'border-destructive/25 bg-destructive/5'
              : 'border-border bg-background/60',
          )}
        >
          <figcaption className="text-[13px] leading-snug font-medium text-muted-foreground">
            {note.kind === 'reason' ? 'Reason given' : 'Note from the reviewer'}
          </figcaption>
          {/* The reviewer's own words, kept as they wrote them: line breaks
              included, and long unbroken strings wrapped rather than run off
              the panel. */}
          <blockquote className="mt-1 text-sm leading-relaxed break-words whitespace-pre-line text-foreground">
            {note.text}
          </blockquote>
        </figure>
      ) : null}

      {action ? <div className="mt-4 flex flex-wrap gap-2 pl-[3.375rem]">{action}</div> : null}
    </section>
  );
}
