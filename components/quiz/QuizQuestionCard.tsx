'use client';

import { QuizOption } from './QuizOption';
import type { QuizQuestion } from '@/types/quiz';

interface QuizQuestionCardProps {
  question: QuizQuestion;
  /** The option the user has tapped for this question (null = none yet). */
  selectedId: number | null;
  /** A submit is in flight (locks the group, spins the chosen option). */
  pending: boolean;
  onSelect: (optionId: number) => void;
}

/** Presentational question + its four answer options. */
export function QuizQuestionCard({
  question,
  selectedId,
  pending,
  onSelect,
}: QuizQuestionCardProps) {
  const options = [...question.options].sort((a, b) => a.position - b.position);

  return (
    <div>
      <h1 className="text-balance text-xl font-semibold leading-relaxed text-foreground sm:text-2xl">
        {question.question_text}
      </h1>
      <div className="mt-6 space-y-3" role="group" aria-label="Answer options">
        {options.map((option, index) => (
          <QuizOption
            key={option.id}
            label={option.option_text}
            index={index}
            selected={selectedId === option.id}
            pending={pending && selectedId === option.id}
            disabled={pending}
            onSelect={() => onSelect(option.id)}
          />
        ))}
      </div>
    </div>
  );
}
