'use client';

import { useEffect, useRef } from 'react';

import { V2_SHELL_CONTENT_ID } from '@/v2/shell/shell-content';

/**
 * ReadingProgress — the hairline at the top of a case that fills, in gold, as
 * the judgment is read.
 *
 * WHY. A judgment is one long column with no page numbers; on desktop the
 * outline rail says WHERE you are, but nothing says HOW FAR — and mobile has
 * no rail at all. A 2px progress line is long-form reading's quietest
 * wayfinding device: no chrome, no numbers, and it doubles as an honest
 * length signal the moment the page opens (a sliver of gold that barely grew
 * = a long read ahead).
 *
 * HOW. The v2 shell has ONE scroll container (`#v2-shell-content`); progress
 * is scrollTop over the scrollable extent. The bar is mutated DIRECTLY via a
 * ref inside a rAF-coalesced scroll handler — no React state, so scrolling
 * never re-renders the tree. The ResizeObservers re-measure when the content
 * grows ("Show all 61" adds two screens) or the viewport changes. It reflects
 * position rather than animating, so there is nothing to still under reduced
 * motion. `aria-hidden`: the outline rail and headings are the accessible
 * wayfinding; this is paint.
 */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = document.getElementById(V2_SHELL_CONTENT_ID);
    const bar = barRef.current;
    if (!scroller || !bar) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const progress = max > 0 ? Math.min(1, scroller.scrollTop / max) : 0;
      bar.style.transform = `scaleX(${progress})`;
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener('scroll', schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(scroller);
    if (scroller.firstElementChild) resize.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener('scroll', schedule);
      resize.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none sticky top-0 z-20 -mx-4 h-0">
      <div
        ref={barRef}
        className="h-0.5 origin-left bg-primary/70"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}
