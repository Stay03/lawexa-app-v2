import { format } from 'date-fns';
import type { QuizDifficulty, QuizSessionStatus } from '@/types/quiz';

/**
 * Formatting helpers for Quiz Mode. Decimal scores arrive as strings from the
 * API (e.g. "33.33") — always route them through `parseScore` before doing math.
 */

/** Parse a decimal-string score (e.g. "33.33") to a number; null/invalid → 0. */
export function parseScore(score: string | null | undefined): number {
  if (score == null) return 0;
  const n = parseFloat(score);
  return Number.isFinite(n) ? n : 0;
}

/** Render a score as a rounded percentage label, e.g. "33%". */
export function formatScorePercent(score: string | null | undefined): string {
  return `${Math.round(parseScore(score))}%`;
}

/** Format a session timestamp for display, e.g. "26 Jun 2026". */
export function formatSessionDate(iso: string): string {
  return format(new Date(iso), 'd MMM yyyy');
}

const DIFFICULTY_LABELS = ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

/** Human label for a difficulty level (for payloads that omit `difficulty_label`). */
export function difficultyLabel(difficulty: QuizDifficulty): string {
  return DIFFICULTY_LABELS[difficulty - 1] ?? `Level ${difficulty}`;
}

/** Tailwind classes for a difficulty badge, colour-coded by level (low-saturation). */
export function difficultyBadgeClasses(difficulty: QuizDifficulty): string {
  if (difficulty <= 2) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (difficulty === 3) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
}

/** Tailwind text colour for a live score, banded low / mid / high. */
export function scoreBandClasses(percent: number): string {
  if (percent >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (percent >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-foreground';
}

/** Format a duration in milliseconds as a compact label: "37s", "1m 5s", "2m". */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** Wall-clock duration of a session in ms, or null if it isn't finished. */
export function sessionDurationMs(
  startedAt: string,
  completedAt: string | null
): number | null {
  if (!completedAt) return null;
  const diff = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

/** Parse a decimal-string cost and format it for display, e.g. "0.012345" → "$0.0123". */
export function formatTokenCost(cost: string | null | undefined): string {
  if (cost == null) return '$0';
  const n = parseFloat(cost);
  if (!Number.isFinite(n) || n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

/** Display label + badge colour classes for a session status. */
export function sessionStatusMeta(status: QuizSessionStatus): {
  label: string;
  classes: string;
} {
  switch (status) {
    case 'active':
      return { label: 'In progress', classes: 'bg-primary/10 text-primary' };
    case 'completed':
      return {
        label: 'Completed',
        classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    case 'abandoned':
      return { label: 'Abandoned', classes: 'bg-muted text-muted-foreground' };
  }
}
