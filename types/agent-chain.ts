/**
 * The agent chain of a chat (Stay, 25 November 2026, 03:43Z, thread 694678cf;
 * contract agreed with Backend the same night). One read gives every agent a
 * chat's turns called, at every depth, flat: the page nests them by
 * `parent_conversation_id`. The chat itself (Expert) is never in the list.
 *
 * While the chain is open (any agent works or waits), a message the person
 * sends is held: saved, charged, shown at once, and answered with the report
 * when it comes back, or at once on Stop.
 */

import type { AgentConversation } from './agent-conversations';
import type { AgentRef } from './background-jobs';

/**
 * Where an agent is, for the row's look. `waiting`: its own turn ended and it
 * waits for an agent it called. A cancelled call reads `stopped`.
 */
export type AgentChainState = 'running' | 'waiting' | 'replied' | 'failed' | 'stopped';

/** The agent a held message, or a waiting agent, waits for. */
export interface AgentWaitingOn {
  agent_conversation_id: string;
  handle: string;
  agent: AgentRef;
}

/**
 * One agent conversation in the chain: the row the agent-conversations list
 * gives (same resource, at every depth), with its state and what it waits on.
 * `latest_call.called_by_message_id` is the message in the calling
 * conversation (the chat at depth 1, the parent agent's below) whose turn made
 * the newest call.
 */
export interface AgentChainEntry extends AgentConversation {
  state: AgentChainState;
  /** While `waiting`: the agent it waits for. */
  waiting_on: AgentWaitingOn | null;
}

/** A message the person sent while the chain was open, waiting for the report. */
export interface HeldMessage {
  id: number;
  created_at: string;
  waiting_on: AgentWaitingOn;
}

/** `GET /conversations/{uuid}/agent-chain`. */
export interface AgentChain {
  agents: AgentChainEntry[];
  /** Oldest first. */
  held_messages: HeldMessage[];
  /** True while any agent in the chain runs or waits: a send is held. */
  chain_open: boolean;
}

export interface AgentChainResponse {
  success: boolean;
  message: string;
  data: AgentChain;
}

/** `POST /conversations/{uuid}/agent-chain/stop`: the turn answering the held messages, if any were held. */
export interface AgentChainStopResponse {
  success: boolean;
  message: string;
  data: { execution_id: string | null };
}

/**
 * Broadcast as `agent_chain.changed` on `private-users.{owner uuid}`, and for
 * a Space chat on `private-spaces.{space uuid}` too: read the chain again.
 */
export interface AgentChainChangedEvent {
  conversation_id: string;
  chain_open: boolean;
  held_count: number;
}

/** Broadcast as `held_messages.answered` once the turn answering held messages starts (the wake, or Stop's). */
export interface HeldMessagesAnsweredEvent {
  conversation_id: string;
  message_ids: number[];
  execution_id: string;
}

/** A user message in the history: held while the chain is open, answered once a turn takes it. Ordinary ones have no state. */
export interface HeldMessageFields {
  state?: 'held' | 'answered';
  waiting_on?: AgentWaitingOn | null;
  answered_by_execution_id?: string | null;
}
