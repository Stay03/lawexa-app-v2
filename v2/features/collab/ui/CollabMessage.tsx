import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * CollabMessage — the ONE full-surface panel every Spaces/Channels state
 * renders through: sign in, create an account, verify your email, and the
 * W2+ designed refusals (not-a-member, load failure, empty channel list).
 * The house `PageState` geometry in its quiz incarnation (`QuizMessage`),
 * rebuilt for the collab feature rather than imported from it — features own
 * their panels so a quiz redesign can never restyle the spaces door
 * (phase-5 W1, 2026-08-04; refusals-are-designed-states rule, study A0).
 *
 * THREE TONES, VISUALLY DISTINCT (standards §8iv). The ICON never carries the
 * meaning alone: the title always says it in words.
 *  - `neutral`  empty / informational — a quiet secondary tile
 *  - `accent`   an invitation to act (sign in, create an account) — brand gold
 *  - `alert`    something blocked or failed — the amber tile
 *
 * Presentational and hook-free, so route fallbacks can render it inert.
 */

const TONE_TILE = {
  neutral: 'bg-secondary text-muted-foreground',
  accent: 'bg-primary/10 text-primary',
  alert: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
} as const;

export type CollabMessageTone = keyof typeof TONE_TILE;

export function CollabMessage({
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
  tone?: CollabMessageTone;
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
