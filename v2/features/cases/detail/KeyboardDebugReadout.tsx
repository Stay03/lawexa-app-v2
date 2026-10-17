'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { V2_SHELL_CONTENT_ID } from '@/v2/shell/shell-content';
import { isChromiumIOS } from './chromium-ios';

const CARD = '[role="dialog"][aria-label="Chat about this case"]';
const DEBUG_OUTLINES = `
${CARD} > :first-child > :first-child { outline: 2px solid #84cc16; outline-offset: -2px; }
${CARD} > :first-child { outline: 2px solid #d946ef; outline-offset: -4px; }
${CARD} > :last-child { outline: 2px solid #06b6d4; outline-offset: -2px; }
`;

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

    /** An element as its tag, first class, z-index, opacity and position (and
     *  `hidden` when not displayed): no text, no ids of people. */
    const describe = (element: Element | null): string => {
      if (!element) return 'none';
      const style = getComputedStyle(element);
      const classes = [...element.classList].slice(0, 1).join('.');
      return `${element.tagName.toLowerCase()}${classes ? '.' + classes : ''} ${style.display === 'none' ? 'hidden ' : ''}z${style.zIndex} o${style.opacity} ${style.position.slice(0, 3)}`;
    };
    const centreOf = (element: Element): { x: number; y: number } => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const stackAt = (point: { x: number; y: number } | null): string =>
      point
        ? document.elementsFromPoint(point.x, point.y).slice(0, 2).map(describe).join(' > ') || 'nothing'
        : 'none';

    // When the last focus landed, so a frame's distance from the tap is read
    // off the recording.
    let focusedAt = Number.NaN;
    const ms = (value: number): string => (Number.isNaN(value) ? 'none' : `${Math.round(value)}`);
    const chromium = isChromiumIOS(navigator.userAgent);
    const holds: string[] = [];

    const draw = (): void => {
      const card = document.querySelector<HTMLElement>(CARD);
      const bar = document.querySelector('.v2-shell__header');
      const content = document.getElementById(V2_SHELL_CONTENT_ID);
      const close = card?.querySelector('[aria-label="Close the chat"]') ?? null;
      const active = document.activeElement;
      const composerFocused =
        card !== null && active instanceof HTMLTextAreaElement && card.contains(active);
      const root = document.documentElement.style;
      const published =
        parseFloat(root.getPropertyValue('--visual-top')) +
        parseFloat(root.getPropertyValue('--visual-height'));
      const heldTop = card?.style.getPropertyValue('--v2-case-chat-held-top') ?? '';
      const heldHeight = card?.style.getPropertyValue('--v2-case-chat-held-height') ?? '';
      const heldPad = card?.style.getPropertyValue('--v2-case-chat-held-pad') ?? '';
      const box = composerFocused ? active.getBoundingClientRect() : null;
      const slot = card?.firstElementChild ?? null;
      const composer = card?.lastElementChild ?? null;
      output.textContent = [
        `ua ${chromium ? 'chromium-ios' : 'other'}`,
        `t ${Math.round(performance.now() % 100000)}`,
        `since focus ${ms(performance.now() - focusedAt)}`,
        `vv.top+h ${ms(published)}`,
        `card h ${card ? card.offsetHeight : 'none'}`,
        `held ${heldTop || heldHeight ? `${heldTop} ${heldHeight}` : 'none'}`,
        `rising ${card?.getAttribute('data-keyboard') ?? 'no'}`,
        `pad ${heldPad || 'none'}`,
        `box ${box ? `top ${Math.round(box.top)} h ${Math.round(box.height)} bottom ${Math.round(box.bottom)}` : 'none'}`,
        `html bg ${root.backgroundColor || 'none'}`,
        `slot opacity ${slot ? getComputedStyle(slot).opacity : 'none'}`,
        `card opacity ${card ? getComputedStyle(card).opacity : 'none'} state ${card?.getAttribute('data-state') ?? 'none'}`,
        `reserve ${card?.hasAttribute('data-accessory-reserve') ? card.style.getPropertyValue('padding-bottom') : 'none'}`,
        `slot ${rectOf(slot)}`,
        `composer ${rectOf(composer)}`,
        `holds ${holds.length ? holds.join(' ') : 'none'}`,
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
        // WHAT SITS ON TOP. The top two elements under the card's centre and
        // the box's centre, and the shell's rows: a blank card with its
        // outlines' top edge still showing (recording 3) is covered by
        // something, and these name it. Hit testing skips anything with
        // `pointer-events: none`, so the shell rows are listed as well.
        `at card ${stackAt(card ? centreOf(card) : null)}`,
        `at box ${stackAt(box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null)}`,
        `shell ${describe(document.querySelector('.v2-shell'))} ${rectOf(document.querySelector('.v2-shell'))}`,
        `dock ${describe(document.querySelector('.v2-shell__dock'))} ${rectOf(document.querySelector('.v2-shell__dock'))}`,
        `content el ${describe(content)}`,
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
    const onFocusIn = (): void => {
      focusedAt = performance.now();
      change();
    };

    // The hold's states with their times since the last focus, the last four:
    // which states the card passed through, which no single frame shows.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target as HTMLElement;
        if (!target.matches(CARD)) continue;
        const state = target.getAttribute('data-keyboard') ?? 'off';
        holds.push(`${state}@${ms(performance.now() - focusedAt)}`);
        if (holds.length > 4) holds.shift();
        change();
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-keyboard'] });

    draw();
    viewport?.addEventListener('resize', change);
    viewport?.addEventListener('scroll', change);
    window.addEventListener('scroll', change);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', change);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', change);
      viewport?.removeEventListener('scroll', change);
      window.removeEventListener('scroll', change);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', change);
    };
  }, []);

  return createPortal(
    <>
      {/* WHERE EACH PART PAINTS. The numbers above are layout; a recording
          shows pixels. Outlines that cost no layout (`outline`, not `border`)
          on the chat's bar (lime), its middle (magenta) and its composer
          (cyan) show on the video where each one is drawn, so a blank card can
          be told apart from a card drawn somewhere else (Arthur's recording 2,
          16 October 2026). */}
      <style>{DEBUG_OUTLINES}</style>
      <pre
        ref={outputRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-[var(--visual-top,0px)] z-[2147483647] m-0 max-w-[55vw] bg-black/70 px-1 py-0.5 font-mono text-[9px] leading-tight break-all whitespace-pre-wrap text-white"
      />
    </>,
    document.body,
  );
}
