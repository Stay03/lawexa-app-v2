'use client';

import { DifficultyBadge } from './DifficultyBadge';
import { QuizScoreChip } from './QuizScoreChip';
import { EndSessionDialog } from './EndSessionDialog';
import type { QuizDifficulty, QuizSession } from '@/types/quiz';

interface QuizProgressHeaderProps {
  sequence: number;
  difficulty: QuizDifficulty;
  difficultyLabel: string;
  session: QuizSession;
  onEnd: () => void;
  ending: boolean;
}

/** Sticky play-screen header: question number + difficulty, live score, End. */
export function QuizProgressHeader({
  sequence,
  difficulty,
  difficultyLabel,
  session,
  onEnd,
  ending,
}: QuizProgressHeaderProps) {
  return (
    <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-semibold text-foreground">
          Question {sequence}
        </span>
        <DifficultyBadge difficulty={difficulty} label={difficultyLabel} />
      </div>
      <div className="flex items-center gap-1.5">
        <QuizScoreChip
          correct={session.correct_count}
          answered={session.answered_count}
          scorePercentage={session.score_percentage}
        />
        <EndSessionDialog onConfirm={onEnd} ending={ending} />
      </div>
    </div>
  );
}
