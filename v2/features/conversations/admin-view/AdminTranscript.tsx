'use client';

import { useMemo } from 'react';

import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { AgentConversation } from '@/types/agent-conversations';
import type { AdminConversationView } from '@/types/admin-conversation-view';
import type { BackgroundJob } from '@/types/background-jobs';
import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine';
import { V2SessionProvider } from '@/v2/runtime/session-context';
import { AgentRowsProvider } from '../conversation/agents/context';
import { BackgroundJobsProvider } from '../conversation/background-jobs/context';
import { MessageList } from '../conversation/MessageList';
import { TurnFooterProvider, type TurnFooterRender } from '../conversation/rows/turn-footer';
import '@/v2/shell/shell.css';

/**
 * The admin conversation view's transcript (Stay, thread 085a980c, 25
 * November 2026): the chat drawn with the owner's own rows, from the owner's
 * own message data (Backend aee2efb0), so staff see what the person saw.
 *
 * READ ONLY. A snapshot: nothing streams, and the page reads it again only on
 * Refresh. No chat context is provided, so nothing in a row can send, answer
 * a card, keep a file as a template or regenerate; background jobs show
 * without Cancel; agent rows show without Stop (the admin route gives them
 * with `can_send` false for this reader).
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
}: {
  view: AdminConversationView;
  agentConversations: readonly AgentConversation[];
  jobs: readonly BackgroundJob[];
  turnFooter: TurnFooterRender;
}) {
  const messages = useMemo(
    () => transformApiMessages(view.messages, { events: true }) as EngineMessage[],
    [view.messages],
  );
  const readerAgents = useMemo(
    () => agentConversations.map((agent) => ({ ...agent, can_send: false })),
    [agentConversations],
  );
  const references = useMemo(() => view.references ?? [], [view.references]);
  const owner = view.owner;

  return (
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
      isVerifiedAuthor={false}
      mayHaveWrapped={false}
      wrappedHidden
    >
      <BackgroundJobsProvider conversationId={view.id} jobs={jobs} readOnly>
        <AgentRowsProvider conversationId={view.id} agentConversations={readerAgents}>
          <TurnFooterProvider render={turnFooter}>
            <div data-admin-transcript="" className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
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
              />
            </div>
          </TurnFooterProvider>
        </AgentRowsProvider>
      </BackgroundJobsProvider>
    </V2SessionProvider>
  );
}
