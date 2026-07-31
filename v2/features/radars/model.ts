import { describeCron } from '@/lib/utils/cron';
import { formatRelativeTime } from '@/v2/shell/designs/modules';
import type { RadarListItem, RadarStatus, ScanStatus } from '@/types/radar';

/**
 * model.ts — the pure presentation vocabulary of the radar feature: status
 * labels, schedule summaries, and the relative-time grammar every surface
 * shares. No JSX, no hooks — importable from any radar component so the list
 * row, the detail header, and the report header can never disagree on how a
 * schedule or a timestamp reads.
 *
 * TIME IS ALWAYS THREADED IN. Every formatter takes `now` from the caller (a
 * lazy `useState(() => Date.now())` at the screen root), never reads the clock
 * itself — the React Compiler lint's no-`Date.now()`-in-render rule, applied
 * the same way `formatRelativeTime` (shell) already applies it.
 */

/** Status → label + dot colour. The label always renders beside the dot on
 *  radar surfaces (status is never colour-only). */
export const RADAR_STATUS: Record<
  RadarStatus,
  { label: string; dotClass: string }
> = {
  active: { label: 'Active', dotClass: 'bg-emerald-500' },
  paused: { label: 'Paused', dotClass: 'bg-amber-500' },
  archived: { label: 'Archived', dotClass: 'bg-muted-foreground/50' },
};

/** Scan status → the activity view's vocabulary. `tone` picks the badge
 *  styling; the WORD carries the meaning (never colour alone). */
export const SCAN_STATUS: Record<
  ScanStatus,
  { label: string; tone: 'neutral' | 'running' | 'positive' | 'negative' }
> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'running' },
  completed: { label: 'Completed', tone: 'positive' },
  failed: { label: 'Failed', tone: 'negative' },
  skipped_no_balance: { label: 'Skipped — no balance', tone: 'negative' },
};

/** Human schedule line ("Daily at 8:00 AM"), falling back to the raw cron for
 *  shapes `describeCron` cannot narrate. */
export function scheduleSummary(cron: string): string {
  return describeCron(cron) ?? `Custom — ${cron}`;
}

/** "2h ago" — the shell's compact relative grammar with the suffix the radar
 *  meta lines read naturally with. Empty for absent timestamps. */
export function agoLabel(iso: string | null | undefined, now: number): string {
  const compact = formatRelativeTime(iso, now);
  if (!compact) return '';
  return compact === 'now' ? 'just now' : `${compact} ago`;
}

/**
 * "in 2h" for a FUTURE timestamp (the next-scan line) — the shell formatter
 * clamps the future to "now", so the forward direction needs its own tiny
 * mirror of the same grammar. Returns '' for past/absent timestamps: a
 * next-scan time already behind the clock means the scheduler is about to
 * fire, and promising "in 0m" would be less honest than saying nothing.
 */
export function upcomingLabel(
  iso: string | null | undefined,
  now: number,
): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((then - now) / 60000);
  if (minutes < 1) return 'soon';
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `in ${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `in ${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `in ${months}mo`;
  return `in ${Math.round(days / 365)}y`;
}

/** The meta line under a radar's name — schedule first, then the two scan
 *  facts, each present only when it says something. One builder for the list
 *  row and the detail header. */
export function radarMetaParts(radar: RadarListItem, now: number): string[] {
  const parts: string[] = [scheduleSummary(radar.schedule_cron)];

  const last = agoLabel(radar.last_scan_at, now);
  parts.push(last ? `Last scan ${last}` : 'Never scanned');

  if (radar.status === 'active' && radar.next_scan_at) {
    const next = upcomingLabel(radar.next_scan_at, now);
    if (next) parts.push(`Next scan ${next}`);
  }
  if (radar.status === 'paused') {
    parts.push('Paused — no scans scheduled');
  }

  return parts;
}

/** Exact wall-clock rendering for hover titles, so the compact relative label
 *  never hides the real timestamp. */
export function exactTime(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toLocaleString();
}
