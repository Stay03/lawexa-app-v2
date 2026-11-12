'use client';

import { useCallback, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Bot, CircleAlert, Loader2, Square } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { agentConversationsApi } from '@/lib/api/agent-conversations';
import { chatApi } from '@/lib/api/chat';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { AgentConversation } from '@/types/agent-conversations';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import { conversationsQueries } from '../../queries';
import { clockTime } from '../day-label';
import { MarkdownText } from '../markdown/MarkdownText';
import { ChatSidePanel } from '../side-panel/ChatSidePanel';
import { formatToolMessage } from '../tools/ToolStepItem';
import { agentConversationTopic, agentTranscriptRows, type AgentStepCall, type AgentTranscriptRow } from './agent-transcript';
import { agentConversationQueries } from './queries';
import { useAgentStream } from './use-agent-stream';

/**
 * AgentConversationPanel — an agent conversation beside the chat (sub-agents
 * contract, section 3): what Lawexa asked the agent, every step the agent
 * took, and its answers. While the agent works its answer streams in here.
 * A reader who may write in the chat can type into it between turns (the
 * agent answers in this conversation; nobody else is woken) and stop a turn.
 *
 * Read like any chat (`GET /conversations/{uuid}`); whether it runs, the turn
 * to watch and whether the reader may type come from the chat's list of
 * agent conversations (3.1). Opened from "Open" on a waiting line and "Open
 * full" on a reply (`?side=agent:<uuid>`).
 */
export function AgentConversationPanel({ conversationId }: { conversationId: string }) {
  const { userId: viewerId } = useV2Session();
  const queryClient = useQueryClient();
  const transcript = useQuery(conversationsQueries.detail({ conversationId, viewerId }));
  const conversation = transcript.data;
  const parentId = conversation?.parent_conversation?.id ?? null;
  const siblings = useQuery({
    ...agentConversationQueries.of({ parentId: parentId ?? '', viewerId }),
    enabled: parentId !== null,
  });
  const entry: AgentConversation | null = siblings.data?.find((each) => each.id === conversationId) ?? null;
  const agentName = entry?.agent.name ?? conversation?.agent?.name ?? null;

  // A turn ended: read the transcript and the list again, and the parent's jobs (its waiting line moves on).
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...conversationsQueries.details(), conversationId] });
    void queryClient.invalidateQueries({ queryKey: agentConversationQueries.all() });
    if (parentId) void queryClient.invalidateQueries({ queryKey: conversationsQueries.backgroundJobsOf(parentId) });
  }, [queryClient, conversationId, parentId]);

  const running = entry?.status === 'running' && entry.execution_id ? entry.execution_id : null;
  const rows = conversation ? agentTranscriptRows(conversation.messages) : [];

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
            {rows.map((row) => (
              <TranscriptRow key={row.key} row={row} agentName={agentName} />
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
    default:
      return (
        <p role="note" className="text-center text-xs text-muted-foreground">
          {row.text}
        </p>
      );
  }
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

/** The turn the agent is taking now: its current step, then its answer as it streams. */
function LiveTurn({ executionId, agentName, onEnd }: { executionId: string; agentName: string | null; onEnd: () => void }) {
  const live = useAgentStream(executionId, onEnd);
  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {live.step ? (
        <StepList calls={[{ name: live.step.name, parameters: live.step.parameters, success: undefined }]} live />
      ) : null}
      {live.text ? (
        <article className="text-[14px] leading-relaxed text-foreground">
          <MarkdownText content={live.text} animate />
        </article>
      ) : !live.step ? (
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
      // The list now says it runs, with the turn to watch: the panel attaches to it.
      queryClient.setQueriesData<AgentConversation[]>({ queryKey: agentConversationQueries.all() }, (list) =>
        list?.map((each) => (each.id === conversation.id ? response.data.agent_conversation : each)),
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

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const stop = () => {
    const token = useAuthStore.getState().token;
    if (!running || !token) return;
    setStopping(running);
    void chatApi.cancelStream(running, token);
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-1.5">
      <div className="flex w-full items-end gap-2">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={30000}
          placeholder={running ? `${conversation.agent.name} is answering…` : `Write to ${conversation.agent.name}`}
          aria-label={`Write to ${conversation.agent.name}`}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-2xl"
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
      <p role="status" aria-live="polite" className="min-h-4 px-1 text-xs text-muted-foreground">
        {problem ?? ''}
      </p>
    </form>
  );
}
