// Message role types
export type MessageRole = 'user' | 'assistant' | 'tool';

// Attachment on a message (PDF file)
export interface MessageAttachment {
  file_id: number;
  file_name: string;
  file_size: number;
}

// Chat message interface
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  attachment?: MessageAttachment;
}

// Tool message extends ChatMessage with tool-specific data
export interface ToolMessage extends ChatMessage {
  role: 'tool';
  toolName: string;
  toolParameters: Record<string, unknown>;
  toolResult?: ToolResult;
  toolStatus: 'calling' | 'complete';
  latencyMs?: number;
}

// Handover message - when orchestrator delegates to a sub-agent
export interface HandoverMessage extends ChatMessage {
  role: 'assistant';
  messageType: 'handover';
  agentSlug: string;
  task: string;
  handoverStatus: 'active' | 'complete';
  handoverType?: 'consult' | 'transfer';
  latencyMs?: number;
  success?: boolean;
  handoverResultContent?: string;
}

// Union type for all message types
export type ConversationMessage = ChatMessage | ToolMessage | HandoverMessage;

// Type guard for tool messages
export function isToolMessage(message: ConversationMessage): message is ToolMessage {
  return message.role === 'tool';
}

// Type guard for handover messages
export function isHandoverMessage(message: ConversationMessage): message is HandoverMessage {
  return (message as HandoverMessage).messageType === 'handover';
}

// Tool call types (from API spec)
export interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  error: string | null;
}

// Tool call display state
export interface ToolCallEvent {
  name: string;
  parameters: Record<string, unknown>;
  result?: ToolResult;
  status: 'calling' | 'complete';
  latencyMs?: number;
}

// SSE Event types
export interface ConnectedEvent {
  execution_id: string;
  message: string;
}

export interface IterationEvent {
  iteration: number;
  status: 'processing';
  timestamp: string;
}

export interface ToolCallingEvent {
  iteration: number;
  status: 'tool_calling';
  tool_call: ToolCall;
  timestamp: string;
}

export interface ToolCompleteEvent {
  iteration: number;
  status: 'tool_complete';
  tool_call: ToolCall;
  tool_result: ToolResult;
  latency_ms: number;
  timestamp: string;
}

export interface CompletedEvent {
  iteration: number;
  status: 'completed';
  message: string;
  tokens: {
    prompt: number;
    completion: number;
  };
  timestamp: string;
}

export interface HandoverStartedEvent {
  iteration: number;
  status: 'handover_started';
  agent_slug: string;
  query: string;
  handover_type?: 'consult' | 'transfer';
  timestamp: string;
}

export interface HandoverCompleteEvent {
  iteration: number;
  status: 'handover_complete';
  agent_slug: string;
  success: boolean;
  response_preview?: string;
  latency_ms: number;
  handover_type?: 'consult' | 'transfer';
  timestamp: string;
}

export interface HeartbeatEvent {
  timestamp: string;
}

export interface ErrorEvent {
  message: string;
}

// Chat API request/response types
export interface ChatStartRequest {
  message: string;
  stream: boolean;
  conversation_id?: string;
  workflow_id?: number;
  agent_id?: number;
  study_mode?: boolean;
  file_id?: number;
}

export interface ChatStartResponse {
  success: boolean;
  message: string;
  data: {
    conversation_id: string;
    workflow_id: number;
    execution_id: string;
    stream_url: string;
  };
}

// Hook options
export interface UseChatStreamOptions {
  onConnected?: () => void;
  onIteration?: (event: IterationEvent) => void;
  onToolCalling?: (event: ToolCallingEvent) => void;
  onToolComplete?: (event: ToolCompleteEvent) => void;
  onCompleted?: (event: CompletedEvent) => void;
  onError?: (error: string) => void;
}

// Chat state for hook
export interface ChatState {
  messages: ConversationMessage[];
  isStreaming: boolean;
  isLoadingHistory: boolean;
  conversationId: string | null;
  conversationTitle: string | null;
  error: string | null;
}

// API message from server (different structure than local ChatMessage)
export interface ApiMessage {
  id: number;
  conversation_id: string;
  agent_id: number | null;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  metadata: {
    type?: 'tool_call' | 'tool_result' | 'handover' | 'handover_result';
    tool_name?: string;
    tool_parameters?: Record<string, unknown>;
    success?: boolean;
    latency_ms?: number;
    iteration?: number;
    context?: 'handover';
    target_agent?: string;
    agent_slug?: string;
    task?: string;
    parent_agent?: number;
    handover_type?: 'consult' | 'transfer';
  } | null;
  attachment?: MessageAttachment;
  created_at: string;
}

// Document upload response (POST /api/files/documents)
export interface DocumentUploadResponse {
  data: {
    id: number;
    original_name: string;
    filename: string;
    mime_type: string;
    size: number;
    category: string;
    upload_status: string;
    url: string;
  };
  message: string;
}

export interface ConversationData {
  id: string;
  user_id: number;
  agent_id: number;
  title: string;
  status: 'active' | 'archived';
  is_private: boolean;
  messages: ApiMessage[];
  messages_count: number;
  views_count?: number;
  author?: ConversationAuthor;
  agent?: ConversationAgentSummary;
  created_at: string;
  updated_at: string;
}

export interface ConversationResponse {
  success: boolean;
  message: string;
  data: ConversationData;
}

// Conversation list item (without full messages)
export interface ConversationListItem {
  id: string;
  user_id: number;
  agent_id: number;
  title: string;
  status: 'active' | 'archived';
  messages_count: number;
  created_at: string;
  updated_at: string;
}

// List conversations response
export interface ConversationsListResponse {
  success: boolean;
  message: string;
  data: ConversationListItem[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

// Query parameters for listing conversations
export interface ListConversationsParams {
  per_page?: number;
  status?: 'active' | 'archived';
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// Conversation Sharing Types
// ============================================

// Author information for shared conversations
export interface ConversationAuthor {
  id: number;
  name: string;
  avatar_url: string | null;
}

// Agent summary for shared conversations
export interface ConversationAgentSummary {
  id: number;
  name: string;
  slug: string;
}

// Shared conversation list item (for browse page)
export interface SharedConversationItem {
  id: string;
  title: string;
  is_private: boolean;
  messages_count: number;
  views_count: number;
  author: ConversationAuthor;
  agent?: ConversationAgentSummary;
  created_at: string;
  updated_at: string;
}

// Trending conversation item
export interface TrendingConversationItem extends SharedConversationItem {
  type: 'conversation';
  trending_score: number;
  unique_viewers: number;
  last_viewed_at: string | null;
}

// Shared conversations API response
export interface SharedConversationsResponse {
  success: boolean;
  message: string;
  data: SharedConversationItem[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

// Trending conversations API response
export interface TrendingConversationsResponse {
  success: boolean;
  message: string;
  data: TrendingConversationItem[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta?: {
    filters_applied?: {
      time_range: string;
    };
  };
}

// Visibility change response
export interface ConversationVisibilityResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    user_id: number;
    agent_id: number;
    title: string;
    status: 'active' | 'archived';
    is_private: boolean;
    created_at: string;
    updated_at: string;
  };
}

// Query params for shared conversations
export interface SharedConversationsParams {
  page?: number;
  per_page?: number;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

// Query params for trending conversations
export interface TrendingConversationsParams {
  page?: number;
  per_page?: number;
  time_range?: 'day' | 'week' | 'month' | 'year' | 'all';
}
