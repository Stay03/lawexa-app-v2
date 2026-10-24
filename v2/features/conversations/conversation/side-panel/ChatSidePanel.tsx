'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useSidePanel, type SidePanelApi } from './SidePanelContext';
import './side-panel.css';

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
 *   below xl   a sheet over the chat, with a dimmed backdrop. It takes the
 *              VISIBLE rectangle the keyboard hook publishes (`--visual-top`,
 *              `--visual-height`, use-keyboard-inset.ts), less a 2.5rem strip
 *              at the top, so with the keyboard up it sits whole above it. It
 *              used to stand on the page's bottom at the height of the screen
 *              less the keyboard, and on iOS, which leaves the page's bottom
 *              behind the keyboard, only its title showed above it (Arthur's
 *              iPhone recording, 24 October 2026). While it is open the chat's
 *              message box is hidden (shell.css): the sheet owns the screen.
 *   xl and up  a panel BESIDE the transcript, in the chat's own row: the
 *              transcript narrows and stays readable. The floating message box
 *              lives in the shell's dock, outside this row, so the panel writes
 *              its width to `--v2-side-panel-w` on the root and a shell.css
 *              rule pads the dock by it, keeping the box over the transcript.
 *
 * ── BARE ON A COMPUTER (`bare`) ────────────────────────────────────────────
 * The draft's panel on a computer (take B2, Stay 24 October 2026: "remove that
 * heading text and word count at the top"): no header at all, so the body's
 * own bar is the panel's only bar and carries `SidePanelCloseButton`; no rule
 * between the chat and the panel, which stands apart by its background
 * (`--v2-side-panel-bg`, side-panel.css); and room for a wide page on a wide
 * monitor, up to 56rem. Below xl the sheet is the same as without it.
 *
 * ── THE CARD (`frame: 'card'`) ──────────────────────────────────────────────
 * On the case page (side-panel-host.tsx) the panel on a computer is a rounded
 * card that fills the box the page keeps for it, the reading area left of the
 * docked chat, in the chat card's own shape (Stay, 24 October 2026: "Move to
 * the right"). It is uncovered from its left edge (`v2-side-panel-wipe-in`,
 * side-panel.css) while its contents stay still, and covered again the same
 * way on close. It writes no width to the root: there is no shell dock to pad.
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
  bare = false,
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
  /** On a computer: no header, no rule, the panel's own background (see the docblock). */
  bare?: boolean;
  children: ReactNode;
}) {
  const panel = useSidePanel();
  const frameRef = useRef<HTMLElement | null>(null);
  const closing = panel?.closing ?? false;
  const card = panel?.frame === 'card';

  // The panel's width on a computer, for the dock's padding (see the docblock).
  // A DOM write in an effect, no React state: the shell reads it in CSS.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || card) return;
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
  }, [card]);

  if (!panel) return null;

  const requestClose = () => closePanel(panel);

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
          // Only an Escape pressed in the panel itself. A menu opened from the
          // panel (the bar's ···, Saved, the font menus) draws in a portal outside
          // it, and React still passes its keys up here: its Escape closes the
          // menu alone.
          if (event.key !== 'Escape' || !event.currentTarget.contains(event.target as Node)) return;
          event.stopPropagation();
          requestClose();
        }}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) panel.finishClose();
        }}
        className={cn(
          // Below xl: the sheet.
          'fixed inset-x-0 top-[calc(var(--visual-top,0px)+2.5rem)] z-50 flex h-[calc(var(--visual-height,100dvh)-2.5rem)] flex-col overflow-hidden rounded-t-3xl border-t border-border bg-popover shadow-[0_-18px_48px_-24px_rgba(0,0,0,0.5)]',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom-10 motion-safe:fade-in motion-safe:duration-300',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:slide-out-to-bottom-10 data-[state=closed]:motion-safe:fade-out data-[state=closed]:motion-safe:duration-200 data-[state=closed]:motion-safe:fill-mode-forwards',
          card
            ? // xl and up, the card: the whole box the host keeps, in the shape of the chat card, wiped in from the left.
              cn(
                'xl:static xl:z-auto xl:h-full xl:w-full xl:rounded-2xl xl:border xl:border-border xl:shadow-[0_18px_48px_-24px_rgba(0,0,0,0.35)]',
                'xl:data-[state=open]:motion-safe:animate-[v2-side-panel-wipe-in_520ms_cubic-bezier(0.32,0.72,0,1)_60ms_both]',
                'xl:data-[state=closed]:motion-safe:animate-[v2-side-panel-wipe-out_200ms_ease-in_forwards]',
              )
            : // xl and up: the panel beside the transcript.
              cn(
                'xl:static xl:z-auto xl:h-full xl:w-[min(48%,46rem)] xl:min-w-[26rem] xl:shrink-0 xl:rounded-none xl:border-t-0 xl:border-l xl:shadow-none',
                'xl:motion-safe:slide-in-from-bottom-0 xl:motion-safe:slide-in-from-right-6 xl:data-[state=closed]:motion-safe:slide-out-to-bottom-0 xl:data-[state=closed]:motion-safe:slide-out-to-right-6',
                // Bare beside the chat: no rule, the panel's own background, room for a wide page.
                bare && 'v2-side-panel-bare xl:w-[min(52%,56rem)] xl:border-l-0',
              ),
        )}
      >
        {/* The grab line, below xl: the sheet's shape, not a control. */}
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border xl:hidden" />
        <header
          className={cn(
            'flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3 xl:px-5',
            bare && 'xl:hidden',
          )}
        >
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
        <div className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 items-center gap-2 border-t border-border/70 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:px-5">
            {footer}
          </footer>
        ) : null}
      </aside>
    </>
  );
}

/** Close with the exit animation, or at once under reduced motion (see the docblock). */
function closePanel(panel: SidePanelApi) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) panel.finishClose();
  else panel.close();
}

/**
 * The close button for a `bare` panel's own bar on a computer: 30px, the bar's
 * soft hover. Not drawn below xl, where the sheet's header has its own.
 */
export function SidePanelCloseButton() {
  const panel = useSidePanel();
  if (!panel) return null;
  return (
    <button
      type="button"
      onClick={() => closePanel(panel)}
      aria-label="Close"
      className={cn(
        'v2-interactive hidden size-7.5 shrink-0 items-center justify-center rounded-lg text-foreground/62 transition-colors xl:flex',
        'hover:bg-foreground/6 hover:text-foreground dark:hover:bg-white/7',
        FOCUS_RING,
      )}
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}
