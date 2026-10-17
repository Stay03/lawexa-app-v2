'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import type { JurisdictionChoice } from '@/types/jurisdiction';
import { useV2Session } from '@/v2/runtime/session-context';
import { useMoveFirstPending } from '@/v2/shell/move-first';
import { conversationIdOf } from '../warm';
import { ConversationComposer, type ConversationComposerHandle } from './ConversationComposer';
import { earlyRuling } from './early-ruling';
import { subscribeFollowUpRefusals } from './embedded-composer';
import { readJurisdictionSlot, writeJurisdictionSlot } from './jurisdiction-slot';
import { subscribeRouteReplies, useRouteComposerSurface } from './route-composer';
import { ComposerSkeleton } from './skeletons';
import type { SendRefused } from './space-turn';
import { ViewOnlyPill } from './ViewOnlyPill';

/**
 * ChatDock — a chat's ONE message box, docked by the shell (message box B,
 * Stay, 17 October 2026: "the cleaner one"; Option 1, 13:39 UTC).
 *
 * ── WHY IT LIVES IN THE SHELL ──────────────────────────────────────────────
 * It renders in the AppShell's dock slot (app/v2/layout.tsx), beside the route's
 * content and not inside it. A tap on a chat paints the move-first frame, then
 * the route's loading screen, then the chat's screen, and each of those is
 * deleted by the next; this box is in none of them, so it is one element from
 * the tap's first frame until the reader leaves the chat. Text typed in the
 * frame stays typed, and the box keeps its focus.
 *
 * ── WHICH CHAT ─────────────────────────────────────────────────────────────
 * While a move-first tap is going to a chat, the tap's destination
 * (`useMoveFirstPending`; the pathname does not change until the screen
 * commits). Otherwise the chat route the reader is on. Anywhere else, nothing:
 * no box, no row, so no other page changes (the case page, whose side chat has
 * its own box, included). The box is keyed by the chat, so moving from one
 * chat to another starts a fresh box with that chat's draft.
 *
 * ── WHAT IT SHOWS, IN THE ORDER IT IS KNOWN ────────────────────────────────
 * The chat's screen publishes its controller's answers (`route-composer.ts`),
 * and once it has, they are the box's. Before that, what this device already
 * holds (`earlyRuling`: the cached record, else the row the chat was tapped
 * from) says whose chat it is and whether the reader may send, so the real box
 * is there in the tap's frame. Send waits (`holdSend`) until the screen is up
 * and the history has loaded: a turn started earlier would make the engine
 * decline the history that lands under it. With nothing known (a cold open from
 * a link), the box's skeleton, as before.
 *
 * ── WHERE IT SITS ──────────────────────────────────────────────────────────
 * Floating over the bottom of the content row, as the box always has: a
 * shell.css rule lifts the dock row onto the content row while it holds this
 * (`data-v2-chat-dock`). It stays a grid item and never `position: fixed`, so
 * the keyboard inset that shrinks the shell (use-keyboard-inset.ts) lifts it
 * exactly as it lifted the old absolute layer. Its height is measured into
 * `--v2-conv-dock-h` on the root element, which the transcript and the frames
 * pad their bottom with; written only when it changes.
 */
export function ChatDock() {
  const pending = useMoveFirstPending();
  const pathname = usePathname() ?? '';
  const conversationId = pending
    ? pending.kind === 'conversation'
      ? conversationIdOf(new URL(pending.href, 'http://x').pathname)
      : null
    : conversationIdOf(withoutV2Prefix(pathname));
  if (conversationId === null) return null;
  return <ChatDockBox key={conversationId} conversationId={conversationId} />;
}

/** The internal `/v2/...` form of an address reads as its public form. */
function withoutV2Prefix(pathname: string): string {
  return pathname.startsWith('/v2/') ? pathname.slice(3) : pathname;
}

/** The composer's height on the root element (see the docblock). */
const DOCK_HEIGHT_VAR = '--v2-conv-dock-h';

/** `useLayoutEffect` in the browser, `useEffect` on the server. */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function ChatDockBox({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const { userId } = useV2Session();
  const surface = useRouteComposerSurface(conversationId);
  // Read once for this chat: the dock is keyed by it, and the screen's own
  // answer replaces it as soon as the screen publishes.
  const [early] = useState(() => earlyRuling(queryClient, conversationId, userId));
  // The chip before the screen is up: the chat's slot, written on a change, so
  // the screen's controller opens with the reader's choice.
  const [localJurisdiction, setLocalJurisdiction] = useState<JurisdictionChoice>(() =>
    readJurisdictionSlot(conversationId),
  );
  const changeLocalJurisdiction = useCallback(
    (next: JurisdictionChoice) => {
      setLocalJurisdiction(next);
      writeJurisdictionSlot(conversationId, next);
    },
    [conversationId],
  );
  const composerRef = useRef<ConversationComposerHandle>(null);

  // A follow-up from a result card, refused by the server: its text back in
  // this box with the sentence (or only the sentence, for "Ask again").
  useEffect(
    () =>
      subscribeFollowUpRefusals(conversationId, (refusal) => {
        if (refusal.text === null) composerRef.current?.explain(refusal.sentence);
        else composerRef.current?.refuse(refusal.text, refusal.sentence);
      }),
    [conversationId],
  );
  // A message's Reply: the quote in this box, and the caret with it.
  useEffect(
    () => subscribeRouteReplies(conversationId, (target) => composerRef.current?.reply(target)),
    [conversationId],
  );

  const dockRef = useRef<HTMLDivElement>(null);
  useIsomorphicLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const root = document.documentElement;
    const sync = () => {
      // An empty dock (the skeleton hold) leaves the transcript its 7 rem
      // fallback rather than the sliver of its safe-area padding.
      if (dock.childElementCount === 0) {
        if (root.style.getPropertyValue(DOCK_HEIGHT_VAR) !== '') root.style.removeProperty(DOCK_HEIGHT_VAR);
        return;
      }
      const height = `${dock.offsetHeight}px`;
      if (root.style.getPropertyValue(DOCK_HEIGHT_VAR) !== height) root.style.setProperty(DOCK_HEIGHT_VAR, height);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);
  // No cleanup: the next chat's transcript renders with the height this box
  // last had (the box is almost always that height), so it is styled once,
  // not twice (the chat reopen fix, 16 October 2026). Pages that are not a
  // chat do not read the variable.

  if (surface?.terminal) return null;

  let content: React.ReactNode;
  if (surface) {
    content = !surface.isOwnerResolved ? (
      surface.holdingSkeleton ? null : <ComposerSkeleton />
    ) : surface.canSend ? (
      <ConversationComposer
        holdSend={surface.holdSend}
        draftScopeId={conversationId}
        stageRef={composerRef}
        jurisdiction={surface.jurisdiction}
        onJurisdictionChange={surface.setJurisdiction}
        isConfidential={surface.isConfidential}
        isRedacted={surface.isRedacted}
        showMeta={surface.showMeta}
        isStreaming={surface.isStreaming}
        isCancelling={surface.isCancelling}
        sendHeldBy={surface.sendHeldBy}
        canStop={surface.canStop}
        onSubmit={surface.submit}
        onStop={surface.stop}
        viewerId={userId}
        mentionOptions={surface.mentionOptions}
        quoteToneOf={surface.quoteToneOf}
        spaceUuid={surface.spaceUuid}
      />
    ) : (
      <ViewOnlyPill reason={surface.viewOnlyReason} />
    );
  } else if (early) {
    content = early.canSend ? (
      // Before the screen: the same box, typeable, Send held. Nothing here can
      // send, so the handlers are inert until the screen's take over.
      <ConversationComposer
        holdSend
        draftScopeId={conversationId}
        stageRef={composerRef}
        jurisdiction={localJurisdiction}
        onJurisdictionChange={changeLocalJurisdiction}
        isConfidential={early.isConfidential}
        isRedacted={false}
        isStreaming={false}
        isCancelling={false}
        onSubmit={inertSubmit}
        onStop={inertStop}
        viewerId={userId}
        spaceUuid={early.spaceUuid}
      />
    ) : (
      <ViewOnlyPill reason={early.viewOnlyReason} />
    );
  } else {
    content = <ComposerSkeleton />;
  }

  return (
    <div
      data-v2-chat-dock=""
      // What the box is drawing from, for the journey checks (and a reader of
      // the DOM): the screen's surface, the early ruling, or nothing yet.
      data-source={surface ? 'screen' : early ? 'early' : 'cold'}
      data-hold-send={surface ? String(surface.holdSend) : early ? 'true' : undefined}
      data-streaming={surface ? String(surface.isStreaming) : undefined}
      className="pointer-events-none"
    >
      <div ref={dockRef} className="pointer-events-auto v2-safe-bottom mx-auto w-full max-w-xs sm:max-w-md">
        {content}
      </div>
    </div>
  );
}

/** The box's send and stop before the screen is up: never called, as Send is
 *  held and nothing is streaming. */
async function inertSubmit(): Promise<SendRefused | undefined> {
  return undefined;
}

function inertStop(): void {}
