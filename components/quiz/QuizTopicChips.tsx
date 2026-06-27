'use client';

import { cn } from '@/lib/utils';
import { useQuizTopics } from '@/lib/hooks/useQuiz';

interface QuizTopicChipsProps {
  selected: string | null;
  onSelect: (topic: string | null) => void;
}

/** Optional topic seed for a new session. Renders nothing if there are no topics. */
export function QuizTopicChips({ selected, onSelect }: QuizTopicChipsProps) {
  const topicsQuery = useQuizTopics();
  const topics = topicsQuery.data?.data ?? [];

  if (topicsQuery.isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
    );
  }

  if (topics.length === 0) return null;

  const sorted = [...topics].sort((a, b) => a.rank - b.rank);

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Pick a topic (optional)
      </p>
      <div className="flex flex-wrap gap-2">
        <TopicChip label="Any" active={selected === null} onClick={() => onSelect(null)} />
        {sorted.map((t) => (
          <TopicChip
            key={t.topic_key}
            label={t.topic}
            active={selected === t.topic}
            onClick={() => onSelect(t.topic)}
          />
        ))}
      </div>
    </div>
  );
}

function TopicChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        active
          ? 'border-primary bg-primary/10 font-medium text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}
