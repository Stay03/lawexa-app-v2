import type { AgentConversation, AgentLatestCall } from '@/types/agent-conversations';
import { plainPreview } from '../../plain-preview';

/**
 * agent roster — the pure rules of the agents' rows in a chat (C1, Stay, 12
 * November 2026, 17:47Z; sub-agents contract, sections 2.4 and 3). Each
 * agent Lawexa messaged in a turn is a row after that turn's answer: its
 * initials, its name, its state, and Stop on the right while it works. Its
 * words stream under its name while it writes; once it has replied, the
 * start of the reply stays with "Read the reply".
 *
 * A row is one entry of the chat's list of agent conversations, which every
 * reader of the chat reads (the techlead, 12 November 2026: the rows show to
 * every reader, as Lawexa's answer does). Its newest call (`latest_call`)
 * gives the state, why it failed, the turn it sits after and the reply; the
 * entry gives the turn to stream and whether this reader may stop it
 * (`can_send`: the server's rule, never a check here).
 */

/** Where an agent is, as its row shows it. */
export type AgentRowState = 'writing' | 'replied' | 'stopped' | 'failed' | 'unfollowed';

/**
 * The row's state from the call. A failed call says why (`failure`):
 * `stopped` is a person's Stop, every other reason is "could not reply". With
 * no reason the row never guesses Stopped. A cancelled call is an older "Stop
 * waiting": the chat stopped following, the agent went on.
 */
export function agentRowState(call: Pick<AgentLatestCall, 'state' | 'failure'>): AgentRowState {
  switch (call.state) {
    case 'working':
      return 'writing';
    case 'replied':
      return 'replied';
    case 'cancelled':
      return 'unfollowed';
    default:
      return call.failure === 'stopped' ? 'stopped' : 'failed';
  }
}

/** The state's words beside the agent's name (the C1 pictures, agreed with the techlead). */
export const AGENT_ROW_WORDS: Readonly<Record<AgentRowState, string>> = {
  writing: 'Writing',
  replied: 'Replied',
  stopped: 'Stopped',
  failed: 'Couldn’t reply. Lawexa carried on without it',
  unfollowed: 'Lawexa stopped waiting for it',
};

/** "Issue Spotter" reads "IS", "Expert" "EX", "a fresh Lawexa" "LA". */
export function agentInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  // Lower-case lead words ("a fresh Lawexa") are skipped when a capitalised one follows.
  const named = words.filter((word) => word.charAt(0) !== word.charAt(0).toLowerCase());
  const pick = named.length > 0 ? named : words;
  if (pick.length === 0) return '?';
  if (pick.length === 1) return pick[0].slice(0, 2).toUpperCase();
  return (pick[0].charAt(0) + pick[1].charAt(0)).toUpperCase();
}

/** One agent's row. */
export interface AgentRow {
  /** The agent conversation's uuid: the row's key, and what "Read the reply" and "Open its conversation" open. */
  conversationId: string;
  name: string;
  state: AgentRowState;
  /** The turn to stream while it writes; null once it ends. */
  executionId: string | null;
  /** Whether this reader may stop the turn (`can_send`, contract 2.4). */
  canStop: boolean;
  /** The start of the reply, as plain words, once it replied. */
  replyStart: string | null;
}

/** A called entry's row. A turn is streamed only while the call is working and the turn still runs. */
export function agentRow(entry: AgentConversation & { latest_call: AgentLatestCall }): AgentRow {
  const state = agentRowState(entry.latest_call);
  const executionId = state === 'writing' && entry.status === 'running' ? entry.execution_id : null;
  const preview = state === 'replied' ? (entry.latest_call.reply?.preview ?? null) : null;
  return {
    conversationId: entry.id,
    name: entry.agent.name,
    state,
    executionId,
    canStop: executionId !== null && entry.can_send,
    replyStart: preview ? plainPreview(preview) || preview : null,
  };
}

/**
 * The rows by the message whose turn made each agent's newest call
 * (`called_by_message_id`; an agent called again later moves to that turn),
 * in the list's order (oldest first), so two agents called at once are two
 * rows. An entry no agent called, or whose calling message is gone, has no
 * turn to sit after, and no row.
 */
export function agentRowsByMessage(entries: readonly AgentConversation[]): ReadonlyMap<number, readonly AgentRow[]> {
  const byMessage = new Map<number, AgentRow[]>();
  for (const entry of entries) {
    const call = entry.latest_call;
    if (!call || call.called_by_message_id === null) continue;
    const row = agentRow({ ...entry, latest_call: call });
    const held = byMessage.get(call.called_by_message_id);
    if (held) held.push(row);
    else byMessage.set(call.called_by_message_id, [row]);
  }
  return byMessage;
}

/** Whether an agent in the list is still working: the list is read again on a beat until none is (Backend's rule). */
export function agentsWorking(entries: readonly Pick<AgentConversation, 'latest_call'>[]): boolean {
  return entries.some((entry) => entry.latest_call?.state === 'working');
}
