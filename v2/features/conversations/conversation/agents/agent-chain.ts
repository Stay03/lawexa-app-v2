import type { AgentChain, AgentChainEntry, AgentChainState, AgentWaitingOn } from '@/types/agent-chain';
import { plainPreview } from '../../plain-preview';

/**
 * agent chain — the pure rules of the live agent list (Stay, 25 November
 * 2026, 03:43Z, thread 694678cf). Under the turn that called them, the agents
 * the chat asked, and indented under each the agents it asked in turn: the
 * Issue Spotter, and under it the law checker. The chat itself (Expert) is
 * never a row.
 *
 * The chain comes flat from one read (`GET /conversations/{uuid}/agent-chain`)
 * and is nested here by `parent_conversation_id`. A row whose parent is not in
 * the list, or whose depth does not follow its parent's, has nowhere to sit
 * and is left out, so a half-read list never draws an agent in the wrong place.
 */

/** Deepest a chain goes (Backend: at most 3). */
export const MAX_CHAIN_DEPTH = 3;

/** While nothing pushes the chain's changes and it is open, it is read again on this beat (Backend's fallback). */
export const CHAIN_POLL_MS = 3000;

/** One agent's row, with the agents it asked under it. */
export interface ChainNode {
  /** The agent conversation's uuid: the row's key, and what "Read the reply" opens. */
  conversationId: string;
  name: string;
  depth: number;
  state: AgentChainState;
  /** The words beside the name. */
  words: string;
  /** The turn to stream while it runs; null otherwise. */
  executionId: string | null;
  /** Whether this reader may stop it (only while it runs). */
  canStop: boolean;
  /** The start of this call's reply, as plain words, once it replied. */
  replyStart: string | null;
  replyMessageId: number | null;
  children: ChainNode[];
}

/** The words beside an agent's name for its state. A failure names who carried on: the chat at depth 1, else the agent that asked. */
export function chainRowWords(
  state: AgentChainState,
  waitingOn: Pick<AgentWaitingOn, 'agent'> | null,
  askedBy: string,
): string {
  switch (state) {
    case 'running':
      return 'Working';
    case 'waiting':
      return waitingOn ? `Waiting for ${waitingOn.agent.name}` : 'Waiting for a reply';
    case 'replied':
      return 'Replied';
    case 'stopped':
      return 'Stopped';
    case 'failed':
      return `Couldn’t reply. ${askedBy} carried on without it`;
  }
}

function node(entry: AgentChainEntry, askedBy: string, children: ChainNode[]): ChainNode {
  const executionId = entry.state === 'running' && entry.status === 'running' ? entry.execution_id : null;
  const reply = entry.state === 'replied' ? (entry.latest_call?.reply ?? null) : null;
  return {
    conversationId: entry.id,
    name: entry.agent.name,
    depth: entry.depth,
    state: entry.state,
    words: chainRowWords(entry.state, entry.waiting_on, askedBy),
    executionId,
    canStop: executionId !== null && entry.can_send,
    replyStart: reply ? plainPreview(reply.preview) || reply.preview : null,
    replyMessageId: reply?.message_id ?? null,
    children,
  };
}

/**
 * The chain as rows under a conversation's turns: the agents it called (one
 * depth below it) by the message whose turn made their newest call
 * (`latest_call.called_by_message_id`), each with the agents it asked nested
 * under it, in the list's order (oldest first). The chat is depth 0 and its
 * agents depth 1; in an agent's side panel, the agent is the parent.
 * `parentName` is who carried on when one of its agents could not reply.
 */
export function chainRowsByMessage(
  chain: Pick<AgentChain, 'agents'>,
  parentId: string,
  { parentDepth = 0, parentName = 'Lawexa' }: { parentDepth?: number; parentName?: string } = {},
): ReadonlyMap<number, readonly ChainNode[]> {
  const childrenOf = new Map<string, AgentChainEntry[]>();
  for (const entry of chain.agents) {
    const held = childrenOf.get(entry.parent_conversation_id);
    if (held) held.push(entry);
    else childrenOf.set(entry.parent_conversation_id, [entry]);
  }
  const grow = (entry: AgentChainEntry, askedBy: string): ChainNode => {
    const kids =
      entry.depth < MAX_CHAIN_DEPTH
        ? (childrenOf.get(entry.id) ?? [])
            .filter((kid) => kid.depth === entry.depth + 1)
            .map((kid) => grow(kid, entry.agent.name))
        : [];
    return node(entry, askedBy, kids);
  };

  const byMessage = new Map<number, ChainNode[]>();
  for (const entry of childrenOf.get(parentId) ?? []) {
    const calledBy = entry.latest_call?.called_by_message_id ?? null;
    if (entry.depth !== parentDepth + 1 || calledBy === null) continue;
    const row = grow(entry, parentName);
    const held = byMessage.get(calledBy);
    if (held) held.push(row);
    else byMessage.set(calledBy, [row]);
  }
  return byMessage;
}

/**
 * What the chat waits for while its chain is open, for the line at its foot:
 * the depth-1 agents still running or waiting, by name ("Waiting for Issue
 * Spotter", "… for Issue Spotter and Drafter"), and how many messages are held.
 */
export function agentsWorkingWords(chain: Pick<AgentChain, 'agents' | 'held_messages'>): string {
  const names = chain.agents
    .filter((entry) => entry.depth === 1 && (entry.state === 'running' || entry.state === 'waiting'))
    .map((entry) => entry.agent.name);
  const unique = [...new Set(names)];
  const who =
    unique.length === 0
      ? 'the agents'
      : unique.length === 1
        ? unique[0]
        : `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
  const held = chain.held_messages.length;
  const tail = held === 0 ? '' : held === 1 ? '. 1 message waits for the report' : `. ${held} messages wait for the report`;
  return `Waiting for ${who}${tail}`;
}

/**
 * Whether the chain is read again on the fallback beat: only while it is open
 * and nothing pushes its changes (the socket is down).
 */
export function chainPollMs(chain: Pick<AgentChain, 'chain_open'> | undefined, pushed: boolean): number | false {
  return chain?.chain_open && !pushed ? CHAIN_POLL_MS : false;
}
