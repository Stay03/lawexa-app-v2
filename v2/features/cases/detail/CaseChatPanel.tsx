'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Maximize2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { ConversationScreen } from '@/v2/features/conversations/conversation/ConversationScreen';

/**
 * CaseChatSurface — the case page's side chat: the REAL conversation screen
 * (engine, privacy resolvers, streaming, composer — the whole thing) docked
 * BESIDE the judgment, so reading and asking are one activity.
 *
 * v1 shipped this idea as a second ~800-line chat engine inside a slide-out
 * sheet, and the two engines drifted. v2 mounts the one true screen in
 * embedded mode (`ConversationEmbed`): the shell header keeps the CASE's
 * title, the URL stays `/cases/{slug}?chat={id}` (pushed, so Back closes),
 * and expanding is a plain navigation to `/c/{id}` — the same conversation,
 * full width, because it IS the same conversation.
 *
 * ── ONE MOUNT ACROSS BREAKPOINTS ────────────────────────────────────────────
 * Desktop (≥xl — below that the sidebar + panel would squeeze the judgment
 * to ~350px) shows a side column; everything narrower gets a full overlay
 * under the header. They are ONE responsive element, never two: two would
 * mean two live controllers on one conversation (double streams). The
 * container is a fixed overlay by default and `xl:static` turns it into the
 * in-flow column; the
 * sticky inner box gives the screen its height (the shell header is h-14 =
 * 3.5rem, and the screen's own keyboard mechanics need only a shrinking box —
 * the overlay's bottom tracks `--keyboard-inset` for the browsers that write
 * it).
 *
 * ── PRESENCE ────────────────────────────────────────────────────────────────
 * The panel animates in AND out (standing motion-symmetry rule): the rendered
 * id outlives `chatId` by 200ms with `data-state="closed"` driving the exit
 * animation, then unmounts. The render-phase adopt of a NEW id is the
 * sanctioned adjust-during-render reset, same as `useUrlSearch`.
 */
export function CaseChatSurface({
  chatId,
  onClose,
}: {
  chatId: string | null;
  onClose: () => void;
}) {
  const [rendered, setRendered] = useState(chatId);
  if (chatId !== null && chatId !== rendered) setRendered(chatId);
  const closing = chatId === null && rendered !== null;

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setRendered(null), 200);
    return () => window.clearTimeout(timer);
  }, [closing]);

  if (rendered === null) return null;

  return (
    <aside
      aria-label="Chat about this case"
      data-state={closing ? 'closed' : 'open'}
      className={cn(
        // Mobile: a full overlay under the shell header, riding the keyboard
        // inset. Desktop: the in-flow right column beside the judgment.
        'fixed inset-x-0 top-14 z-40 bg-background',
        'xl:static xl:inset-auto xl:z-auto xl:w-[26rem] xl:shrink-0 xl:border-l xl:border-border/60',
        // Enter/exit: up from the bottom on mobile, in from the right on
        // desktop — and the mirror image out.
        'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
        'motion-safe:slide-in-from-bottom-8 xl:motion-safe:slide-in-from-bottom-0 xl:motion-safe:slide-in-from-right-8',
        'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out data-[state=closed]:motion-safe:duration-200',
        'data-[state=closed]:motion-safe:slide-out-to-bottom-8 xl:data-[state=closed]:motion-safe:slide-out-to-bottom-0 xl:data-[state=closed]:motion-safe:slide-out-to-right-8',
      )}
      style={{ bottom: 'var(--keyboard-inset, 0px)' }}
    >
      <div className="h-full xl:sticky xl:top-0 xl:h-[calc(100dvh-3.5rem)]">
        <div className="flex h-full min-h-0 flex-col">
          {/* ── The panel bar: close · label · expand. ── */}
          <div className="flex min-h-12 shrink-0 items-center gap-1 border-b border-border/60 px-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the chat"
              className={cn(
                'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                FOCUS_RING,
              )}
            >
              <X aria-hidden className="size-4" />
            </button>
            <p className="flex-1 truncate px-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Chat · this case
            </p>
            <Link
              href={`/c/${rendered}`}
              aria-label="Open this chat in full"
              title="Open in full"
              className={cn(
                'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                FOCUS_RING,
              )}
            >
              <Maximize2 aria-hidden className="size-4" />
            </Link>
          </div>

          {/* The real conversation screen, given a height-constrained box —
              its transcript scrolls internally, its composer floats at its
              own bottom edge. */}
          <div className="min-h-0 flex-1">
            <ConversationScreen
              conversationId={rendered}
              embed={{ onDeleted: onClose }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
