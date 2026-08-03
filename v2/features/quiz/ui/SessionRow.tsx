import { memo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { QuizSession } from '@/types/quiz';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  QUIZ_SESSION_STATUS,
  finalScoreLabel,
  isResumable,
  sessionHref,
  sessionMetaZones,
} from '@/v2/features/quiz/model';

/**
 * SessionRow — one past (or open) session, shared by the hub's recent list and
 * the `/quiz/history` page so the two can never drift. The `RadarRow` grammar:
 * a status dot beside the row's loudest line, a quiet meta line under it, a
 * hairline between rows rather than a card around each, and the whole row as
 * one honest link (no `inset-0` overlay).
 *
 * WHAT THE ROW LEADS WITH is the OUTCOME, because that is what a reader scans a
 * history for: the finished score, or — for the one open session — the fact
 * that it is still going. `sessionMetaZones` deliberately withholds a score
 * from an active session: a moving number beside a "Resume" affordance reads as
 * a verdict on an unfinished attempt.
 *
 * THE META LINE IS TWO ZONES (owner, August 3): the counts lead, under the
 * fixed-width status dot; the date and duration are right-anchored at the TEXT
 * BLOCK's edge — inside it, so they form their own column and the Resume/Review
 * affordance keeps its own, farther right. The line never wraps: a squeezed row
 * truncates the counts and leaves the times where they are.
 *
 * `memo` because the history list can grow past a hundred rows and the sentinel
 * re-renders the list on every page.
 */
export const SessionRow = memo(function SessionRow({
  session,
  index,
}: {
  session: QuizSession;
  /** Staggers the entrance for the first screenful only. */
  index: number;
}) {
  const status = QUIZ_SESSION_STATUS[session.status];
  const resumable = isResumable(session);
  const score = finalScoreLabel(session);
  const meta = sessionMetaZones(session);

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <Link
        href={sessionHref(session)}
        className={cn(
          'v2-interactive group flex min-h-11 items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
          FOCUS_RING,
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn('size-2 shrink-0 rounded-full', status.dotClass)}
            />
            <span className="text-[15px] font-medium text-foreground transition-colors group-hover:text-primary">
              {status.label}
            </span>
            {score ? (
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {score}
              </span>
            ) : null}
          </span>

          <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            {/* LEAD — the counts. */}
            <span className="min-w-0 flex-1 truncate">{meta.lead}</span>

            {/* TRAIL — date, then duration, right-anchored and `tabular-nums`
                so the digits line up between rows as well as along them.

                Keyed by POSITION, not by text: the trail is a fixed, ordered
                tuple (date · duration) and the two can legitimately be the same
                string, which would collide on a text key. Position is stable
                because the tuple's order never varies. */}
            <span className="flex shrink-0 items-center gap-2 tabular-nums">
              {meta.trail.map((part, partIndex) => (
                <span key={partIndex} className="inline-flex items-center gap-2">
                  {partIndex > 0 ? (
                    <span aria-hidden className="text-muted-foreground/40">
                      ·
                    </span>
                  ) : null}
                  {part}
                </span>
              ))}
            </span>
          </span>
        </span>

        <span className="shrink-0 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          {resumable ? 'Resume' : 'Review'}
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  );
});
