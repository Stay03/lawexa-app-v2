import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * QuizMessage — the ONE full-surface panel every quiz state renders through:
 * early access, sign in, verify your email, cold start, load failure, empty
 * history, ended session. v1 had a `QuizMessage` doing the same job; this is
 * the v2 rebuild on v2 tokens and the house `PageState` geometry (the radars
 * list's states), not a copy of v1's markup.
 *
 * THREE STATES, VISUALLY DISTINCT (standards §8iv). `tone` is the only knob:
 *  - `neutral`  empty / informational — a quiet secondary tile
 *  - `accent`   an invitation the reader is meant to act on (first run, cold
 *               start) — the brand gold tile
 *  - `alert`    something went wrong or is blocked — the amber tile
 * The ICON never carries the meaning alone: the title always says it in words.
 *
 * Presentational and hook-free, so route fallbacks can render it inert.
 */

const TONE_TILE = {
  neutral: 'bg-secondary text-muted-foreground',
  accent: 'bg-primary/10 text-primary',
  alert: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
} as const;

export type QuizMessageTone = keyof typeof TONE_TILE;

export function QuizMessage({
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  action,
  footnote,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: QuizMessageTone;
  /** The way forward. Every state that can offer one, does (standards §8iv). */
  action?: React.ReactNode;
  /** A quieter second line under the action — a "what happens next" note. */
  footnote?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 px-6 py-14 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-12 items-center justify-center rounded-2xl',
          TONE_TILE[tone],
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
      {footnote ? (
        <p className="max-w-sm text-xs text-muted-foreground/80">{footnote}</p>
      ) : null}
    </div>
  );
}
