'use client';

import { useMemo, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { AgentConversation } from '@/types/agent-conversations';
import type { AdminConversationView } from '@/types/admin-conversation-view';
import type { BackgroundJob } from '@/types/background-jobs';
import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine';
import { makeQueryClient } from '@/v2/runtime/query';
import { V2SessionProvider } from '@/v2/runtime/session-context';
import { AgentRowsProvider } from '../conversation/agents/context';
import { BackgroundJobsProvider } from '../conversation/background-jobs/context';
import { MessageList } from '../conversation/MessageList';
import { ReadOnlyTranscript } from '../conversation/read-only';
import { TurnFooterProvider, type TurnFooterRender } from '../conversation/rows/turn-footer';
import { AdminSidePanel } from './AdminSidePanel';
import { adminToolResults, withCutResultsLeftOut } from './admin-tool-results';
import { adminHeldItems } from './admin-held-items';
import { HeldItemsSourceProvider } from '../conversation/held-items-source';
import { ToolResultSourceProvider } from '../conversation/tools/tool-result-source';
import '@/v2/shell/shell.css';

/**
 * The admin conversation view's transcript (Stay, thread 085a980c, 25
 * November 2026): the chat drawn with the owner's own rows, from the owner's
 * own message data (Backend da675ba5), so staff see what the person saw.
 *
 * SELF-CONTAINED. It is the one v2 module the v1 admin shell may import (the
 * sanctioned crossing in eslint.config.mjs; Techlead, 25 November 2026), so it
 * mounts everything the v2 rows need itself: a v2 query client, the session,
 * the jobs and agents, and the shell's styles. Nothing depends on the admin
 * shell carrying v2 context. Its query client keeps nothing on the device:
 * staff reading another person's chat must not leave it in the browser's
 * cache.
 *
 * ONE SCROLL. The transcript has no scroller of its own: it grows in the
 * admin page, which opens at the chat's first message (MessageList `flow`).
 *
 * READ ONLY. A snapshot: nothing streams, and the page reads it again only on
 * Refresh. No chat context is provided, so nothing in a row can send, answer
 * a card, keep a file as a template or regenerate; `ReadOnlyTranscript` turns
 * off every other row that could act (a skill draft's Save and Dismiss, the
 * machine's Free it, a prompt card's choices, Connect with a lawyer, Try
 * again); background jobs show without Cancel (useCanAct); agent rows show without Stop
 * and follow no running turn.
 *
 * THE SIDE PANEL (AdminSidePanel.tsx). A draft or a file opens beside the
 * transcript as it does on the owner's page, read only (Stay, 26 November
 * 2026: "like for like as user side"). The page gives the panel its box.
 *
 * DRAWN AS THE OWNER. The rows ask the session who is reading ("mine", a
 * Space author's name); here that is the owner, as the server drew the data
 * for them. It names nobody but the owner and grants nothing: every request a
 * row makes still carries the staff member's own token.
 */

const STILL: StreamingSource = {
  subscribe: () => () => {},
  get: () => '',
};

const NO_OP = () => {};

export function AdminTranscript({
  view,
  agentConversations,
  jobs,
  turnFooter,
  panelHost = null,
  onPanelOpenChange,
}: {
  view: AdminConversationView;
  agentConversations: readonly AgentConversation[];
  jobs: readonly BackgroundJob[];
  turnFooter: TurnFooterRender;
  /** The page's box for the side panel on a computer; `null` until drawn. */
  panelHost?: HTMLElement | null;
  /** The side panel opened or closed, so the page makes room for it. */
  onPanelOpenChange?: (open: boolean) => void;
}) {
  const messages = useMemo(
    // A result cut at 200 kB is fetched whole when its step opens, as the owner's chat does (admin-tool-results.ts).
    () => transformApiMessages(withCutResultsLeftOut(view.messages), { events: true }) as EngineMessage[],
    [view.messages],
  );
  const readerAgents = useMemo(
    // Staff may not type into it or stop it, and a snapshot follows no live turn: no stream is opened.
    () => agentConversations.map((agent) => ({ ...agent, can_send: false, execution_id: null, stream_url: null })),
    [agentConversations],
  );
  const references = useMemo(() => view.references ?? [], [view.references]);
  const toolResults = useMemo(() => adminToolResults(view.id), [view.id]);
  const heldItems = useMemo(() => adminHeldItems(view.id), [view.id]);
  const owner = view.owner;
  // One client for the page's life, with v2's defaults and no persister.
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ReadOnlyTranscript>
        <V2SessionProvider
          signedIn
          userId={view.user_id}
          userUuid={owner?.uuid ?? view.user_uuid}
          name={owner?.name ?? null}
          email={null}
          avatarUrl={null}
          username={null}
          role={null}
          isVerified
          authProvider={null}
          canSetPrice={false}
          isAmbassador={false}
          profileCountryName={null}
          profileCountryCode={null}
          isLawyer={false}
          canAccessTeamChannels={false}
          canRecord={false}
          canDictate={false}
          isVerifiedAuthor={false}
          mayHaveWrapped={false}
          wrappedHidden
        >
          <ToolResultSourceProvider value={toolResults}>
          <HeldItemsSourceProvider value={heldItems}>
              <BackgroundJobsProvider conversationId={view.id} jobs={jobs}>
                <AgentRowsProvider conversationId={view.id} agentConversations={readerAgents}>
                  <TurnFooterProvider render={turnFooter}>
                    <AdminSidePanel
                      conversationId={view.id}
                      messages={messages}
                      streamingText={STILL}
                      host={panelHost}
                      onOpenChange={onPanelOpenChange}
                    >
                      {/* Read in the admin page's own scroll, from the top (Stay, 26 November 2026). */}
                      <div data-admin-transcript="" className="relative flex min-w-0 flex-col">
                        <MessageList
                          messages={messages}
                          streamingText={STILL}
                          reasoning={STILL}
                          isStreaming={false}
                          isLoadingHistory={false}
                          error={null}
                          narration={null}
                          references={references}
                          canRegenerate={false}
                          onRegenerate={NO_OP}
                          onRetry={NO_OP}
                          showAuthors={false}
                          viewerId={view.user_id}
                          viewerUuid={owner?.uuid ?? view.user_uuid}
                          redacted={view.is_redacted === true}
                          masthead={null}
                          underBar={false}
                          onReply={null}
                          flow
                        />
                      </div>
                    </AdminSidePanel>
                  </TurnFooterProvider>
                </AgentRowsProvider>
              </BackgroundJobsProvider>
          </HeldItemsSourceProvider>
          </ToolResultSourceProvider>
        </V2SessionProvider>
      </ReadOnlyTranscript>
    </QueryClientProvider>
  );
}
