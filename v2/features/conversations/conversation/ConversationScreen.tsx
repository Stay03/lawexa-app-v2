'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Eye, ShieldCheck } from 'lucide-react';
import { useConversationController } from './useConversationController';
import { MessageList } from './MessageList';
import { ConversationComposer, ComposerSkeleton } from './ConversationComposer';
import { ConfidentialBanner } from './ConfidentialBanner';
import { V2ChatProvider } from './chat-context';

/**
 * ConversationScreen — the v2 `/c/[id]` client root. Mounts the controller (engine
 * + privacy resolvers + handoff/recovery), renders the transcript in the shell's
 * content region, and floats the composer OVER the transcript. Carries the
 * server-renderable `data-v2-marker="V2-CONVERSATION"`.
 *
 * FLOATING COMPOSER — IN THE CONTENT REGION, NOT THE DOCK (owner floating-pill round).
 * The composer USED to portal into the AppShell dock grid-row; the owner rejected that
 * look — the dock is a separate row BELOW the transcript, so the pill sat on an opaque
 * band with no transcript above or below it. It now renders as an ABSOLUTE layer over
 * the bottom of THIS screen (`relative` root), so the transcript genuinely scrolls
 * BEHIND and UNDER the floating pill: text is visible above it, a soft top fade eases
 * that transition, and the transparent area below the pill (down to the notch
 * safe-area) shows the transcript too — no opaque band.
 *
 * KEYBOARD SAFETY — the same mechanism as the home sticky docks. ConversationScreen is
 * `h-full` inside the shell content region (grid-row 2), whose height is
 * `calc(100dvh - keyboard-inset)` minus the header. When the keyboard opens — the
 * layout viewport shrinking on resize browsers, or `--keyboard-inset` being written on
 * overlay browsers (see use-keyboard-inset.ts) — that region shrinks, this `relative`
 * root shrinks, and the `absolute bottom-0` pill rides up above the keyboard. It is
 * `absolute` rather than `sticky` because the pill must float OVER the transcript with
 * text visible below it, which a flow-reserving `sticky` element cannot do; the
 * keyboard-safety is identical (both are bottom-anchored inside the shrunken region).
 *
 * NO-CLS. The pill is out of flow (absolute), so it never shifts the transcript; the
 * transcript instead reserves a stable bottom padding for it, measured live into
 * `--v2-conv-dock-h` by the observer below (it grows with the composer's staging so the
 * last message always clears the pill). The resolving `ComposerSkeleton` shares the
 * pill's exact geometry, so the floating bar never jumps as ownership/history resolve.
 * MessageList keeps its OWN internal scroller + scroll-etiquette untouched.
 */
export function ConversationScreen({
  conversationId,
  serverUserId,
}: {
  conversationId: string;
  serverUserId: number | null;
}) {
  const controller = useConversationController(conversationId, serverUserId);
  const { stream } = controller;
  const {
    messages,
    streamingText,
    reasoning,
    isStreaming,
    isCancelling,
    isLoadingHistory,
    error,
    retryLastMessage,
  } = stream;

  // Measure the floating composer's height into `--v2-conv-dock-h` so the transcript
  // (and the jump-to-latest pill) reserve exactly enough bottom clearance — and
  // re-measure as staging grows/shrinks the pill. No setState: it only writes a CSS
  // custom property (React Compiler-clean, mirrors use-keyboard-inset.ts).
  const screenRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dock = dockRef.current;
    const screen = screenRef.current;
    if (!dock || !screen) return;
    const sync = () => {
      screen.style.setProperty('--v2-conv-dock-h', `${dock.offsetHeight}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      screen.style.removeProperty('--v2-conv-dock-h');
    };
  }, []);

  // Inline result cards fire follow-up turns through this (no attachments).
  // Depends on the STABLE `controller.submit` (a useCallback), not the whole
  // controller object, so the card subtree's context value doesn't churn.
  const submit = controller.submit;
  const sendFollowUp = useCallback(
    (message: string) => {
      void submit(message, []);
    },
    [submit],
  );

  // Terminal page states (engine surfaces these as sentinel error strings).
  if (error === 'confidential_transcript_lost') {
    return <ConfidentialLostState />;
  }
  if (error === 'not_found') {
    return <NotAvailableState />;
  }

  // Anything else in `error` is a recoverable connection error → inline banner.
  const connectionError =
    error && error !== 'confidential_transcript_lost' && error !== 'not_found' ? error : null;

  return (
    <V2ChatProvider sendMessage={sendFollowUp} isStreaming={isStreaming}>
      <div
        ref={screenRef}
        data-v2-marker="V2-CONVERSATION"
        data-conversation-id={conversationId}
        className="relative flex h-full min-h-0 flex-col"
      >
        {controller.isConfidential && (
          <ConfidentialBanner onDelete={controller.deleteConfidential} />
        )}

        <MessageList
          messages={messages}
          streamingText={streamingText}
          reasoning={reasoning}
          isStreaming={isStreaming}
          isLoadingHistory={isLoadingHistory}
          error={connectionError}
          narration={controller.narration}
          references={controller.references}
          canRegenerate={controller.canRegenerate}
          onRegenerate={controller.regenerate}
          onRetry={retryLastMessage}
        />

        {/* Floating composer layer — an ABSOLUTE overlay over the transcript's bottom
            (never the dock row, never `position: fixed`). `pointer-events-none` lets
            the transparent gaps pass touches/scroll through to the transcript behind;
            only the pill re-enables events. `z-10` keeps it above the transcript. No
            top fade/scrim: the transcript stays crisp right up to the pill (owner —
            the fade read as a dim band above the bar). */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div ref={dockRef} className="pointer-events-auto v2-safe-bottom">
            {!controller.isOwnerResolved || isLoadingHistory ? (
              // Ownership/history still resolving → the composer-shaped skeleton (same
              // geometry as the real pill). NEVER the "shared" pill here: isOwner is
              // false while the owner id is null, so it would misleadingly flash for
              // owners on every direct-nav / reload / recents click.
              <ComposerSkeleton />
            ) : controller.isOwner ? (
              <ConversationComposer
                conversationId={conversationId}
                jurisdiction={controller.jurisdiction}
                onJurisdictionChange={controller.setJurisdiction}
                isConfidential={controller.isConfidential}
                isRedacted={controller.isRedacted}
                isStreaming={isStreaming}
                isCancelling={isCancelling}
                onSubmit={controller.submit}
                onStop={controller.stop}
              />
            ) : (
              <ViewOnlyPill />
            )}
          </div>
        </div>
      </div>
    </V2ChatProvider>
  );
}

/** Read-only footer for a shared conversation the viewer doesn't own (§C KEEP).
 *  Matches the pill's compact width so the floating bar keeps one silhouette. */
function ViewOnlyPill() {
  return (
    <div className="mx-auto w-full max-w-xs px-4 pb-3 pt-2 sm:max-w-md">
      <div className="bg-muted/80 text-muted-foreground flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-center text-sm backdrop-blur">
        <Eye className="h-4 w-4 shrink-0" />
        View only — this is a shared conversation
      </div>
    </div>
  );
}

/** Confidential transcript wiped / opened on another device (privacy-copy). */
function ConfidentialLostState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="bg-emerald-500/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-500" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">This confidential conversation isn&rsquo;t available here</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Confidential conversations are stored only on the device that created them and are never
        saved to our servers. This looks like a different device, or the local copy was cleared.
      </p>
    </div>
  );
}

/** Private / archived / non-existent conversation (parity with v1's not-available). */
function NotAvailableState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold">Conversation not available</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        This conversation is private, was archived, or doesn&rsquo;t exist.
      </p>
    </div>
  );
}
