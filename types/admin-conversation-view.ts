import type { AdminWorkflow, ConversationTopic, ConversationUsage } from '@/types/admin';
import type { ApiMessage, ConversationData } from '@/types/chat';

/**
 * The admin view of one chat (Stay, thread 085a980c, 25 November 2026;
 * Backend aee2efb0): the chat exactly as its owner's chat page gets it, plus
 * what only staff see. `GET /admin/conversations/{uuid}`. A Space chat is a
 * 404 here.
 */

/** A model, as the admin view names one. */
export interface AdminViewModel {
  id: number;
  name: string;
  model_id: string;
}

/** One turn's tokens, cost and model (the AI response that made the message). */
export interface AdminTurnUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  /** What the turn cost, once the provider reported it; null before. */
  actual_cost: number | null;
  provider: string | null;
  /** The figure to show: the actual cost when there is one, else the estimate. */
  cost: number;
  latency_ms: number | null;
  model: AdminViewModel | null;
}

/** What paid for a turn. Absent for staff accounts, which no pool pays for. */
export interface AdminTurnAttribution {
  /** How the message was sent: `plan`, `plan_granted`, `pack`, `pack_granted`, `free`… */
  kind: string;
  subscription?: { id: number; provider: string | null; ends_at: string | null };
  plan?: { id: number; name: string; slug: string };
  message_pack?: { id: number; provider: string | null; messages_total: number; messages_remaining: number };
  campaign?: { id: number; name: string };
  sponsor?: { id: number; name: string; slug: string };
}

/** A message as the owner gets it, with the staff facts on the rows that have them. */
export type AdminViewMessage = ApiMessage & {
  usage?: AdminTurnUsage;
  attribution?: AdminTurnAttribution;
};

/** Who owns the chat and on which plan. */
export interface AdminConversationOwner {
  uuid: string;
  name: string;
  email: string;
  /** Set when the account was deleted. */
  deleted_at: string | null;
  plan: { slug: string; name: string };
  subscription_status: string | null;
}

export interface AdminViewAgent {
  id: number;
  name: string;
  slug: string;
  model_id: number | null;
  model: AdminViewModel | null;
}

export interface AdminConversationView extends Omit<ConversationData, 'messages' | 'agent'> {
  /** Empty for a confidential chat: nothing of it is kept. */
  messages: AdminViewMessage[];
  user_uuid: string | null;
  owner: AdminConversationOwner | null;
  agent: AdminViewAgent | null;
  workflow: AdminWorkflow | null;
  attachments_count: number | null;
  usage: ConversationUsage | null;
  topics: ConversationTopic[] | null;
}

export interface AdminConversationViewResponse {
  success: boolean;
  message: string;
  data: AdminConversationView;
}

/** `GET /admin/conversations/{uuid}/messages/{id}/result`: one tool row in full, as the owner's route gives it. */
export interface AdminToolResultResponse {
  success: boolean;
  message: string;
  data: ApiMessage;
}
