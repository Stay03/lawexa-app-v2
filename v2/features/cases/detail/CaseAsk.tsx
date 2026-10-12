'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { PanelRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { V2_SHELL_CONTENT_ID } from '@/v2/shell/shell-content';
import type { ConversationComposerHandle } from '@/v2/features/conversations/conversation/ConversationComposer';
import {
  CaseChatBar,
  CaseChatComposerDock,
  CaseChatMiddle,
  type CaseChatStart,
} from './CaseChatCore';
import { guardChatDrags } from './case-chat-drag-guard';

/**
 * The shell's own bars, taken out of the layout (`display: none`) while the
 * phone chat covers the screen: they take no grid row, so the content region,
 * and the fixed card inside it, starts at the screen's top, and Tab and a
 * screen reader stay inside the chat. The case page's own regions take `inert`
 * as props in `CaseScreen`; these sit outside it.
 */
const SHELL_CHROME = ['.v2-shell__header', '.v2-shell__dock'] as const;

/**
 * CaseAskDock — the case chat's one screen (`CaseChatCore`) as a dock at the
 * bottom of the case page: closed pill, new-chat view, and open conversation
 * are three states of the SAME card, and the middle is the only part that ever
 * changes (owner, July 31 — "one complete unit", then "everything on the first
 * screen, the same text area").
 *
 * TWO GEOMETRIES, ONE ELEMENT TREE.
 *
 *   xl and up (floating) — the panel (bar + middle) grid-grows above the
 *     composer inside a 26rem card while the chrome fades in around both.
 *   below xl (`screen`) — the open card is the whole visible screen: fixed,
 *     its top at the visual viewport's top and its height the visual
 *     viewport's height, so its last child, the composer, sits on the
 *     keyboard (Arthur, 11 October 2026: "a single tap should open the chat
 *     and bring up the keyboard"). The bar's X is its one close button.
 *
 * ONE TAP RAISES THE KEYBOARD BECAUSE NOTHING IS REMOUNTED. WebKit opens the
 * keyboard only for a focus made inside the reader's gesture. The reader taps
 * the composer's own box; that focus opens the chat (`onEngage`), and the card
 * grows around the box that already has focus. The panel slot renders `null`
 * when closed, so the composer keeps its tree position — and therefore focus,
 * caret, draft and staged files — through closed ⇄ open in both geometries.
 * The phone presentation used to be a separate sheet that mounted a second
 * box nobody had focused, which is why it took two taps.
 *
 * NO SLIDE ON THE PHONE. The open card does not move: the bar and middle fade
 * in above a composer that stays where the reader's finger left it. A box
 * whose height changes while it slides was the jump Stay saw on Samsung.
 *
 * CLOSING ON THE PHONE IS ONE FADE OF A STILL CARD. The card keeps the top
 * and height it had at the close while the keyboard goes down, the whole
 * card (its colour too) fades out once, and only then does it return to the
 * docked pill and give the page back its bars and its scroll (see the close
 * effect below).
 */
export function CaseAskDock({
  slug,
  signedIn,
  viewerId,
  start,
  view,
  panelOpen,
  screen = false,
  onEngage,
  onClose,
  onDock,
  onOpenChat,
  arrive = true,
}: {
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  start: CaseChatStart;
  /**
   * Fade the dock in as it mounts. False when the case screen mounted with
   * the case already in hand (see `CaseScreen`), so the page replacing the
   * loading boundary does not replay the fade on the dock.
   */
  arrive?: boolean;
  /** What the panel shows: nothing (closed), the new-chat view, or a
   * conversation id — the HOLDOVER value, so exits can animate. */
  view: string | null;
  /** The panel is expanded (false while collapsing toward unmount). */
  panelOpen: boolean;
  /** Below xl: the open card covers the visible screen (see the docblock). */
  screen?: boolean;
  /** Open the chat for this width (full screen below xl, the card at xl). */
  onEngage: () => void;
  onClose: () => void;
  onDock: () => void;
  onOpenChat: (conversationId: string) => void;
}) {
  const panelMounted = view !== null;
  const screenMounted = screen && panelMounted;
  const stageRef = useRef<ConversationComposerHandle | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // THE PAGE KEEPS ITS LENGTH WHILE THE CARD IS OUT OF THE FLOW. The resting
  // dock is the end of the case column, so its height is part of the
  // scroller's length; when the open card turns fixed that length would
  // shrink by the pill, and a reader at the end of the judgment would be
  // pulled up. The wrapper's resting height is kept in a CSS variable and
  // held as its minimum while the screen is open. Written to the DOM only,
  // never to state, so measuring re-renders nothing.
  const screenMountedRef = useRef(screenMounted);
  useEffect(() => {
    screenMountedRef.current = screenMounted;
  }, [screenMounted]);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      if (screenMountedRef.current) return;
      const box = entries[0]?.borderBoxSize?.[0];
      const height = box ? box.blockSize : wrapper.getBoundingClientRect().height;
      wrapper.style.setProperty('--v2-case-dock-h', `${Math.round(height)}px`);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // WHILE THE PHONE CHAT IS OPEN THE SHELL'S BARS TAKE NO ROW. The card is
  // fixed but a DOM child of the shell's scroll region, and iOS WebKit clips
  // it to that region's box. With the bar only unpainted (`visibility:
  // hidden`, 12 October 2026) its 56 px row stayed, the region started under
  // it, and the card's top 56 px, its own bar and X, were cut whenever the
  // card's top was at the screen's top: with the keyboard down after Done,
  // and in the open's first frame (Arthur's recordings, 12 October 2026).
  // `display: none` gives the row up, so the region starts at the screen's
  // top and the card is inside its box in every state; it also takes the
  // bars out of the tab order and the accessibility tree (the page's own
  // regions take `inert` in CaseScreen). A layout effect, so the bar is gone
  // in the card's first frame.
  //
  // NOTHING ON THE PAGE MOVES WITH THE BARS. The region grows by the rows
  // they gave up, and it takes the same amount as padding, top and bottom,
  // measured across the change. Every line of the judgment stays at the
  // pixel it had, which shows through the closing fade, and the scroll range
  // keeps its length, so the offset is never clamped and the reading place
  // is the same one when the bars come back.
  //
  // THE BARS COME BACK ON EVERY WAY OUT. Every close (the bar's X, Escape,
  // Back) ends the open screen once its fade is done, and a route change or
  // an unmount ends this component: all of them run the cleanup. Leaving the
  // page (`pagehide`) gives them back too, so a page frozen in the
  // back-forward cache never holds hidden bars; if it comes back from that
  // cache (`pageshow`, persisted) with the chat still open, they hide again.
  useLayoutEffect(() => {
    if (!screenMounted) return;
    const chrome = SHELL_CHROME.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)),
    );
    const scroller = document.getElementById(V2_SHELL_CONTENT_ID);
    if (!scroller) return;
    const display = chrome.map((element) => element.style.display);
    const { paddingTop, paddingBottom } = scroller.style;
    const hide = (): void => {
      const before = scroller.getBoundingClientRect();
      chrome.forEach((element) => {
        element.style.display = 'none';
      });
      const after = scroller.getBoundingClientRect();
      const padding = getComputedStyle(scroller);
      scroller.style.paddingTop = `${parseFloat(padding.paddingTop) + before.top - after.top}px`;
      scroller.style.paddingBottom = `${parseFloat(padding.paddingBottom) + after.bottom - before.bottom}px`;
    };
    const restore = (): void => {
      chrome.forEach((element, index) => {
        element.style.display = display[index];
      });
      scroller.style.paddingTop = paddingTop;
      scroller.style.paddingBottom = paddingBottom;
    };
    const onPageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) hide();
    };
    hide();
    window.addEventListener('pagehide', restore);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pagehide', restore);
      window.removeEventListener('pageshow', onPageShow);
      restore();
    };
  }, [screenMounted]);

  // WHILE THE PHONE CHAT IS OPEN THE PAGE UNDER IT CANNOT SCROLL. The card is
  // fixed but still a DOM child of the shell's scroller, and iOS hands a drag
  // that the chat cannot use (a short list, the bar, the composer, a scroller
  // at its end) to that ancestor: the judgment moved under a still chat
  // (Arthur's iPhone, after 16b19dd). `overflow: hidden` on a scroller that
  // is not the document stops iOS too, and it keeps the offset, so closing
  // returns to the same paragraph; the offset is put back only if something
  // moved it meanwhile. A layout effect, so the lock is on in the card's
  // first frame and, when the screen ends, comes off in the frame that
  // returns the card to the pill, the offset already back. The screen ends
  // from a timeout (CaseScreen's holdover), and a passive cleanup ran after
  // that frame had painted: with the offset reset under the open chat, the
  // judgment's top showed for one frame before it jumped back.
  useLayoutEffect(() => {
    if (!screenMounted) return;
    const scroller = document.getElementById(V2_SHELL_CONTENT_ID);
    if (!scroller) return;
    const readingTop = scroller.scrollTop;
    const previousOverflow = scroller.style.overflowY;
    scroller.style.overflowY = 'hidden';
    return () => {
      scroller.style.overflowY = previousOverflow;
      if (scroller.scrollTop !== readingTop) scroller.scrollTop = readingTop;
    };
  }, [screenMounted]);

  // CLOSING ON A PHONE puts the keyboard away. The box still has focus when
  // the chat closes (the X, Escape, Back), and a focused box keeps the
  // keyboard up over a page with no chat on it. Focus moves to the card, one
  // Tab from the box; not back to the box itself, which would raise the
  // keyboard again.
  // `preventScroll` because a focus must never move the judgment.
  //
  // THE CARD HOLDS STILL WHILE IT FADES. The card's top and height follow the
  // visible viewport, so as the keyboard went down under the closing fade the
  // card grew and moved with it (Arthur's iPhone, 12 October 2026). Before
  // the blur, the card's measured top and height are written to two
  // variables its style reads first, so the keyboard's retreat cannot move
  // it; the fade then runs once on the whole card. They are dropped when the
  // card leaves the screen (after the fade) or the reader opens it again
  // mid-fade. A layout effect, so the card is frozen in the close's first
  // frame, before the blur can resize anything.
  const screenOpen = screen && panelOpen;
  const wasScreenOpen = useRef(screenOpen);
  useLayoutEffect(() => {
    const closed = wasScreenOpen.current && !screenOpen;
    wasScreenOpen.current = screenOpen;
    const card = cardRef.current;
    if (!closed || !card) return;
    if (screenMounted) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--v2-case-chat-closing-top', `${rect.top}px`);
      card.style.setProperty('--v2-case-chat-closing-height', `${rect.height}px`);
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && card.contains(active)) {
      active.blur();
      card.focus({ preventScroll: true });
    }
    return () => {
      card.style.removeProperty('--v2-case-chat-closing-top');
      card.style.removeProperty('--v2-case-chat-closing-height');
    };
  }, [screenOpen, screenMounted]);

  // WHILE THE PHONE CHAT IS OPEN A DRAG IN IT NEVER PANS THE SCREEN. With the
  // keyboard up, iOS scrolls the visible viewport inside the taller layout
  // viewport on any drag the page does not use, and the fixed card lagged
  // behind it: the chat's bar left the top and the page showed under the
  // composer (Arthur's Safari recording, 12 October 2026). The guard cancels
  // only drags that no scroller in the chat can take (case-chat-drag-guard).
  // Added on the card while the chat is open, removed on close.
  useEffect(() => {
    const card = cardRef.current;
    if (!screenOpen || !card) return;
    return guardChatDrags(card);
  }, [screenOpen]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        // `sticky` with a z-index makes this wrapper a stacking context, so
        // the open phone card's own z-index only counts inside it: the
        // wrapper itself rises above the page (the reading-progress line is
        // z-20, the bar z-30) while the card covers the screen.
        'sticky bottom-0 -mx-4 mt-auto px-4 pb-3 pt-10',
        screenMounted ? 'z-40' : 'z-10',
        // `arrive` animates `transform`, and a transformed ancestor would
        // become the containing block of the fixed phone screen.
        arrive && !screenMounted && 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
      )}
      style={screenMounted ? { minHeight: 'var(--v2-case-dock-h, auto)' } : undefined}
    >
      {/* The gradient dissolve — PERMANENT, whether the pill rests alone or
          the panel is up, so the bottom strip never flashes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background from-35% via-background/80 to-transparent"
      />

      {screenMounted ? (
        <span role="status" className="sr-only">
          {panelOpen ? 'Chat about this case opened' : 'Chat about this case closed'}
        </span>
      ) : null}

      <div
        ref={cardRef}
        tabIndex={-1}
        role={screenMounted ? 'dialog' : panelMounted ? 'complementary' : undefined}
        aria-modal={screenMounted ? true : undefined}
        aria-label={panelMounted ? 'Chat about this case' : undefined}
        data-state={screenMounted ? (panelOpen ? 'open' : 'closed') : undefined}
        onKeyDown={
          screenMounted
            ? (event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  onClose();
                }
              }
            : undefined
        }
        className={cn(
          'outline-none',
          screenMounted
            ? // The phone screen: the visible viewport, edge to edge, and
              // opaque from its first frame. A colour that faded in let the
              // page show through the opening card, which read as a card part
              // way open over the judgment. The status bar's inset pads the
              // bar, not the card, so the card's colour reaches the top edge.
              cn(
                'fixed inset-x-0 z-40 flex flex-col bg-popover pt-[env(safe-area-inset-top,0px)]',
                // Closing, the whole card fades out once, colour and all, and
                // takes no tap on the way; its last frame is held until it
                // leaves the screen (CaseScreen's holdover, a shade past
                // 200ms). Reduced motion: it is gone at once.
                'data-[state=closed]:pointer-events-none data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out data-[state=closed]:motion-safe:duration-200 data-[state=closed]:fill-mode-forwards data-[state=closed]:motion-reduce:invisible',
              )
            : cn(
                'mx-auto w-full max-w-[26rem] rounded-2xl border transition-[background-color,box-shadow,border-color] duration-300 motion-reduce:transition-none',
                panelMounted
                  ? 'border-border bg-popover shadow-[0_28px_70px_-28px_rgba(0,0,0,0.75)]'
                  : 'border-transparent',
              ),
        )}
        style={
          screenMounted
            ? {
                // The visible rectangle, by definition: when iOS pans the
                // page to reveal the box, `--visual-top` follows the pan, so
                // the card never hangs above the screen; with the keyboard
                // down it is 0, so the card's own bar is the top of the
                // screen (use-keyboard-inset). While it fades out, the size
                // it had at the close (the close effect).
                top: 'var(--v2-case-chat-closing-top, var(--visual-top, 0px))',
                height: 'var(--v2-case-chat-closing-height, var(--visual-height, 100dvh))',
              }
            : undefined
        }
      >
        {/* The panel slot — `null` keeps the composer's tree position stable
            so opening never remounts it. */}
        {screenMounted ? (
          // Opening, the bar and middle fade in on the opaque card; closing,
          // the card fades as a whole, so this slot has no exit of its own.
          <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <CaseChatBar
              view={view}
              onBack={() => onOpenChat('new')}
              onClose={onClose}
              tall
              screen
            />
            <CaseChatMiddle
              view={view}
              slug={slug}
              signedIn={signedIn}
              viewerId={viewerId}
              onOpenChat={onOpenChat}
              onClose={onClose}
              onStage={(text) => stageRef.current?.stage(text)}
            />
          </div>
        ) : panelMounted ? (
          // Grid-rows 0fr⇄1fr is the both-ways grow/collapse; the inner row
          // clips.
          <div
            data-open={panelOpen}
            className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[open=true]:grid-rows-[1fr] motion-reduce:transition-none"
          >
            <div className="min-h-0 overflow-hidden">
              {/* ONE height for both open states — the middle swap moves
                  nothing. */}
              <div className="flex h-[min(30rem,calc(100dvh-14rem))] flex-col">
                <CaseChatBar
                  view={view}
                  onBack={() => onOpenChat('new')}
                  onClose={onClose}
                  presentationAction={
                    <button
                      type="button"
                      onClick={onDock}
                      aria-label="Dock the chat to the side"
                      title="Dock to the side"
                      className={cn(
                        'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                        FOCUS_RING,
                      )}
                    >
                      <PanelRight aria-hidden className="size-4" />
                    </button>
                  }
                />
                <CaseChatMiddle
                  view={view}
                  slug={slug}
                  signedIn={signedIn}
                  viewerId={viewerId}
                  onOpenChat={onOpenChat}
                  onClose={onClose}
                  onStage={(text) => stageRef.current?.stage(text)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* THE composer — permanent in every state. Closed, the jurisdiction
            row folds away and only the pill shows over the page. On the phone
            the row is up for as long as the card covers the screen, so the
            close starts no fold inside the fading card, and it moves only
            inside that card: when the card leaves, the row is down at once,
            so the dock comes back with the row already collapsed. */}
        <CaseChatComposerDock
          view={view}
          slug={slug}
          signedIn={signedIn}
          start={start}
          showMeta={screen ? screenMounted : panelMounted && panelOpen}
          animateMeta={!screen || screenMounted}
          onEngage={onEngage}
          stageRef={stageRef}
        />
      </div>
    </div>
  );
}
