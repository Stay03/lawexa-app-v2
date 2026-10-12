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

/**
 * The shell's own bars, made inert and hidden while the phone chat covers the
 * screen, so Tab and a screen reader stay inside it and neither bar can paint
 * over it. The case page's own regions take `inert` as props in `CaseScreen`;
 * these sit outside it.
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
 *     and bring up the keyboard"). With the keyboard up the composer row also
 *     carries a close button, because the bar's X can be hidden then.
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

  // WHILE THE PHONE CHAT IS OPEN the shell's bars leave the tab order and the
  // accessibility tree (the page's own regions take `inert` in CaseScreen),
  // and they are not painted at all. With the keyboard up on Arthur's iPhone
  // the page's bar showed over the card's top band, hiding the chat's own bar
  // and its X, while the bar's back arrow, inert, did nothing (12 October
  // 2026). The card is a fixed box inside the shell's scroll region, so where
  // it paints against that bar rests on how WebKit layers those ancestors
  // while iOS moves fixed boxes for the keyboard, not on the card's z-index.
  // A bar that is `visibility: hidden` paints in no order at all. Layout is
  // untouched, so nothing under the card moves. A layout effect, so the bar
  // is gone in the card's first frame.
  //
  // THE BARS COME BACK ON EVERY WAY OUT. Every close (the bar's X, the
  // composer's X, Escape, Back) ends the open screen, and a route change or
  // an unmount ends this component: all of them run the cleanup. Leaving the
  // page (`pagehide`) gives them back too, so a page frozen in the
  // back-forward cache never holds hidden bars; if it comes back from that
  // cache (`pageshow`, persisted) with the chat still open, they hide again.
  // While hidden, `inert` keeps every control under them out of Tab's reach.
  useLayoutEffect(() => {
    if (!screenMounted) return;
    const chrome = SHELL_CHROME.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)),
    );
    const visibility = chrome.map((element) => element.style.visibility);
    const hide = (): void =>
      chrome.forEach((element) => {
        element.setAttribute('inert', '');
        element.style.visibility = 'hidden';
      });
    const restore = (): void =>
      chrome.forEach((element, index) => {
        element.removeAttribute('inert');
        element.style.visibility = visibility[index];
      });
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
  // moved it meanwhile.
  useEffect(() => {
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
  // the chat closes (either X, Escape, Back), and a focused box keeps the
  // keyboard up over a page with no chat on it. Focus moves to the card, one
  // Tab from the box; not back to the box itself, which would raise the
  // keyboard again.
  // `preventScroll` because a focus must never move the judgment.
  const screenOpen = screen && panelOpen;
  const wasScreenOpen = useRef(screenOpen);
  useEffect(() => {
    const closed = wasScreenOpen.current && !screenOpen;
    wasScreenOpen.current = screenOpen;
    if (!closed) return;
    const card = cardRef.current;
    const active = document.activeElement;
    if (card && active instanceof HTMLElement && card.contains(active)) {
      active.blur();
      card.focus({ preventScroll: true });
    }
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
              'fixed inset-x-0 z-40 flex flex-col bg-popover pt-[env(safe-area-inset-top,0px)]'
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
                // screen (use-keyboard-inset).
                top: 'var(--visual-top, 0px)',
                height: 'var(--visual-height, 100dvh)',
              }
            : undefined
        }
      >
        {/* The panel slot — `null` keeps the composer's tree position stable
            so opening never remounts it. */}
        {screenMounted ? (
          <div
            data-state={panelOpen ? 'open' : 'closed'}
            className={cn(
              'flex min-h-0 flex-1 flex-col',
              'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
              'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out data-[state=closed]:motion-safe:duration-200 data-[state=closed]:fill-mode-forwards data-[state=closed]:motion-reduce:invisible',
            )}
          >
            <CaseChatBar
              view={view}
              onBack={() => onOpenChat('new')}
              onClose={onClose}
              tall
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
            row folds away and only the pill shows over the page. */}
        <CaseChatComposerDock
          view={view}
          slug={slug}
          signedIn={signedIn}
          start={start}
          showMeta={panelMounted && panelOpen}
          onEngage={onEngage}
          onClose={screenMounted ? onClose : undefined}
          stageRef={stageRef}
        />
      </div>
    </div>
  );
}
