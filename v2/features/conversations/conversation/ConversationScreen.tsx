'use client';

import { useCallback } from 'react';
import { Eye, ShieldCheck } from 'lucide-react';
import { DockPortal, ComposerSkeleton } from '@/v2/shell/Dock';
import { useConversationController } from './useConversationController';
import { MessageList } from './MessageList';
import { ConversationComposer } from './ConversationComposer';
import { V2ChatProvider } from './chat-context';

/**
 * ConversationScreen — the v2 `/c/[id]` client root. Mounts the controller (engine
 * + privacy resolvers + handoff/recovery), renders the transcript in the shell's
 * content region, and PORTALS the floating composer into the dock grid-row. Carries
 * the server-renderable `data-v2-marker="V2-CONVERSATION"`.
 *
 * The screen root is `h-full flex flex-col min-h-0` so the MessageList scrolls
 * internally (`flex-1 min-h-0`) and the shell content never double-scrolls; the
 * composer lives OUTSIDE that scroll region (in the dock), so the transcript scrolls
 * behind it and the dvh + keyboard-inset grid keeps it keyboard-safe — no `vh`, no
 * `position: fixed` (the v1 defects the §C catalog calls out).
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
        data-v2-marker="V2-CONVERSATION"
        data-conversation-id={conversationId}
        className="flex h-full min-h-0 flex-col"
      >
        {controller.isConfidential && (
          <div className="v2-safe-left v2-safe-right flex items-center justify-center gap-2 border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs text-emerald-700 dark:text-emerald-400 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="font-medium">Confidential</span>
            <span className="text-emerald-700/70 dark:text-emerald-400/70">
              · stored only on this device, never on our servers
            </span>
          </div>
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
      </div>

      <DockPortal>
        {!controller.isOwnerResolved || isLoadingHistory ? (
          // Ownership/history still resolving → the composer-shaped skeleton (same
          // visual as the SSR reservation). NEVER the "shared" pill here: isOwner is
          // false while the owner id is null, so the pill would misleadingly flash
          // for owners on every direct-nav / reload / recents click.
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
      </DockPortal>
    </V2ChatProvider>
  );
}

/** Read-only footer for a shared conversation the viewer doesn't own (§C KEEP). */
function ViewOnlyPill() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-3 pt-2">
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
