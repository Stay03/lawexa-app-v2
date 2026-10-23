'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useSidePanel } from './SidePanelContext';

/**
 * ChatSidePanel — the frame of the chat's one side panel: a header (what it
 * shows, and its actions), a body that scrolls, and an optional footer. What
 * goes inside is the caller's: a draft (the draft editor), a file or a note
 * (the file list in chat).
 *
 * ── ONE ELEMENT, TWO SHAPES, NO JAVASCRIPT BREAKPOINT ──────────────────────
 * The house rule (ResponsiveOverlay.tsx): the shape changes in CSS, so the
 * first paint is right and a resize never remounts what is typed inside.
 *
 *   below xl   a sheet from the bottom over the chat, with a dimmed backdrop;
 *              its height is the visible viewport minus the iOS keyboard
 *              inset (`--keyboard-inset`), so an editor's caret is never under
 *              the keyboard.
 *   xl and up  a panel BESIDE the transcript, in the chat's own row: the
 *              transcript narrows and stays readable. The floating message box
 *              lives in the shell's dock, outside this row, so the panel writes
 *              its width to `--v2-side-panel-w` on the root and a shell.css
 *              rule pads the dock by it, keeping the box over the transcript.
 *
 * ── IT CLOSES WITH ITS EXIT ────────────────────────────────────────────────
 * The close button, Escape and the backdrop mark the panel closing; the exit
 * animation's end walks the URL back (SidePanelContext). With reduced motion
 * there is no animation to end, so it closes at once.
 */

export function ChatSidePanel({
  label,
  title,
  subtitle,
  icon,
  actions,
  footer,
  children,
}: {
  /** The panel's accessible name ("Draft", "File"). */
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Buttons beside the close button. */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const panel = useSidePanel();
  const frameRef = useRef<HTMLElement | null>(null);
  const closing = panel?.closing ?? false;

  // The panel's width on a computer, for the dock's padding (see the docblock).
  // A DOM write in an effect, no React state: the shell reads it in CSS.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const root = document.documentElement;
    root.setAttribute('data-v2-side-panel', '');
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty('--v2-side-panel-w', `${Math.round(entry.contentRect.width)}px`);
    });
    observer.observe(frame);
    return () => {
      observer.disconnect();
      root.removeAttribute('data-v2-side-panel');
      root.style.removeProperty('--v2-side-panel-w');
    };
  }, []);

  if (!panel) return null;

  const requestClose = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) panel.finishClose();
    else panel.close();
  };

  return (
    <>
      {/* The backdrop, below xl only: a tap outside the sheet closes it. */}
      <div
        aria-hidden
        onClick={requestClose}
        data-state={closing ? 'closed' : 'open'}
        className="fixed inset-0 z-50 bg-black/50 motion-safe:animate-in motion-safe:fade-in data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out data-[state=closed]:motion-safe:fill-mode-forwards xl:hidden"
      />
      <aside
        ref={frameRef}
        aria-label={label}
        data-state={closing ? 'closed' : 'open'}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            requestClose();
          }
        }}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) panel.finishClose();
        }}
        className={cn(
          // Below xl: the sheet.
          'fixed inset-x-0 bottom-0 z-50 flex h-[calc(100dvh-var(--keyboard-inset,0px)-2.5rem)] flex-col overflow-hidden rounded-t-3xl border-t border-border bg-popover shadow-[0_-18px_48px_-24px_rgba(0,0,0,0.5)]',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom-10 motion-safe:fade-in motion-safe:duration-300',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:slide-out-to-bottom-10 data-[state=closed]:motion-safe:fade-out data-[state=closed]:motion-safe:duration-200 data-[state=closed]:motion-safe:fill-mode-forwards',
          // xl and up: the panel beside the transcript.
          'xl:static xl:z-auto xl:h-full xl:w-[min(48%,46rem)] xl:min-w-[26rem] xl:shrink-0 xl:rounded-none xl:border-t-0 xl:border-l xl:shadow-none',
          'xl:motion-safe:slide-in-from-bottom-0 xl:motion-safe:slide-in-from-right-6 xl:data-[state=closed]:motion-safe:slide-out-to-bottom-0 xl:data-[state=closed]:motion-safe:slide-out-to-right-6',
        )}
      >
        {/* The grab line, below xl: the sheet's shape, not a control. */}
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border xl:hidden" />
        <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3 xl:px-5">
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] leading-snug font-semibold text-foreground">{title}</h2>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions}
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className={cn(
              'v2-interactive -mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 items-center gap-2 border-t border-border/70 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:px-5">
            {footer}
          </footer>
        ) : null}
      </aside>
    </>
  );
}
