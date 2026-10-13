'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Maximize2, MessageSquare, X } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { Skeleton } from '@/components/ui/skeleton';
import type { MessageAttachment } from '@/types/chat';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { ViewOnlyPill } from '@/v2/features/conversations/conversation/ViewOnlyPill';
import {
  ConversationComposer,
  type ConversationComposerHandle,
} from '@/v2/features/conversations/conversation/ConversationComposer';
import {
  subscribeFollowUpRefusals,
  useEmbeddedComposerSurface,
} from '@/v2/features/conversations/conversation/embedded-composer';
import { RouteSkeletonMark } from '@/v2/features/conversations/conversation/route-skeleton-mark';
import { TranscriptSkeleton } from '@/v2/features/conversations/conversation/skeletons';
import { casesQueries } from '../queries';

/**
 * CaseChatCore — the case chat's ONE SCREEN (owner, July 31: "everything on the
 * first screen — when I click a conversation it still loads on that screen, the
 * same text area, not something different").
 *
 * The screen is one fixed frame in every presentation (floating card, mobile
 * sheet, docked column):
 *
 *      bar        — back? · label · presentation toggle · expand? · close
 *      MIDDLE     — the ONLY part that changes: the new-chat content
 *                   (recents + openers) ⇄ the conversation transcript
 *      composer   — ONE `ConversationComposer` element, permanent
 *
 * Opening a conversation swaps the middle and NOTHING else: the bar keeps its
 * bones, the composer keeps its element (focus, caret, draft, staged files all
 * survive), and the same pill that starts a chat sends the follow-ups.
 *
 * HOW ONE COMPOSER SERVES TWO WORLDS. In the list state it submits through
 * {@link useStartCaseChat} (create + handoff). With a conversation open, the
 * embedded `ConversationScreen` (composer: 'external') publishes its live
 * surface — submit/stop/streaming/jurisdiction — through the embedded-composer
 * store, and {@link CaseChatComposerDock} rewires the SAME element to it. The
 * brief gap between "conversation open" and "surface published" reads as
 * disabled, so a send can never fall into the void or create a duplicate.
 *
 * The three presentations arrange these pieces but never reimplement them; the
 * only geometry a presentation owns is its own frame (the card's grow/collapse,
 * the sheet's rise, the column's width reveal).
 *
 * WHAT LOADS WITH THE CASE, AND WHAT WAITS FOR THE CHAT. The case page loads
 * the bar, the new-chat content and THE composer with the judgment; the
 * transcript (`ConversationScreen`, with the message list, its renderers and
 * the streaming engine behind it) and the create flow (`startConversation`)
 * load when the chat opens. The composer must stay in the first part: on a
 * phone, WebKit raises the keyboard only for a focus inside the reader's tap,
 * and the full-screen chat grows around the very box they tapped
 * (`CaseAskDock`). A composer behind a lazy boundary would not exist yet when
 * the tap lands. What is lazy here sits only in the middle, above it.
 */

/** The transcript and the create flow — the chat's heavy half. */
const loadConversationScreen = () =>
  import('@/v2/features/conversations/conversation/ConversationScreen');
const loadStartConversation = () =>
  import('@/v2/features/conversations/start-conversation');

/**
 * Starts fetching the chat's heavy half. {@link CaseChatMiddle} calls it as it
 * mounts, which is the moment the chat opens, so by the time the reader picks
 * a thread or sends a first message the code is usually already here.
 */
function preloadCaseChat() {
  void loadConversationScreen();
  void loadStartConversation();
}

/**
 * The embedded transcript while its code is still on the way (a direct
 * `?chat={id}` link, or a pick faster than the preload). It is the screen's own
 * transcript skeleton in the screen's own embedded geometry (`pt-6`, and the
 * `1rem` bottom gap over an external composer's `0px` dock height), and it
 * carries `RouteSkeletonMark`, so the screen that replaces it shows its own
 * identical skeleton at once instead of holding a blank first
 * (route-skeleton-state.ts).
 */
function CaseChatTranscriptFallback() {
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <RouteSkeletonMark />
      <span role="status" className="sr-only">
        Loading this conversation
      </span>
      <div aria-hidden inert className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-4 pt-6">
          <TranscriptSkeleton />
        </div>
      </div>
    </div>
  );
}

// Client only: the chat never renders on the server (which presentation owns
// it is decided by a viewport breakpoint the server cannot know).
const ConversationScreen = dynamic(
  () => loadConversationScreen().then((module) => module.ConversationScreen),
  { ssr: false, loading: CaseChatTranscriptFallback },
);

export const CASE_PROMPTS = [
  'Explain this case in plain language',
  'What is the ratio decidendi?',
  'How has this case been treated since?',
] as const;

/** The lifted create-state bundle — ONE instance lives in `CaseScreen`, shared
 *  by every presentation, so a double submit is impossible across surfaces. */
export interface CaseChatStart {
  /** The list state's jurisdiction choice (a conversation carries its own). */
  jurisdiction: JurisdictionChoice;
  onJurisdictionChange: (next: JurisdictionChoice) => void;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
  /** Create the conversation (message + staged attachments) and open it. */
  start: (message: string, attachments: MessageAttachment[]) => Promise<boolean>;
}

/**
 * The one way a case chat starts: message + attachments in, conversation out,
 * with the "your chats about this case" query refreshed.
 */
export function useStartCaseChat(
  slug: string,
  signedIn: boolean,
  onOpened: (conversationId: string) => void,
  jurisdiction: JurisdictionChoice,
): Omit<CaseChatStart, 'jurisdiction' | 'onJurisdictionChange'> {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (message: string, attachments: MessageAttachment[]) => {
    const trimmed = message.trim();
    if ((!trimmed && attachments.length === 0) || isSubmitting) return false;
    if (!signedIn) {
      router.push('/login');
      return false;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const { startConversation } = await loadStartConversation();
      const result = await startConversation(
        {
          message,
          attachments,
          jurisdiction,
          references: [{ type: 'case', id: slug }],
        },
        { queryClient },
      );
      // Refresh "your chats about this case" so the new thread is listed the
      // next time the new-chat view opens.
      void queryClient.invalidateQueries({
        queryKey: [...casesQueries.all, 'conversations', slug],
      });
      // The embedded controller consumes the `conv_init` handoff
      // `startConversation` just wrote, so the stream attaches in the middle.
      onOpened(result.conversationId);
      return true;
    } catch (err) {
      setError(extractApiError(err).message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { start, isSubmitting, error, clearError: () => setError(null) };
}

/* ── The bar ─────────────────────────────────────────────────────────────── */

const BAR_BUTTON =
  'v2-interactive flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground';

/**
 * The one bar every presentation renders: back (conversation only) · label ·
 * the presentation's own toggle (dock/float) · open-in-full (conversation
 * only) · close. The bones never change between the two middle states.
 */
export function CaseChatBar({
  view,
  onBack,
  onClose,
  presentationAction,
  tall = false,
  screen = false,
}: {
  /** `'new'` or a conversation id — the bar is only rendered while open. */
  view: string;
  onBack: () => void;
  onClose: () => void;
  /** The presentation's own toggle (dock-to-side / float-over-page), if any. */
  presentationAction?: React.ReactNode;
  /** Phone full screen/docked use the roomier min-h-12 bar; the floating card min-h-10. */
  tall?: boolean;
  /**
   * The phone's full screen: every control is a 44 px target (size-11), the
   * size a finger needs, inside the 48 px bar. Elsewhere a pointer's 32 px.
   */
  screen?: boolean;
}) {
  const isConversation = view !== 'new';
  const target = screen ? 'size-11' : 'size-8';
  const button = cn(BAR_BUTTON, target, FOCUS_RING);
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 border-b border-border/60',
        tall ? 'min-h-12 px-2' : 'min-h-10 px-1.5',
      )}
    >
      {isConversation ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to your chats about this case"
          className={button}
        >
          <ArrowLeft aria-hidden className="size-4" />
        </button>
      ) : (
        <span aria-hidden className={target} />
      )}
      <p className="flex-1 truncate px-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        Chat · this case
      </p>
      {presentationAction}
      {isConversation ? (
        <Link
          href={`/c/${view}`}
          aria-label="Open this chat in full"
          title="Open in full"
          className={button}
        >
          <Maximize2 aria-hidden className="size-4" />
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the chat"
        className={button}
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/* ── The middle — the only part that changes ─────────────────────────────── */

/**
 * The swap region: the new-chat content or the embedded transcript, keyed so
 * the change eases in rather than snapping. Everything around it stays put.
 */
export function CaseChatMiddle({
  view,
  slug,
  signedIn,
  viewerId,
  onOpenChat,
  onClose,
  onStage,
}: {
  view: string;
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  onOpenChat: (conversationId: string) => void;
  onClose: () => void;
  /** Fill the one composer's draft (the "Start with" chips). */
  onStage: (text: string) => void;
}) {
  const isConversation = view !== 'new';
  // The middle mounts when the chat opens: fetch the transcript's code now.
  useEffect(() => {
    preloadCaseChat();
  }, []);
  return (
    <div
      key={isConversation ? view : 'new'}
      className="min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      {isConversation ? (
        <ConversationScreen
          conversationId={view}
          embed={{ onDeleted: onClose, composer: 'external' }}
        />
      ) : (
        <div className="v2-quiet-scroll h-full min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
          <CaseChatNewContent
            slug={slug}
            signedIn={signedIn}
            viewerId={viewerId}
            onOpenChat={onOpenChat}
            onStage={onStage}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The new-chat view's content — recents and openers. The openers stage text
 * into the one composer; they never own an input of their own.
 */
export function CaseChatNewContent({
  slug,
  signedIn,
  viewerId,
  onOpenChat,
  onStage,
}: {
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  onOpenChat: (conversationId: string) => void;
  onStage: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {signedIn ? (
        <RecentCaseChats
          slug={slug}
          viewerId={viewerId}
          onOpenChat={onOpenChat}
          limit={5}
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Start with
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {CASE_PROMPTS.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                onClick={() => onStage(prompt)}
                className={cn(
                  'v2-interactive inline-flex min-h-8 items-center rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The reader's recent threads about this case. Owner-scoped on the server and
 * viewer-partitioned in the cache; renders nothing when there are none and
 * fails quiet — the threads are still reachable from /conversations. Rows
 * open in the chat surface (buttons, not links): resuming a thread about the
 * case keeps the case.
 */
export function RecentCaseChats({
  slug,
  viewerId,
  onOpenChat,
  limit = 3,
}: {
  slug: string;
  viewerId: number | null;
  onOpenChat: (conversationId: string) => void;
  limit?: number;
}) {
  const query = useQuery(casesQueries.conversations(slug, { viewerId }));
  const [now] = useState(() => Date.now());
  const rows = (query.data?.data ?? []).slice(0, limit);

  if (query.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    );
  }
  if (query.isError || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        Pick up where you left off
      </p>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpenChat(row.id)}
              className={cn(
                'v2-interactive flex w-full min-h-9 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-secondary/60',
                FOCUS_RING,
              )}
            >
              <MessageSquare
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/70"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {stripPastedTags(row.title) || 'Untitled conversation'}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
                {formatRelativeTime(row.updated_at, now)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── The composer dock — ONE element, two wirings ────────────────────────── */

/**
 * The bottom of the one screen: the create-error strip, the view-only strip
 * (a shared conversation someone linked), and THE composer. The composer
 * element is permanent — the dock only rewires its props:
 *
 *   list state          → submit creates (via the lifted {@link CaseChatStart});
 *   conversation state  → submit/stop/streaming come from the embedded
 *                         surface the transcript publishes; until it arrives
 *                         (one effect tick) the pill is disabled, never wrong.
 */
export function CaseChatComposerDock({
  view,
  slug,
  signedIn,
  start,
  showMeta = true,
  animateMeta = true,
  onEngage,
  stageRef,
}: {
  /** null = the closed dock pill; `'new'` = list state; else a conversation id. */
  view: string | null;
  slug: string;
  signedIn: boolean;
  start: CaseChatStart;
  /** False collapses the jurisdiction row — the closed resting pill. */
  showMeta?: boolean;
  /** False changes that row at once, with no fold — the phone card leaving
   *  the screen (see `CaseAskDock`). */
  animateMeta?: boolean;
  /** Closed-pill interactions open the panel (the floating card's dock). */
  onEngage?: () => void;
  /** OBJECT ref (not a callback): the dock reads it back to restore a failed
   *  create's message into the draft — the composer clears optimistically. */
  stageRef?: React.RefObject<ConversationComposerHandle | null>;
}) {
  const conversationId = view !== null && view !== 'new' ? view : null;
  const surface = useEmbeddedComposerSurface(conversationId);
  // A conversation is open but its transcript hasn't published yet (one effect
  // tick, or a cold load) — sending now could only misfire, so the pill waits.
  const conversationPending = conversationId !== null && surface === null;
  const viewOnly = surface !== null && surface.isOwnerResolved && !surface.canSend;

  const createError = view === 'new' && start.error ? start.error : null;

  // A result card's follow-up the server refused (Spaces F4) comes back to this
  // dock's composer with its sentence, as a refused send typed here does; a
  // refused "Ask again" shows the sentence alone. A
  // subscription in an effect; the handle writes the composer's own state.
  useEffect(() => {
    if (conversationId === null || !stageRef) return;
    return subscribeFollowUpRefusals(conversationId, ({ text, sentence }) => {
      if (text === null) stageRef.current?.explain(sentence);
      else stageRef.current?.refuse(text, sentence);
    });
  }, [conversationId, stageRef]);

  return (
    <div className="shrink-0">
      {/* Create-failure strip — list state only (a conversation reports errors
          in its own transcript). Persistent-collapse so it animates both ways. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          createError ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          {createError ? (
            <div
              role="alert"
              className="mx-4 mb-1 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {createError}
            </div>
          ) : null}
        </div>
      </div>

      {/* View-only strip — the reader may not send in the open conversation
          (a shared link, or a space they only view). The composer collapses
          but STAYS MOUNTED, so returning to the list restores the same
          element; both swap with the same collapse. */}
      <div
        aria-hidden={!viewOnly}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          viewOnly ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ViewOnlyPill reason={surface?.viewOnlyReason ?? 'shared'} />
        </div>
      </div>
      <div
        inert={viewOnly}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          viewOnly ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ConversationComposer
            draftScopeId={`case:${slug}`}
            placeholder="Ask about this case"
            signedIn={signedIn}
            showMeta={showMeta}
            animateMeta={animateMeta}
            onEngage={onEngage}
            stageRef={stageRef}
            disabled={conversationPending}
            jurisdiction={surface ? surface.jurisdiction : start.jurisdiction}
            onJurisdictionChange={
              surface ? surface.setJurisdiction : start.onJurisdictionChange
            }
            isConfidential={surface ? surface.isConfidential : false}
            isRedacted={surface ? surface.isRedacted : false}
            isStreaming={surface ? surface.isStreaming : false}
            isCancelling={surface ? surface.isCancelling : false}
            // A case chat in a space: a colleague's turn holds Send and offers
            // no Stop, as on the chat's own screen (Spaces F4).
            sendHeldBy={surface ? surface.sendHeldBy : null}
            canStop={surface ? surface.canStop : true}
            onSubmit={async (message, attachments) => {
              // A refused send comes back to the composer, which gives the
              // message back and says why.
              if (surface) return surface.submit(message, attachments);
              const ok = await start.start(message, attachments);
              // The composer clears its draft optimistically; a failed create
              // hands the text back for the retry. Attachments are the one
              // loss (already uploaded, but their tray entries are gone) —
              // re-attach on retry.
              if (!ok) stageRef?.current?.stage(message);
            }}
            onStop={() => surface?.stop()}
          />
        </div>
      </div>
    </div>
  );
}
