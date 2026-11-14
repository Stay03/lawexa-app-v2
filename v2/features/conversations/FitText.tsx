'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * FitText — one line that never cuts off: `full` when it fits the space it is
 * given, `short` when it does not (redacted mode's "What to hide" line, Techlead,
 * 14 November 2026: "never truncate", measured, not guessed by a count).
 *
 * The slot takes the room its row leaves it (`flex-1 min-w-0` from the caller),
 * so its width does not depend on which text it shows; a hidden copy of `full`
 * is measured against it. Both are watched, so a narrower phone, a wider window
 * or a new `full` each decide again.
 */
export function FitText({ full, short, className }: { full: string; short: string; className?: string }) {
  const slot = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const room = slot.current;
    const measure = probe.current;
    if (!room || !measure) return;
    // The observer reports both elements once at the start, then on every change of either size.
    const observer = new ResizeObserver(() => setFits(measure.offsetWidth <= room.clientWidth));
    observer.observe(room);
    observer.observe(measure);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={slot} className={cn('relative block min-w-0 overflow-hidden whitespace-nowrap', className)}>
      <span ref={probe} aria-hidden className="invisible absolute top-0 left-0 whitespace-nowrap">
        {full}
      </span>
      {fits ? full : short}
    </span>
  );
}
