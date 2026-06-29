'use client';

import { useMemo } from 'react';
import { DifficultyBadge } from './DifficultyBadge';
import { difficultyLabel } from '@/lib/utils/quiz-format';
import { cn } from '@/lib/utils';
import type { QuizDifficulty, QuizResultItem } from '@/types/quiz';

interface QuizResultsBreakdownProps {
  questions: QuizResultItem[];
}

/** Solid bar fill colour, banded to match the difficulty badge palette. */
function barClass(difficulty: QuizDifficulty): string {
  if (difficulty <= 2) return 'bg-emerald-500';
  if (difficulty === 3) return 'bg-amber-500';
  return 'bg-rose-500';
}

/**
 * Accuracy grouped by difficulty level — the session-level insight that stays
 * useful when there are too many questions to scan one by one. Hidden when the
 * session spans only a single difficulty (a single bar carries no comparison).
 */
export function QuizResultsBreakdown({ questions }: QuizResultsBreakdownProps) {
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
      .map(([difficulty, g]) => ({
        difficulty,
        ...g,
        pct: g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0,
      }));
  }, [questions]);

  if (groups.length <= 1) return null;

  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Accuracy by difficulty
      </p>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.difficulty} className="flex items-center gap-3">
            <DifficultyBadge
              difficulty={g.difficulty}
              label={g.label}
              className="w-24 shrink-0 justify-center"
            />
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={g.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${g.label} accuracy`}
            >
              <div
                className={cn('h-full rounded-full', barClass(g.difficulty))}
                style={{ width: `${g.pct}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {g.correct}/{g.total} · {g.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
