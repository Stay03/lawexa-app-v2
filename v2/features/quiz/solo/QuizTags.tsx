import { cn } from '@/lib/utils';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { quizTagList } from './home-model';

/**
 * QuizTags — a quiz's topic, level and year as quiet tags, not a dotted line
 * of text (Arthur, 27 October 2026: "The quiz tags can be better designed and
 * arranged"; 28 October: colour on the tile and the play button only, so the
 * tags stay neutral). A quiz with none of the three shows its size instead,
 * so every card has the row. `facts` adds the size after the three, for the
 * quiz page.
 */
export function QuizTags({
  quiz,
  facts = false,
  extra = [],
  className,
}: {
  quiz: ChannelQuiz;
  facts?: boolean;
  /** Said after the rest: the quiz page's scenario count, a non-public quiz's visibility. */
  extra?: readonly string[];
  className?: string;
}) {
  const tags = [...quizTagList(quiz, facts), ...extra];
  if (tags.length === 0) return null;
  return (
    <ul aria-label="About this quiz" className={cn('flex min-w-0 flex-wrap gap-1.5', className)}>
      {tags.map((tag, index) => (
        <li
          key={`${index}-${tag}`}
          className="max-w-full truncate rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/75 tabular-nums"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}
