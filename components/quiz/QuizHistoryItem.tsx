import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuizSessionStatusBadge } from './QuizSessionStatusBadge';
import {
  formatDurationMs,
  formatScorePercent,
  formatSessionDate,
  parseScore,
  scoreBandClasses,
  sessionDurationMs,
} from '@/lib/utils/quiz-format';
import type { QuizSession } from '@/types/quiz';

interface QuizHistoryItemProps {
  session: QuizSession;
}

/** One past session: status, score, counts, date + duration. Links to resume or review. */
export function QuizHistoryItem({ session }: QuizHistoryItemProps) {
  const isActive = session.status === 'active';
  const href = isActive
    ? `/quiz/play?s=${session.uuid}`
    : `/quiz/${session.uuid}/results`;

  const hasAnswers = session.answered_count > 0;
  const duration = sessionDurationMs(session.started_at, session.completed_at);
  const dateLabel = formatSessionDate(session.completed_at ?? session.started_at);

  const meta = [
    isActive
      ? `${session.answered_count} answered`
      : `${session.correct_count} / ${session.answered_count} correct`,
    dateLabel,
    duration ? formatDurationMs(duration) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors',
        'hover:border-primary/50 hover:bg-accent/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <QuizSessionStatusBadge status={session.status} />
          {hasAnswers && !isActive && (
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                scoreBandClasses(parseScore(session.score_percentage))
              )}
            >
              {formatScorePercent(session.score_percentage)}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground group-hover:text-foreground">
        {isActive ? 'Resume' : 'Review'}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
