'use client';

import Link from 'next/link';
import { ArrowLeft, Maximize2, PanelRightClose, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { ConversationScreen } from '@/v2/features/conversations/conversation/ConversationScreen';
import {
  CaseChatNewContent,
  CaseComposer,
  CaseComposerMeta,
  type CaseComposerState,
} from './CaseAsk';

/**
 * The case page's chat, in its three presentations — one shared body
 * (`CaseChatBody`), one mounted at a time (two would mean two live
 * controllers on one conversation):
 *
 *   SHEET     below xl. A bottom sheet at ~65% of the viewport over a scrim —
 *             the judgment stays visible, dimmed, behind it (owner, July 30:
 *             "just like 60% and some of the page show"), and tapping the
 *             scrim closes. Rides `--keyboard-inset`.
 *   DOCKED    ≥xl after the reader chooses the sidebar. The in-flow 26rem
 *             column with the clipped width reveal; the bar's icon floats it
 *             back. The choice persists (localStorage) so the chat reopens
 *             the way this reader likes it.
 *
 * The xl-floating presentation is NOT here: it is `CaseAskDock`'s one card —
 * closed pill, new-chat panel, and embedded conversation are three states of
 * the same element (the owner's "one complete unit").
 *
 * Every presentation is an ELEVATED LAYER, visibly apart from the page:
 * `bg-popover` (a step lighter than the page in dark mode), a border, and a
 * directional shadow — the demarcation the owner asked for.
 *
 * ── EXIT ANIMATIONS MUST HOLD THROUGH THE UNMOUNT GAP ──────────────────────
 * The host unmounts each surface ~40ms AFTER its 200ms exit animation ends.
 * When an animation ends without a fill, the element snaps back to committed
 * style — FULLY VISIBLE — for that gap (the owner's "closes, pops open,
 * closes again"; ~one frame on a fast machine, ~100ms on a busy one).
 * `[animation-fill-mode:forwards]` CANNOT fix this: `animate-out` is the
 * `animation:` SHORTHAND ending in `var(--tw-animation-fill-mode, none)`,
 * same specificity, later in the stylesheet — the shorthand resets the
 * longhand. `fill-mode-forwards` (tw-animate-css) is the working mechanism:
 * it sets the VARIABLE the shorthand reads, so the hold is part of the
 * animation itself. `motion-reduce:hidden` covers the no-animation path,
 * where the closed surface would otherwise sit fully visible until unmount.
 *
 * URL semantics are the host's (`CaseScreen`): `?chat={id}` / `?chat=new`,
 * pushed once so Back closes, in-panel hops replacing.
 */

interface CaseChatCommonProps {
  chatId: string;
  closing: boolean;
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  /** The page's ONE composer state, lifted to `CaseBody` — the new-chat view
   * renders the same `CaseComposer` the dock does, on the same draft. */
  composer: CaseComposerState;
  onClose: () => void;
  onSwitchChat: (chatId: string) => void;
}

/* ── Sheet (below xl) ────────────────────────────────────────────────────── */

export function CaseChatSheet(props: CaseChatCommonProps) {
  const state = props.closing ? 'closed' : 'open';
  return (
    <>
      {/* The scrim — the page stays visible behind the sheet, dimmed. A tap
          on it closes, the standard sheet contract. */}
      <div
        aria-hidden
        data-state={state}
        onClick={props.onClose}
        className={cn(
          'fixed inset-0 z-30 bg-black/50',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out data-[state=closed]:motion-safe:duration-200 data-[state=closed]:fill-mode-forwards data-[state=closed]:motion-reduce:hidden',
        )}
      />
      <aside
        aria-label="Chat about this case"
        data-state={state}
        className={cn(
          'fixed inset-x-0 z-40 flex h-[65dvh] min-h-80 flex-col overflow-hidden rounded-t-2xl border-t border-border/60 bg-popover shadow-[0_-24px_60px_-24px_rgba(0,0,0,0.65)]',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom-full motion-safe:duration-300',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:slide-out-to-bottom-full data-[state=closed]:motion-safe:duration-200 data-[state=closed]:fill-mode-forwards data-[state=closed]:motion-reduce:hidden',
        )}
        style={{ bottom: 'var(--keyboard-inset, 0px)' }}
      >
        <CaseChatBody {...props} mode="sheet" />
      </aside>
    </>
  );
}

/* ── Docked column (≥xl, by choice) ──────────────────────────────────────── */

export function CaseChatDocked({
  onFloat,
  ...props
}: CaseChatCommonProps & { onFloat: () => void }) {
  return (
    <aside
      aria-label="Chat about this case"
      data-state={props.closing ? 'closed' : 'open'}
      className={cn(
        'w-[26rem] shrink-0 overflow-x-clip border-l border-border/60 bg-popover shadow-[-24px_0_50px_-30px_rgba(0,0,0,0.55)]',
        // The clipped width reveal — no translate past the viewport edge, so
        // no horizontal scrollbar; the reading column re-centres continuously.
        // The close shorthand carries its own `forwards`; `motion-reduce`
        // still needs the instant hide for the no-animation hold gap.
        'motion-safe:animate-[v2-case-chat-open_280ms_cubic-bezier(0.32,0.72,0,1)]',
        'data-[state=closed]:motion-safe:animate-[v2-case-chat-close_200ms_ease-in_forwards] data-[state=closed]:motion-reduce:hidden',
      )}
    >
      <div className="sticky top-0 flex h-[calc(100dvh-3.5rem)] w-[26rem] flex-col">
        <CaseChatBody {...props} mode="docked" onFloat={onFloat} />
      </div>
    </aside>
  );
}

/* ── The shared body: bar + views ────────────────────────────────────────── */

const BAR_BUTTON =
  'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground';

function CaseChatBody({
  chatId,
  slug,
  signedIn,
  viewerId,
  composer,
  onClose,
  onSwitchChat,
  mode,
  onFloat,
}: CaseChatCommonProps & {
  mode: 'sheet' | 'docked';
  onFloat?: () => void;
}) {
  const isNew = chatId === 'new';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── The bar: back · label · dock-toggle · expand · close. ── */}
      <div className="flex min-h-12 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        {isNew ? (
          <span aria-hidden className="size-8" />
        ) : (
          <button
            type="button"
            onClick={() => onSwitchChat('new')}
            aria-label="Back to your chats about this case"
            className={cn(BAR_BUTTON, FOCUS_RING)}
          >
            <ArrowLeft aria-hidden className="size-4" />
          </button>
        )}
        <p className="flex-1 truncate px-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Chat · this case
        </p>
        {mode === 'docked' && onFloat ? (
          <button
            type="button"
            onClick={onFloat}
            aria-label="Float the chat over the page"
            title="Float over the page"
            className={cn(BAR_BUTTON, FOCUS_RING)}
          >
            <PanelRightClose aria-hidden className="size-4" />
          </button>
        ) : null}
        {!isNew ? (
          <Link
            href={`/c/${chatId}`}
            aria-label="Open this chat in full"
            title="Open in full"
            className={cn(BAR_BUTTON, FOCUS_RING)}
          >
            <Maximize2 aria-hidden className="size-4" />
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the chat"
          className={cn(BAR_BUTTON, FOCUS_RING)}
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {/* Keyed by view so list ⇄ conversation swaps ease in rather than
          snapping. */}
      <div
        key={isNew ? 'new' : chatId}
        className="min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        {isNew ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              <CaseChatNewContent
                slug={slug}
                signedIn={signedIn}
                viewerId={viewerId}
                onOpenChat={onSwitchChat}
                composer={composer}
              />
            </div>
            {/* ── THE composer, pinned to the surface's bottom — the same
                component, the same shared draft, and the same wrapper metrics
                (`px-4 pb-3 pt-2` = ConversationComposer's) as everywhere. ── */}
            <div className="shrink-0 px-4 pb-3 pt-2">
              <CaseComposerMeta composer={composer} signedIn={signedIn} />
              <CaseComposer composer={composer} autoFocus />
            </div>
          </div>
        ) : (
          <ConversationScreen conversationId={chatId} embed={{ onDeleted: onClose }} />
        )}
      </div>
    </div>
  );
}
