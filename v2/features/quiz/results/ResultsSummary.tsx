import Link from 'next/link';
import { Check, Clock, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  formatDurationMs,
  formatSessionDate,
  parseScore,
  sessionDurationMs,
} from '@/lib/utils/quiz-format';
import type { QuizSession } from '@/types/quiz';
import { ScoreRing } from './ScoreRing';
import { SummaryChip } from './SummaryChip';

/**
 * ResultsSummary — the session's headline: the score, what it is made of, and
 * the two things worth doing next.
 *
 * The ring is a METER and the chips never carry colour alone — both live in
 * `ScoreRing.tsx` and `SummaryChip.tsx` since 21 October 2026, shared with
 * the solo quiz results, and their reasoning is written there. v1 tinted the
 * big number green / amber / grey by band (`scoreBandClasses`); the shared
 * ring wears plain ink, because banding a PRACTICE score green-vs-red passes
 * a judgement the data does not support.
 *
 * ── A SESSION THAT ANSWERED NOTHING SHOWS "—", NOT "0%" ─────────────────────
 * The same zero-vs-null discipline the stats page applies: no answers means
 * there is no score, and printing 0% would report a failure that never happened.
 */
export function ResultsSummary({
  session,
  meanTimeMs,
}: {
  session: QuizSession;
  /** Mean answer time across the session, or null when nothing was answered. */
  meanTimeMs: number | null;
}) {
  const percent = parseScore(session.score_percentage);
  const answered = session.answered_count;
  const correct = session.correct_count;
  const incorrect = Math.max(0, answered - correct);
  const date = session.completed_at
    ? formatSessionDate(session.completed_at)
    : null;
  const duration = sessionDurationMs(session.started_at, session.completed_at);

  const timing = [
    duration !== null ? formatDurationMs(duration) : null,
    meanTimeMs !== null ? `~${formatDurationMs(meanTimeMs)} per question` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <div className="rounded-xl border border-border bg-card p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 sm:p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:text-left">
        <ScoreRing
          percent={percent}
          empty={answered === 0}
          emptyLabel="No score: nothing was answered in this session"
        />

        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Session complete
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {answered === 0
              ? 'No questions were answered in this session.'
              : `${correct} of ${answered} correct`}
            {date ? ` · ${date}` : ''}
          </p>

          {answered > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <SummaryChip icon={Check} tone="positive" label={`${correct} correct`} />
              <SummaryChip icon={X} tone="negative" label={`${incorrect} incorrect`} />
              {timing ? <SummaryChip icon={Clock} tone="quiet" label={timing} /> : null}
            </div>
          ) : null}
        </div>

        <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:flex-col">
          <Button asChild size="sm" className="flex-1">
            <Link href="/quiz">Practise again</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href="/quiz/history">Past sessions</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
