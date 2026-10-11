'use client';

import { useEffect, useRef } from 'react';
import { PanelRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { ConversationComposerHandle } from '@/v2/features/conversations/conversation/ConversationComposer';
import {
  CaseChatBar,
  CaseChatComposerDock,
  CaseChatMiddle,
  type CaseChatStart,
} from './CaseChatCore';

/**
 * The shell's own bars, made inert while the phone chat covers the screen so
 * Tab and a screen reader stay inside it. The case page's own regions take
 * `inert` as props in `CaseScreen`; these sit outside it.
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
 *     and bring up the keyboard").
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
  // accessibility tree (the page's own regions take `inert` in CaseScreen).
  useEffect(() => {
    if (!screenMounted) return;
    const chrome = SHELL_CHROME.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)),
    );
    chrome.forEach((element) => element.setAttribute('inert', ''));
    return () => chrome.forEach((element) => element.removeAttribute('inert'));
  }, [screenMounted]);

  // CLOSING ON A PHONE puts the keyboard away. The box still has focus when
  // the chat closes (X, Escape, Back), and a focused box keeps the keyboard up
  // over a page with no chat on it. Focus moves to the card, one Tab from the
  // box; not back to the box itself, which would raise the keyboard again.
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
        'sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-3 pt-10',
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
          'outline-none transition-[background-color,box-shadow,border-color] duration-300 motion-reduce:transition-none',
          screenMounted
            ? // The phone screen: the visible viewport, edge to edge. The
              // status bar's inset pads the bar, not the card, so the card's
              // colour reaches the top edge.
              'fixed inset-x-0 z-40 flex flex-col bg-popover pt-[env(safe-area-inset-top,0px)]'
            : cn(
                'mx-auto w-full max-w-[26rem] rounded-2xl border',
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
                // the card never hangs above the screen (use-keyboard-inset).
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
          stageRef={stageRef}
        />
      </div>
    </div>
  );
}
