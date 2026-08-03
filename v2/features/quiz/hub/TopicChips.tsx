'use client';

import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { quizQueries } from '../queries';

/**
 * TopicChips — the OPTIONAL topic seed for a new session.
 *
 * RENDERS NOTHING when there are no topics, and that is the common case: the
 * list is produced by a NIGHTLY backend job over the user's study
 * conversations, so a new account has none and playing does not create any
 * (verified live, 2026-08-03 — the endpoint stayed `[]` across a full played
 * session). A row of empty chips promising a picker that will never populate
 * would be worse than silence.
 *
 * NO SKELETON for the same reason. A skeleton is a promise that content is
 * coming (standards §8i); here the most likely resolution is "nothing", so the
 * row simply appears when there is something to show — the honest version of a
 * pulse that resolves to zero chips.
 *
 * Unknown topics are harmless server-side (the difficulty ladder just widens),
 * so this never has to validate the seed it sends.
 */
export function TopicChips({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (topic: string | null) => void;
}) {
  const { userId: viewerId } = useV2Session();
  const topicsQuery = useQuery(quizQueries.topics({ viewerId }));

  const topics = topicsQuery.data?.data ?? [];
  if (topics.length === 0) return null;

  // `rank` is the backend's primary-first ordering; the raw list is by recency.
  const sorted = [...topics].sort((a, b) => a.rank - b.rank);

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <p
        id="quiz-topic-label"
        className="mb-2 text-xs font-medium text-muted-foreground"
      >
        Focus on a topic (optional)
      </p>
      <div
        role="group"
        aria-labelledby="quiz-topic-label"
        className="flex flex-wrap gap-1.5"
      >
        <TopicChip
          label="Anything"
          active={selected === null}
          onClick={() => onSelect(null)}
        />
        {sorted.map((topic) => (
          <TopicChip
            key={topic.topic_key}
            label={topic.topic}
            active={selected === topic.topic}
            onClick={() => onSelect(topic.topic)}
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
        'v2-interactive inline-flex min-h-9 items-center rounded-full border px-3 text-sm transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 font-medium text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {label}
    </button>
  );
}
