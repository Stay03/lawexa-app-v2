'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { V2_SHELL_CONTENT_ID } from '@/v2/shell/shell-content';

/**
 * KeyboardDebugReadout shows live viewport numbers over the case page, for a
 * screen recording on a real iPhone (12 October 2026).
 *
 * TEMPORARY. Delete this file, and its one `dynamic()` import and render in
 * `CaseScreen`, once Arthur's recording with `?kbdebug=1` has been read.
 * Playwright cannot raise the iOS keyboard, so these numbers are the only way
 * to see where iOS puts the page and the phone chat while the keyboard moves.
 *
 * It mounts only with `?kbdebug=1` on the address (`CaseScreen` imports it
 * lazily behind that flag), so without the flag the module is never loaded and
 * no listener exists. It shows numbers and booleans only: no names, no text
 * and no ids. Portalled to `body` so the readout is above the shell and the
 * chat card whatever their stacking; `pointer-events: none`, so it never takes
 * a tap. Its top is the visible viewport's (`--visual-top`), so it stays on
 * screen while iOS pans the page for the keyboard. The text is written to the
 * DOM, never to state, so it re-renders nothing.
 */
export function KeyboardDebugReadout() {
  const outputRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const output = outputRef.current;
    if (!output) return;
    const viewport = window.visualViewport;

    const rectOf = (element: Element | null): string => {
      if (!element) return 'none';
      const rect = element.getBoundingClientRect();
      return `top ${Math.round(rect.top)} h ${Math.round(rect.height)}`;
    };

    const draw = (): void => {
      const card = document.querySelector('[role="dialog"][aria-label="Chat about this case"]');
      const bar = document.querySelector('.v2-shell__header');
      const content = document.getElementById(V2_SHELL_CONTENT_ID);
      const close = card?.querySelector('[aria-label="Close the chat"]') ?? null;
      const active = document.activeElement;
      const composerFocused =
        card !== null && active instanceof HTMLTextAreaElement && card.contains(active);
      output.textContent = [
        `vv.offsetTop ${viewport ? Math.round(viewport.offsetTop) : 'n/a'}`,
        `vv.height ${viewport ? Math.round(viewport.height) : 'n/a'}`,
        `innerHeight ${window.innerHeight}`,
        `scrollY ${Math.round(window.scrollY)}`,
        `html.scrollTop ${Math.round(document.documentElement.scrollTop)}`,
        `content.scrollTop ${content ? Math.round(content.scrollTop) : 'none'}`,
        `card ${rectOf(card)}`,
        `bar ${rectOf(bar)}`,
        `content ${rectOf(content)}`,
        `header display ${bar ? getComputedStyle(bar).display : 'none'}`,
        `X ${rectOf(close)}`,
        `composer focused ${composerFocused ? 'yes' : 'no'}`,
      ].join('\n');
    };

    // Every frame for 2 s after a change, so the keyboard's animation and
    // iOS's scroll are caught between the events.
    let frame = 0;
    let until = 0;
    const tick = (): void => {
      draw();
      frame = performance.now() < until ? requestAnimationFrame(tick) : 0;
    };
    const change = (): void => {
      until = performance.now() + 2000;
      if (frame === 0) frame = requestAnimationFrame(tick);
    };

    draw();
    viewport?.addEventListener('resize', change);
    viewport?.addEventListener('scroll', change);
    window.addEventListener('scroll', change);
    document.addEventListener('focusin', change);
    document.addEventListener('focusout', change);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', change);
      viewport?.removeEventListener('scroll', change);
      window.removeEventListener('scroll', change);
      document.removeEventListener('focusin', change);
      document.removeEventListener('focusout', change);
    };
  }, []);

  return createPortal(
    <pre
      ref={outputRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-[var(--visual-top,0px)] z-[2147483647] m-0 bg-black/70 px-1 py-0.5 font-mono text-[9px] leading-tight text-white"
    />,
    document.body,
  );
}
