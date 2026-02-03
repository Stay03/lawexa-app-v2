// Admin Conversation Management Types
// Based on API documentation: /docs/apiDocs/admin-conversation-api-documentation.md

export interface ConversationUsage {
  total_cost: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface MessageUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  latency_ms: number;
}

export interface AdminAgent {
  id: number;
  model_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  temperature: string | null;
  max_response_tokens: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminWorkflow {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  execution_mode: string | null;
  orchestrator_agent_id: number | null;
  is_default: boolean | null;
  is_active: boolean | null;
  orchestrator_agent: AdminAgent | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminMessageMetadata {
  type?: 'tool_call' | 'tool_result';
  tool_name?: string;
  tool_parameters?: Record<string, unknown>;
  success?: boolean;
  latency_ms?: number;
  iteration?: number;
}

export interface AdminMessage {
  id: number;
  agent_id: number | null;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  metadata: AdminMessageMetadata | null;
  usage?: MessageUsage | null;
  created_at: string;
}

export interface AdminConversationListItem {
  id: string;
  user_uuid: string;
  title: string | null;
  status: 'active' | 'archived';
  is_private: boolean;
  agent: AdminAgent | null;
  workflow: AdminWorkflow | null;
  messages_count: number;
  usage: ConversationUsage;
  created_at: string;
  updated_at: string;
}

export interface AdminConversationDetail extends AdminConversationListItem {
  messages: AdminMessage[];
}

// Query Parameters
export interface AdminConversationsParams {
  status?: 'active' | 'archived';
  is_private?: boolean;
  user_uuid?: string;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// Pagination
export interface AdminConversationsPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
}

export interface AdminConversationsLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

// API Responses
export interface AdminConversationsListResponse {
  success: boolean;
  message: string;
  data: AdminConversationListItem[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminConversationDetailResponse {
  success: boolean;
  message: string;
  data: AdminConversationDetail;
}
