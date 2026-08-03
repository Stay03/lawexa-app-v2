'use client';

import { useMemo } from 'react';

import { cn } from '@/lib/utils';
import { difficultyLabel } from '@/lib/utils/quiz-format';
import type { QuizDifficulty, QuizResultItem } from '@/types/quiz';

/**
 * ResultsBreakdown — accuracy grouped by difficulty: the session-level insight
 * that stays useful when there are too many questions to read one by one.
 *
 * ── ONE HUE, BECAUSE THIS IS MAGNITUDE, NOT IDENTITY ────────────────────────
 * v1 painted each bar green / amber / red by difficulty, which double-encoded
 * the row's own label as colour and spent the reserved good/bad channel on an
 * ordered scale. Every bar here is the same brand hue over a lighter step of
 * itself; the ROW says which difficulty it is, the BAR length says how you did.
 *
 * ── IT HIDES ITSELF WHEN IT HAS NOTHING TO COMPARE ──────────────────────────
 * A single bar carries no comparison — it just restates the headline score in a
 * second, worse form — so a session that only met one difficulty renders
 * nothing at all rather than a decorative row.
 *
 * REMOVED QUESTIONS ARE EXCLUDED. A question deleted from the bank arrives with
 * `question: null` and therefore no difficulty; counting it would need a guess
 * about which band it belonged to. It stays in the answer sheet and in the
 * headline score (the grade was earned) and simply cannot appear here.
 */
export function ResultsBreakdown({
  questions,
}: {
  questions: QuizResultItem[];
}) {
  const groups = useMemo(() => {
    const byLevel = new Map<
      QuizDifficulty,
      { label: string; total: number; correct: number }
    >();

    for (const item of questions) {
      if (!item.question) continue;
      const level = item.question.difficulty;
      const existing = byLevel.get(level) ?? {
        label: item.question.difficulty_label || difficultyLabel(level),
        total: 0,
        correct: 0,
      };
      existing.total += 1;
      if (item.was_correct) existing.correct += 1;
      byLevel.set(level, existing);
    }

    return [...byLevel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([difficulty, group]) => ({
        difficulty,
        ...group,
        percent:
          group.total > 0 ? Math.round((group.correct / group.total) * 100) : 0,
      }));
  }, [questions]);

  if (groups.length <= 1) return null;

  return (
    <section
      aria-label="Accuracy by difficulty"
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <h2 className="mb-3 text-xs font-medium text-muted-foreground">
        Accuracy by difficulty
      </h2>
      <ul className="flex flex-col gap-3">
        {groups.map((group) => (
          <li key={group.difficulty} className="flex items-center gap-3">
            <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
              {group.label}
            </span>
            <span
              role="progressbar"
              aria-valuenow={group.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${group.label}: ${group.correct} of ${group.total} correct`}
              className="h-2 flex-1 overflow-hidden rounded-full bg-primary/15"
            >
              <span
                aria-hidden
                className={cn('block h-full rounded-full bg-primary')}
                style={{ width: `${group.percent}%` }}
              />
            </span>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {group.correct}/{group.total} · {group.percent}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
