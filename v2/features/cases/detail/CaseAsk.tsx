'use client';

import { useRef } from 'react';
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
 * CaseAskDock — the FLOATING presentation of the case chat's one screen
 * (`CaseChatCore`): closed pill, new-chat view, and open conversation are
 * three states of the SAME card, and the middle is the only part that ever
 * changes (owner, July 31 — "one complete unit", then "everything on the
 * first screen, the same text area").
 *
 * GEOMETRY. One container (`max-w-[26rem]`, the docked column's width), one
 * composer element with one set of gutters, and ONE panel height for both
 * open states — list ⇄ conversation moves NOTHING, so there is no height
 * choreography left to break. The only motion this shell owns:
 *
 *   closed ⇄ open   — the panel (bar + middle) grid-grows above the composer
 *                     while the chrome fades in around both, and the
 *                     jurisdiction row unfolds inside the composer dock;
 *   list ⇄ thread   — `CaseChatMiddle`'s keyed fade, inside the fixed frame.
 *
 * The composer element is never remounted by any of it: the panel slot
 * renders `null` when closed, keeping the dock's tree position — and
 * therefore focus, caret, draft, and staged files — stable.
 */
export function CaseAskDock({
  slug,
  signedIn,
  viewerId,
  start,
  view,
  panelOpen,
  onEngage,
  onClose,
  onDock,
  onOpenChat,
}: {
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  start: CaseChatStart;
  /** What the panel shows: nothing (closed), the new-chat view, or a
   * conversation id — the HOLDOVER value, so exits can animate. */
  view: string | null;
  /** The panel is expanded (false while collapsing toward unmount). */
  panelOpen: boolean;
  /** Open the chat for this width (sheet below xl, panel at xl). */
  onEngage: () => void;
  onClose: () => void;
  onDock: () => void;
  onOpenChat: (conversationId: string) => void;
}) {
  const panelMounted = view !== null;
  const stageRef = useRef<ConversationComposerHandle | null>(null);

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-3 pt-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {/* The gradient dissolve — PERMANENT, whether the pill rests alone or
          the panel is up, so the bottom strip never flashes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background from-35% via-background/80 to-transparent"
      />

      <div
        role={panelMounted ? 'complementary' : undefined}
        aria-label={panelMounted ? 'Chat about this case' : undefined}
        className={cn(
          'mx-auto w-full max-w-[26rem] rounded-2xl border',
          'transition-[background-color,box-shadow,border-color] duration-300 motion-reduce:transition-none',
          panelMounted
            ? 'border-border bg-popover shadow-[0_28px_70px_-28px_rgba(0,0,0,0.75)]'
            : 'border-transparent',
        )}
      >
        {/* The panel slot — `null` keeps the composer's tree position stable
            so opening never remounts it. Grid-rows 0fr⇄1fr is the both-ways
            grow/collapse; the inner row clips. */}
        {panelMounted ? (
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
