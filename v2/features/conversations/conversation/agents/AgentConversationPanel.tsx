'use client';

import { Fragment, useCallback, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Bot, CircleAlert, CircleX, Loader2, Square } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { agentConversationsApi } from '@/lib/api/agent-conversations';
import { chatApi } from '@/lib/api/chat';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { AgentConversation } from '@/types/agent-conversations';
import type { AgentChain } from '@/types/agent-chain';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import { plainPreview } from '../../plain-preview';
import { conversationsQueries } from '../../queries';
import { clockTime } from '../day-label';
import { MarkdownText } from '../markdown/MarkdownText';
import { ChatSidePanel } from '../side-panel/ChatSidePanel';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { formatToolMessage } from '../tools/ToolStepItem';
import { AgentRoster } from './AgentRoster';
import { agentConversationTopic, agentTranscriptRows, subAgentPlaces, subAgentReplyView, type AgentStepCall, type AgentTranscriptRow } from './agent-transcript';
import { useChainEntry, useRosterReplyIds } from './context';
import { agentChainQueries, agentConversationQueries } from './queries';
import { useAgentPanelSource } from './agent-panel-source';
import { useAgentStream } from './use-agent-stream';
import { sendsOnEnter } from '@/lib/utils/enter-key';
import { DictateButton } from '@/v2/features/dictation/DictateButton';
import { DictationCountdown, DictationHint, DictationPanel } from '@/v2/features/dictation/DictationPanel';
import { dictationProblemLine, joinText } from '@/v2/features/dictation/dictation-model';
import { isDictating, useDictation } from '@/v2/features/dictation/use-dictation';

/**
 * AgentConversationPanel — an agent conversation beside the chat (sub-agents
 * contract, section 3): what Lawexa asked the agent, every step the agent
 * took, and its answers. While the agent works its answer streams in here.
 * A reader who may write in the chat can type into it between turns (the
 * agent answers in this conversation; nobody else is woken) and stop a turn.
 *
 * Read like any chat (`GET /conversations/{uuid}`); whether it runs, the turn
 * to watch, whether the reader may type, and the agents it asked in turn come
 * from the chat's agent chain, which the page reads once (agents/context.tsx).
 * Opened from "Read the reply" and "Open its conversation" on an agent's row
 * (`?side=agent:<uuid>`).
 */
export function AgentConversationPanel({ conversationId }: { conversationId: string }) {
  const { userId: viewerId } = useV2Session();
  const queryClient = useQueryClient();
  // The owner's routes, or the admin view's snapshot of the same (agent-panel-source.ts).
  const source = useAgentPanelSource();
  const transcript = useQuery(source.transcript({ conversationId, viewerId }));
  const conversation = transcript.data;
  const parentId = conversation?.parent_conversation?.id ?? null;
  const entry = useChainEntry(conversationId);
  const agentName = entry?.agent.name ?? conversation?.agent?.name ?? null;

  // A turn ended: read the transcript and the chain again, and the parent's jobs (its waiting line moves on).
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...conversationsQueries.details(), conversationId] });
    void queryClient.invalidateQueries({ queryKey: agentChainQueries.all() });
    void queryClient.invalidateQueries({ queryKey: agentConversationQueries.all() });
    if (parentId) void queryClient.invalidateQueries({ queryKey: conversationsQueries.backgroundJobsOf(parentId) });
  }, [queryClient, conversationId, parentId]);

  const running = entry?.status === 'running' && entry.execution_id ? entry.execution_id : null;
  const rows = conversation ? agentTranscriptRows(conversation.messages) : [];
  const places = subAgentPlaces(rows);

  const title = conversation ? agentConversationTopic(conversation.title, agentName) : agentName ?? 'Agent conversation';
  const subtitle = agentName ? `${agentName} · ${running ? 'working' : 'agent conversation'}` : undefined;

  return (
    <ChatSidePanel
      label={agentName ? `Conversation with ${agentName}` : 'Agent conversation'}
      title={title}
      subtitle={subtitle}
      icon={
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot aria-hidden className="size-4" />
        </span>
      }
      footer={entry?.can_send ? <AgentComposer conversation={entry} running={running} onSent={refresh} /> : undefined}
    >
      <div className="flex flex-col gap-4 px-4 py-4 xl:px-5">
        {transcript.isPending ? (
          <TranscriptSkeleton />
        ) : transcript.isError || !conversation ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            This conversation could not be opened.
          </p>
        ) : (
          <>
            {/* The agents this agent asked in turn, nested, after the turn that asked them, as the chat draws its own. */}
            {rows.map((row, index) => (
              <Fragment key={row.key}>
                <TranscriptRow row={row} agentName={agentName} />
                {places.has(index) ? (
                  <AgentRoster
                    messageId={places.get(index) ?? null}
                    parent={{ id: conversationId, depth: entry?.depth ?? 1, name: agentName ?? 'This agent' }}
                  />
                ) : null}
              </Fragment>
            ))}
            {running ? <LiveTurn key={running} executionId={running} agentName={agentName} onEnd={refresh} /> : null}
            {rows.length === 0 && !running ? <p className="text-sm text-muted-foreground">Nothing has been said here yet.</p> : null}
          </>
        )}
      </div>
    </ChatSidePanel>
  );
}

function TranscriptSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-16 w-4/5 self-end rounded-2xl" />
      <Skeleton className="h-4 w-2/5 rounded" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

/** A turn of the conversation, by who wrote it. */
function TranscriptRow({ row, agentName }: { row: AgentTranscriptRow; agentName: string | null }) {
  switch (row.kind) {
    case 'call':
    case 'person':
      return (
        <article className="flex flex-col items-end gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <p className="text-xs text-muted-foreground">
            {row.kind === 'call' ? `From ${row.from}` : (row.author ?? 'You')} · <time dateTime={row.at}>{clockTime(new Date(row.at))}</time>
          </p>
          <div
            className={cn(
              'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap',
              row.kind === 'call' ? 'bg-primary/8 text-foreground' : 'bg-secondary text-foreground',
            )}
          >
            {row.text}
          </div>
        </article>
      );
    case 'steps':
      return <StepList calls={row.calls} />;
    case 'answer':
      return (
        <article aria-label={agentName ? `${agentName}'s answer` : 'Answer'} className="text-[14px] leading-relaxed text-foreground">
          <MarkdownText content={row.text} />
        </article>
      );
    case 'reply':
      return <SubAgentReply row={row} />;
    default:
      return (
        <p role="note" className="text-center text-xs text-muted-foreground">
          {row.text}
        </p>
      );
  }
}

/** The agent's own sub-agent came back: who, how, the start of the reply when the roster above is not showing it, and its conversation to open. */
function SubAgentReply({ row }: { row: Extract<AgentTranscriptRow, { kind: 'reply' }> }) {
  const panel = useSidePanel();
  const view = subAgentReplyView(row, useRosterReplyIds());
  const preview = view.preview ? plainPreview(view.preview) || view.preview : null;
  return (
    <section aria-label={view.heading} className="flex flex-col gap-1 border-l-2 border-border pl-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <p className={cn('flex items-center gap-1.5 text-xs font-medium', view.outcome === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>
        {view.outcome === 'failed' ? <CircleX aria-hidden className="size-3.5" /> : null}
        {view.heading}
      </p>
      {preview ? <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{preview}</p> : null}
      {panel ? (
        <button
          type="button"
          onClick={() => panel.open({ kind: 'agent', id: view.openId })}
          className={cn('v2-interactive self-start rounded text-xs font-medium text-primary underline-offset-4 hover:underline', FOCUS_RING)}
        >
          Open its conversation
        </button>
      ) : null}
    </section>
  );
}

/** The agent's steps, each named as the chat names it ("Searched cases for …"). */
function StepList({ calls, live = false }: { calls: readonly AgentStepCall[]; live?: boolean }) {
  return (
    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
      {calls.map((call, index) => {
        const done = !(live && index === calls.length - 1);
        const words = formatToolMessage(call.name, call.parameters, done);
        return (
          <li key={index} className="flex min-w-0 items-center gap-1.5">
            {done ? (
              <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', call.success === false ? 'bg-destructive' : 'bg-muted-foreground/50')} />
            ) : (
              <Loader2 aria-hidden className="size-3 shrink-0 motion-safe:animate-spin" />
            )}
            <span className="min-w-0 truncate">
              {words.action}
              {words.detail ? ` ${words.detail}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The turn the agent is taking now: its lookups so far, the running one last, then its answer as it streams. */
function LiveTurn({ executionId, agentName, onEnd }: { executionId: string; agentName: string | null; onEnd: () => void }) {
  const live = useAgentStream(executionId, onEnd);
  const running = live.steps.length > 0 && !live.steps[live.steps.length - 1].done;
  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {live.steps.length > 0 ? (
        <StepList calls={live.steps.map((step) => ({ name: step.name, parameters: step.parameters, success: undefined }))} live={running} />
      ) : null}
      {live.text ? (
        <article className="text-[14px] leading-relaxed text-foreground">
          <MarkdownText content={live.text} animate />
        </article>
      ) : live.steps.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 aria-hidden className="size-3 motion-safe:animate-spin" />
          {agentName ?? 'The agent'} is working…
        </p>
      ) : null}
    </div>
  );
}

/**
 * Typing into the conversation (contract 3.3): the agent answers here. While
 * a turn runs the box waits and Stop ends the turn; the server refuses a
 * second turn beside it anyway (409), and the panel then simply watches.
 */
function AgentComposer({ conversation, running, onSent }: { conversation: AgentConversation; running: string | null; onSent: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (message: string) => agentConversationsApi.send(conversation.id, message),
    onSuccess: (response) => {
      setText('');
      setProblem(null);
      // The chain now says it runs, with the turn to watch: the panel attaches to it.
      const sent = response.data.agent_conversation;
      queryClient.setQueriesData<AgentChain>({ queryKey: agentChainQueries.all() }, (chain) =>
        chain
          ? { ...chain, agents: chain.agents.map((each) => (each.id === sent.id ? { ...each, ...sent, state: 'running', waiting_on: null } : each)) }
          : chain,
      );
      queryClient.setQueriesData<AgentConversation[]>({ queryKey: agentConversationQueries.all() }, (list) =>
        list?.map((each) => (each.id === sent.id ? sent : each)),
      );
      onSent();
    },
    onError: (error) => {
      const refused = extractApiError(error);
      if (refused.status === 409) {
        setProblem(`${conversation.agent.name} is still answering. Your message is still here.`);
        onSent();
      } else if (refused.status === 403) {
        setProblem('You can read this conversation, but not write in it.');
      } else {
        setProblem(refused.message || 'Your message could not be sent. Try again.');
      }
    },
  });

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const message = text.trim();
    if (!message || running || send.isPending) return;
    send.mutate(message);
  };

  // Dictation (Arthur, 26 November 2026: every message box has it). The agent's route takes words only, so no voice is kept.
  // The words go into the box first: a refusal (still answering, 409) leaves them there, as the box says.
  const { canDictate } = useV2Session();
  const { state: dictating, dictation } = useDictation({
    onSend: ({ text: words }) => {
      if (running || send.isPending) {
        setText((current) => joinText(current, words));
        return;
      }
      setText(words);
      send.mutate(words);
    },
    onProblem: (kind, message) => setProblem(dictationProblemLine(kind, message)),
  });
  const dictationOpen = isDictating(dictating);
  // Dictate holds Send's place while the box is empty and no turn runs.
  const offerDictate = canDictate && !dictationOpen && !running && text.trim() === '';

  // The app's one Enter rule (lib/utils/enter-key.ts): on a phone, return adds a line and the send button sends.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (sendsOnEnter(event)) submit();
  };

  const stop = () => {
    const token = useAuthStore.getState().token;
    if (!running || !token) return;
    setStopping(running);
    void chatApi.cancelStream(running, token);
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-1.5">
      <DictationCountdown state={dictating} dictation={dictation} />
      {dictationOpen ? (
        <div className="w-full rounded-2xl border px-1 py-1">
          <DictationPanel state={dictating} dictation={dictation} canSend={!running} isSending={send.isPending} />
        </div>
      ) : (
        <div className="flex w-full items-end gap-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={30000}
            placeholder={running ? `${conversation.agent.name} is answering…` : `Write to ${conversation.agent.name}`}
            aria-label={`Write to ${conversation.agent.name}`}
            className="max-h-[min(10rem,30dvh)] min-h-10 flex-1 resize-none rounded-2xl"
          />
          {running ? (
            <button
              type="button"
              onClick={stop}
              disabled={stopping === running}
              aria-label={`Stop ${conversation.agent.name}`}
              className={cn(
                'v2-interactive flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-60',
                FOCUS_RING,
              )}
            >
              {stopping === running ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : <Square aria-hidden className="size-3.5 fill-current" />}
            </button>
          ) : offerDictate ? (
            <DictateButton onStart={() => void dictation.start()} disabled={send.isPending} className="size-10" />
          ) : (
            <button
              type="submit"
              disabled={!text.trim() || send.isPending}
              aria-label="Send"
              className={cn(
                'v2-interactive flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-50',
                FOCUS_RING,
              )}
            >
              {send.isPending ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : <ArrowUp aria-hidden className="size-4" />}
            </button>
          )}
        </div>
      )}
      {dictationOpen ? <DictationHint state={dictating} /> : null}
      <p role="status" aria-live="polite" className="min-h-4 px-1 text-xs text-muted-foreground">
        {problem ?? ''}
      </p>
    </form>
  );
}
