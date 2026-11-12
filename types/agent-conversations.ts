/**
 * Agent conversations (sub-agents contract, docs/api/sub-agents-contract.md,
 * section 3). Lawexa messages another agent with `message_agent`; the agent
 * answers in an agent conversation of its own: a normal conversation, owned
 * by the same person, hidden from every chat list, read through the chat that
 * started it. The person can open it beside the chat, watch it stream and
 * type into it.
 */

import type { AgentRef, BackgroundJobFailure } from './background-jobs';

/**
 * The newest call to an agent conversation (Backend, 12 November 2026, for
 * C1): from that call's background job, whoever's it is, so every reader of
 * the chat sees the same.
 */
export interface AgentLatestCall {
  state: 'working' | 'replied' | 'failed' | 'cancelled';
  /** Why it failed; null unless `state` is `failed`. */
  failure: BackgroundJobFailure | null;
  /** The parent chat's message whose turn made this call; null once that message is gone. */
  called_by_message_id: number | null;
  called_at: string;
  /** This call's own reply; null until it replies, and when it failed or was cancelled. */
  reply: { message_id: number; preview: string; created_at: string } | null;
}

/** `AgentConversationResource`: one agent conversation, as the list (3.1) and a send (3.3) return it. */
export interface AgentConversation {
  /** Its uuid: what every route takes. */
  id: string;
  parent_conversation_id: string;
  agent: AgentRef & { description?: string | null };
  title: string;
  /** 1 to 3. */
  depth: number;
  /** `running` while a turn is unfinished. */
  status: 'running' | 'idle';
  /** The running turn, to watch; null when idle. */
  execution_id: string | null;
  stream_url: string | null;
  /** The parent chat's message whose turn opened it; null once that message is gone. */
  started_by_message_id: number | null;
  last_reply: { message_id: number; preview: string; created_at: string } | null;
  /** The newest call to it; null when no agent ever called it (C1). */
  latest_call: AgentLatestCall | null;
  messages_count: number;
  /** Whether the reader may type into it. */
  can_send: boolean;
  created_at: string;
  last_message_at: string | null;
}

/** `GET /conversations/{uuid}/agent-conversations`: its direct children, oldest first. */
export interface AgentConversationListResponse {
  success: boolean;
  message: string;
  data: { agent_conversations: AgentConversation[] };
}

/** `POST /agent-conversations/{uuid}/messages`. */
export interface AgentConversationSendResponse {
  success: boolean;
  message: string;
  data: {
    conversation_id: string;
    execution_id: string;
    stream_url: string;
    stream_mode: 'v2_stream';
    user_message_id: number;
    /** Redacted conversations only: the stored form of what was typed. */
    user_message_content?: string;
    agent_conversation: AgentConversation;
  };
}
