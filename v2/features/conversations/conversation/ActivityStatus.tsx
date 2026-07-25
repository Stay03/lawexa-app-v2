'use client';

import { useEffect, useState } from 'react';
import { ThinkingOrb } from 'thinking-orbs';

/**
 * ActivityStatus — the ONE unified activity region (§C REDESIGN). v1 showed FOUR
 * disjoint indicators (rotating thinking phrases, narration text, an elapsed timer,
 * and a "generating" pill); this replaces all of them with a single calm status
 * line: the thinking orb, the model's latest narration when present (else a steady
 * resting label), and the elapsed time — one row, no competing motion.
 *
 * THE ORB (owner, July 25 — replaces a spinning `Loader2`). `thinking-orbs`, MIT,
 * ~38KB unpacked with no runtime dependencies; the owner chose the `solving` state
 * (bands scramble in quarter turns, then click back) at the `20` inline-text preset.
 * The two presets are separate designs rather than one scaled drawing, so 20 is the
 * only correct choice beside body text — 64 is the chat-avatar drawing.
 *
 * It suits this surface for reasons beyond looks: it paints on a plain 2D canvas
 * (no WebGL, no `ctx.filter`, no SVG filters), it honours `prefers-reduced-motion`
 * by drawing ONE static frame, and it pauses itself when scrolled off screen or when
 * the tab is hidden. That last part matters here more than anywhere — this row sits
 * in a live transcript during a stream, which is exactly when the page can least
 * afford a decorative animation burning frames off screen.
 *
 * `theme="auto"` resolves from the `dark` class our shadcn setup already puts on
 * `<html>`, and live-updates through a MutationObserver, so the orb follows the
 * theme toggle with nothing wired here.
 *
 * `aria-hidden` on purpose: the component ships `role="img"` with its own label, but
 * this row is already a `role="status"` live region whose TEXT carries the meaning.
 * Announcing both would say the same thing twice — the same reason the old spinner
 * was hidden.
 *
 * VERSION NOTE: the package is at 0.1.x. It is small, dependency-free and MIT, so
 * the exposure is bounded and vendoring it is a one-afternoon fallback, but do not
 * treat its API as settled.
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
      <ThinkingOrb state="solving" size={20} className="shrink-0" aria-hidden />
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
