'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * ActivityStatus — the ONE unified activity region (§C REDESIGN). v1 showed FOUR
 * disjoint indicators (rotating thinking phrases, narration text, an elapsed timer,
 * and a "generating" pill); this replaces all of them with a single calm status
 * line: a quiet spinner, the model's latest narration when present (else a steady
 * resting label), and the elapsed time — one row, no competing motion.
 *
 * The elapsed clock ticks off `startTime` via a timer (Date.now is read in the
 * effect/interval, never in render — React Compiler clean). It resets when the
 * stream ends.
 */
const RESTING_LABEL = 'Working through your request';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function ActivityStatus({
  startTime,
  narration,
}: {
  /** Epoch ms the current stream began (from the first tool/handover/placeholder). */
  startTime: number | null;
  /** Latest transient narration line, or null for the resting label. */
  narration: string | null;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // setState only in the interval CALLBACK (an external-clock subscription) —
    // never synchronously in the effect body (React Compiler lint). The component
    // remounts per stream, so `elapsed` starts fresh at 0 without an explicit reset.
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="text-muted-foreground flex items-center gap-2 text-sm"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      <span className="text-shimmer min-w-0 truncate font-medium">
        {narration ?? RESTING_LABEL}
      </span>
      {elapsed > 0 && (
        <span className="text-muted-foreground/70 shrink-0 text-xs tabular-nums">
          · {formatElapsed(elapsed)}
        </span>
      )}
    </div>
  );
}
