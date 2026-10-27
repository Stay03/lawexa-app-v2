'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useV2Session } from '@/v2/runtime/session-context';
import type { MessageReplyTo } from '@/types/chat';
import { REPLY_DRAFT, quoteTone, replyDraftKey } from './reply-target';
import { writeDraft } from './draft-store';
import { memberColourIndex } from './member-colour';
import { colourRosterFor } from './record-roster';
import {
  useConversationController,
  type ConversationEmbed,
} from './useConversationController';
import { ConversationMasthead } from './ConversationMasthead';
import { MessageList } from './MessageList';
import { ConfidentialBanner } from './ConfidentialBanner';
import { ConversationActions } from './ConversationActions';
import { V2ChatProvider } from './chat-context';
import { DocumentExportScope } from './markdown/document-export';
import {
  clearEmbeddedComposer,
  publishEmbeddedComposer,
  reportFollowUpRefusal,
} from './embedded-composer';
import { clearRouteComposer, publishRouteComposer, stageRouteReply } from './route-composer';
import { draftOffsets } from './draft/draft-ordinals';
import { draftVersion, draftVersionIndex } from './draft/draft-versions';
import { SidePanelProvider, SidePanelValueProvider } from './side-panel/SidePanelContext';
import { useSidePanelHost } from './side-panel/side-panel-host';
import { SidePanelSlot } from './side-panel/SidePanelSlot';
import { useScreenHold } from '@/v2/runtime/screen-hold';

/** The composer's height, read by the transcript's bottom padding and the
 *  jump-to-latest pill (MessageList). On a chat's own route the shell's docked
 *  box writes it on the root element (`ChatDock`); under an external composer
 *  the box is below the screen in flow, so the screen pins it to 0px. */
const DOCK_HEIGHT_VAR = '--v2-conv-dock-h';
const NO_DOCK_CLEARANCE = { [DOCK_HEIGHT_VAR]: '0px' } as CSSProperties;

/**
 * ConversationScreen — the v2 `/c/[id]` client root. Mounts the controller (engine
 * + privacy resolvers + handoff/recovery), renders the transcript in the shell's
 * content region, and publishes the docked box's state (ChatDock). Carries the
 * server-renderable `data-v2-marker="V2-CONVERSATION"`.
 *
 * THE BOX IS THE SHELL'S, AND STILL FLOATS (message box B, Stay, 17 October 2026).
 * On its own route the chat's message box is `ChatDock`, in the AppShell's dock slot,
 * so it is one element from the tap's first frame to the chat (see ChatDock.tsx). This
 * screen PUBLISHES what the box needs (route-composer.ts) and draws the transcript.
 * The box still floats OVER the transcript's bottom, as the owner asked when the dock
 * was an opaque band below it (the floating-pill round): a shell.css rule lifts the
 * dock row onto the content row while it holds the box, with nothing painted behind
 * it, so the transcript scrolls under the pill. It is a grid item, never
 * `position: fixed`, so the keyboard inset that shrinks the shell lifts it
 * (use-keyboard-inset.ts). The transcript reserves its bottom padding from
 * `--v2-conv-dock-h`, which the box measures onto the root element.
 *
 * Embedded (the case page's side chat), the host owns the box below this screen in
 * flow and reads the embedded surface; the screen pins the clearance to 0px.
 *
 * OWNERSHIP ID FROM CONTEXT (privacy-relevant — read this before changing it).
 * `serverUserId` is the SERVER-VERIFIED user id the controller compares against the
 * conversation's owner to decide composer vs. view-only. It used to arrive as a prop
 * from `app/v2/c/[id]/page.tsx`, which had to `await verifySession()` to produce it —
 * an uncached `/auth/me` round trip on every navigation, so the route skeleton covered a
 * wait on Laravel every time. (That skeleton is now absent on a return trip as well: the
 * page exports `unstable_dynamicStaleTime`, so the router serves the segment from its
 * cache instead of re-fetching it.) It now comes from `<V2SessionProvider>`, which
 * the v2 layout populates
 * from ITS `verifySession()` call. The value is byte-for-byte the same
 * (`session?.user.id ?? null`), produced by the same server-only DAL call against the
 * same backend; only the delivery path changed. It is NEVER derived from cookie
 * presence or from any client-held identity, and `null` (signed out / unverifiable)
 * still means "not the owner" — the strictly safe direction. The backend remains the
 * real authority: the transcript fetch is authorized independently and 401s on its own.
 */
export function ConversationScreen({
  conversationId,
  embed,
  jumpTo = null,
}: {
  conversationId: string;
  /** Present when this screen lives inside another route (the case page's
   *  side chat) — see `ConversationEmbed` on the controller. */
  embed?: ConversationEmbed;
  /** A message to go to once the chat has opened (`/c/{id}?m={id}`, a notification). */
  jumpTo?: number | null;
}) {
  const { userId: serverUserId } = useV2Session();
  const controller = useConversationController(conversationId, serverUserId, embed);
  const { stream } = controller;
  const {
    messages,
    streamingText,
    reasoning,
    isStreaming,
    isCancelling,
    error,
    retryLastMessage,
  } = stream;
  // An answer being written: nothing pops up over it (screen-hold.ts).
  useScreenHold(isStreaming);
  // Each person's colour in a space chat (member-colour.ts): the roster's order,
  // then anyone else who asked, by first appearance. A row this client drew for
  // the reader carries no author yet, so it takes the reader's own uuid.
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  // The record's own roster when it lists every asker, else the members read
  // (record-roster.ts).
  const { spaceRoster, recordRoster } = controller;
  const memberColours = useMemo(() => {
    const asked: string[] = [];
    for (const message of messages) {
      if (message.role === 'user' && message.author?.uuid) asked.push(message.author.uuid);
    }
    const roster = colourRosterFor(recordRoster, spaceRoster, asked);
    return roster ? memberColourIndex(roster, asked) : null;
  }, [recordRoster, spaceRoster, messages]);
  // Each answer's draft offset, so a draft card and the side panel name the
  // same draft (draft-ordinals.ts). Counted from saved text; a streaming flush
  // does not change `messages`, so this does not run per word.
  const offsets = useMemo(() => draftOffsets(messages), [messages]);
  // The same drafts by group, so a card reads "Version 2" (draft-versions.ts).
  const draftVersions = useMemo(() => {
    const index = draftVersionIndex(messages);
    return (ordinal: number, key: string) => draftVersion(index, ordinal, key);
  }, [messages]);
  // Embedded, the page around the chat may show its side panel (the case
  // page's draft editor, side-panel-host.tsx).
  const panelHost = useSidePanelHost();
  // External-composer embedding (the case chat's ONE screen): the HOST owns the
  // composer element, this screen owns the conversation — so it renders the
  // transcript only and PUBLISHES its composer-facing surface through the
  // embedded-composer store (the header-context idiom; effect-time writes).
  const externalComposer = embed?.composer === 'external';
  const {
    jurisdiction,
    setJurisdiction,
    isConfidential,
    isRedacted,
    isOwner,
    canSend,
    viewOnlyReason,
    sendHeldBy,
    canStop,
    isOwnerResolved,
    submit: controllerSubmit,
    stop: controllerStop,
  } = controller;
  useEffect(() => {
    if (!externalComposer) return;
    publishEmbeddedComposer({
      conversationId,
      jurisdiction,
      setJurisdiction,
      isConfidential,
      isRedacted,
      isStreaming,
      isCancelling,
      isOwner,
      canSend,
      viewOnlyReason,
      sendHeldBy,
      canStop,
      isOwnerResolved,
      submit: controllerSubmit,
      stop: controllerStop,
    });
  }, [
    externalComposer,
    conversationId,
    jurisdiction,
    setJurisdiction,
    isConfidential,
    isRedacted,
    isStreaming,
    isCancelling,
    isOwner,
    canSend,
    viewOnlyReason,
    sendHeldBy,
    canStop,
    isOwnerResolved,
    controllerSubmit,
    controllerStop,
  ]);
  useEffect(() => {
    if (!externalComposer) return;
    return () => clearEmbeddedComposer(conversationId);
  }, [externalComposer, conversationId]);
  // NOT `stream.isLoadingHistory` — that flag only covers the device-owned
  // IndexedDB load. The controller's flag is the union of both history paths AND-ed
  // with "there is nothing to show yet", so a conversation served from the
  // transcript cache never renders a skeleton over content it already has.
  const { isLoadingHistory, showHistorySkeleton } = controller;
  // The first SKELETON_HOLD_MS of a wait draw nothing, transcript and composer
  // alike, so a copy read from the device in that time is not preceded by a
  // skeleton flash (skeleton-hold.ts).
  const holdingSkeleton = isLoadingHistory && !showHistorySkeleton;

  // Whether the reader has scrolled up from the bottom; set by MessageList's
  // scroll handler, read by the composer's chip row (#16).
  const [scrolledUp, setScrolledUp] = useState(false);

  // Inline result cards fire follow-up turns through this (no attachments).
  // Depends on the STABLE `controller.submit` (a useCallback), not the whole
  // controller object, so the card subtree's context value doesn't churn.
  //
  // A reader who may not send gets disabled card actions (the context's
  // `canSend`), and this refuses too, as the server would. A follow-up the
  // server refuses (Spaces F4: another member's turn, or the reader was made a
  // Viewer) is given back to the composer as its draft, with the sentence the
  // composer shows for its own refused sends: this screen's pill through its
  // handle, or, with an external composer, the host's through the surface.
  const submit = controller.submit;
  const sendFollowUp = useCallback(
    (message: string) => {
      if (!canSend) return;
      void (async () => {
        const outcome = await submit(message, []);
        if (!outcome) return;
        // To whichever box this chat has: the case host's, or the shell's dock.
        reportFollowUpRefusal({ conversationId, text: message, sentence: outcome.refused });
      })();
    },
    [canSend, submit, conversationId],
  );

  // Replies (Stay, 14 October 2026): in a space chat where the reader may
  // send, a message's Reply stages its quote in this screen's composer. Not in a
  // personal chat (the server takes replies there, the app offers none this
  // round), and not with an external composer, which this screen cannot reach.
  const canReply = controller.showAuthors && canSend && !externalComposer && !isConfidential;
  // Staged through the draft store, not only the composer's handle: the
  // transcript can be on screen (drawn from the device's copy) while the
  // composer is still its skeleton, and a Reply pressed then reached no
  // composer and was lost (WebKit rendered check, 15 October 2026). The draft
  // holds it, the composer shows it when it mounts, and the docked box, when it
  // is up, also puts the caret in it (`stageRouteReply`).
  const stageReply = useCallback(
    (target: MessageReplyTo) => {
      writeDraft(replyDraftKey(conversationId), REPLY_DRAFT, target);
      stageRouteReply(conversationId, target);
    },
    [conversationId],
  );
  // The quote bar in the quoted person's colour, as the reply's quote will be.
  const quoteToneOf = useCallback((replyTo: MessageReplyTo) => quoteTone(replyTo, memberColours), [memberColours]);

  // "Ask again" refused (a colleague's turn, or a demotion): the sentence in
  // the composer's banner, as for a refused send. Its question is already on
  // screen, so there is no text to give back.
  const regenerate = controller.regenerate;
  const askAgain = useCallback(() => {
    void (async () => {
      const outcome = await regenerate();
      if (!outcome) return;
      reportFollowUpRefusal({ conversationId, text: null, sentence: outcome.refused });
    })();
  }, [regenerate, conversationId]);

  // ── The docked box (route-composer.ts) ────────────────────────────────────
  // On its own route the chat's box is the shell's (`ChatDock`), so the screen
  // publishes what the box needs and the box draws it. Under an external
  // composer the host's box reads the embedded surface above instead.
  const terminal =
    error === 'confidential_transcript_lost' || error === 'not_found' || controller.isGoneOnServer;
  const { mentionOptions, spaceUuid } = controller;
  useEffect(() => {
    if (externalComposer) return;
    publishRouteComposer({
      conversationId,
      terminal,
      holdingSkeleton,
      isOwnerResolved,
      canSend,
      viewOnlyReason,
      holdSend: isLoadingHistory,
      showMeta: !scrolledUp,
      jurisdiction,
      setJurisdiction,
      isConfidential,
      isRedacted,
      isStreaming,
      isCancelling,
      sendHeldBy,
      canStop,
      submit: controllerSubmit,
      stop: controllerStop,
      mentionOptions,
      quoteToneOf,
      spaceUuid,
    });
  }, [
    externalComposer,
    conversationId,
    terminal,
    holdingSkeleton,
    isOwnerResolved,
    canSend,
    viewOnlyReason,
    isLoadingHistory,
    scrolledUp,
    jurisdiction,
    setJurisdiction,
    isConfidential,
    isRedacted,
    isStreaming,
    isCancelling,
    sendHeldBy,
    canStop,
    controllerSubmit,
    controllerStop,
    mentionOptions,
    quoteToneOf,
    spaceUuid,
  ]);
  useEffect(() => {
    if (externalComposer) return;
    return () => clearRouteComposer(conversationId);
  }, [externalComposer, conversationId]);

  // Terminal page states (engine surfaces these as sentinel error strings).
  if (error === 'confidential_transcript_lost') {
    return <ConfidentialLostState />;
  }
  // `isGoneOnServer`: deleted, made private or unshared on another device while
  // its transcript was still in memory (gone.ts).
  if (error === 'not_found' || controller.isGoneOnServer) {
    return <NotAvailableState />;
  }

  // Anything else in `error` is a recoverable connection error → inline banner.
  const connectionError =
    error && error !== 'confidential_transcript_lost' && error !== 'not_found' ? error : null;

  const transcript = (
      <div
        data-v2-marker="V2-CONVERSATION"
        data-conversation-id={conversationId}
        data-v2-chat-frame=""
        className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col"
        style={externalComposer ? NO_DOCK_CLEARANCE : undefined}
      >
        {controller.isConfidential && (
          <ConfidentialBanner onDelete={controller.deleteConfidential} />
        )}
        {/* The header menu's rows (the chat's `can`: Rename, Move to Space or
            Move, Remove, Share, Delete) and the space line under the title.
            Not inside another route (the case side chat has its own header),
            and never on a confidential chat, which the server does not hold
            and whose banner owns the device-only delete. */}
        {!embed ? (
          <ConversationActions
            conversationId={conversationId}
            viewerId={serverUserId}
            canShowPlace={controller.isOwnerResolved && !controller.isConfidential}
            currentTitle={controller.stream.conversationTitle}
            onRenamed={() => void controller.stream.fetchConversationTitle(conversationId)}
          />
        ) : null}

        {/* Download as Word on a document block: the owner, never a confidential
            chat (the export route answers 404 for both; document-export.tsx). */}
        <DocumentExportScope
          conversationId={conversationId}
          enabled={controller.isOwnerResolved && controller.isOwner && !controller.isConfidential}
        >
          <MessageList
            messages={messages}
            streamingText={streamingText}
            reasoning={reasoning}
            isStreaming={isStreaming}
            isLoadingHistory={showHistorySkeleton}
            error={connectionError}
            narration={controller.narration}
            references={controller.references}
            canRegenerate={controller.canRegenerate}
            onRegenerate={askAgain}
            onRetry={retryLastMessage}
            onScrolledUpChange={setScrolledUp}
            showAuthors={controller.showAuthors}
            viewerId={serverUserId}
            restingLabel={controller.turnLabel}
            heldSince={controller.heldSince}
            sentAt={controller.sentAt}
            redacted={controller.isRedacted}
            // On its own route the chat carries its heading in the page, under the
            // open bar; embedded (the case chat) the host owns the heading.
            memberColours={memberColours}
            viewerUuid={viewerUuid}
            masthead={embed ? null : <ConversationMasthead />}
            underBar={!embed && !controller.isConfidential}
            onReply={canReply ? stageReply : null}
            jumpTo={jumpTo}
          />
        </DocumentExportScope>

      </div>
  );

  return (
    <V2ChatProvider
      sendMessage={sendFollowUp}
      isStreaming={isStreaming}
      canSend={canSend}
      conversationId={conversationId}
    >
      {/* THE SIDE PANEL (the draft editor; the file list in chat): on a chat's
          own route, a draft or a file opens beside the transcript on a
          computer and as a sheet on a phone (ChatSidePanel.tsx). Embedded, the
          host page draws it where it keeps room for it (the case page: a card
          over the reading, left of the docked chat), through a portal that
          keeps this chat's context; it waits for the transcript, so a draft
          is never reported missing from a chat still loading. With no host
          (the statute page) a draft shows in its card instead. */}
      {embed ? (
        panelHost ? (
          <SidePanelValueProvider
            url={panelHost.url}
            offsets={offsets}
            versions={draftVersions}
            space={controller.space}
            frame="card"
          >
            {transcript}
            {panelHost.element && !isLoadingHistory
              ? createPortal(<SidePanelSlot messages={messages} streamingText={streamingText} />, panelHost.element)
              : null}
          </SidePanelValueProvider>
        ) : (
          transcript
        )
      ) : (
        <SidePanelProvider offsets={offsets} versions={draftVersions} space={controller.space}>
          <div className="flex h-full min-h-0">
            {transcript}
            <SidePanelSlot messages={messages} streamingText={streamingText} />
          </div>
        </SidePanelProvider>
      )}
    </V2ChatProvider>
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
