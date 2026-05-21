import type { JurisdictionChoice } from './jurisdiction';

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
  // Marks a message that was cut short mid-stream (cancelled or errored).
  // content holds the partial text the user saw before the stream ended.
  partial?: {
    reason: 'cancelled' | 'error' | 'timeout';
  };
}

// Tool message extends ChatMessage with tool-specific data
export interface ToolMessage extends ChatMessage {
  role: 'tool';
  toolName: string;
  toolParameters: Record<string, unknown>;
  toolResult?: ToolResult;
  toolStatus: 'calling' | 'complete';
  latencyMs?: number;
  agentSlug?: string;
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
  // Ephemeral: holds in-progress streaming text from the specialist while handover is active
  streamingContent?: string;
}

// Error message - when the backend reports a stream or API error
export interface ErrorMessage extends ChatMessage {
  role: 'assistant';
  messageType: 'error';
  errorCode: string;
  retryable: boolean;
  retryAfterMs: number | null;
}

// Narration message - orchestrator commentary saved between phases
export interface NarrationMessage extends ChatMessage {
  role: 'assistant';
  messageType: 'narration';
  agentSlug?: string;
}

// Union type for all message types
export type ConversationMessage = ChatMessage | ToolMessage | HandoverMessage | ErrorMessage;

// Type guard for tool messages
export function isToolMessage(message: ConversationMessage): message is ToolMessage {
  return message.role === 'tool';
}

// Type guard for handover messages
export function isHandoverMessage(message: ConversationMessage): message is HandoverMessage {
  return (message as HandoverMessage).messageType === 'handover';
}

// Type guard for error messages
export function isErrorMessage(message: ConversationMessage): message is ErrorMessage {
  return (message as ErrorMessage).messageType === 'error';
}

// Type guard for narration messages
export function isNarrationMessage(message: ConversationMessage): message is NarrationMessage {
  return (message as NarrationMessage).messageType === 'narration';
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
  accumulated_text?: string;
}

export interface IterationEvent {
  iteration: number;
  status: 'processing';
  timestamp: string;
}

export interface ToolCallingEvent {
  seq?: number;
  iteration: number;
  status: 'tool_calling';
  tool_call: ToolCall;
  timestamp: string;
  context?: 'handover';
  agent_slug?: string;
}

export interface ToolCompleteEvent {
  seq?: number;
  iteration: number;
  status: 'tool_complete';
  tool_call: ToolCall;
  tool_result: ToolResult;
  latency_ms: number;
  timestamp: string;
  context?: 'handover';
  agent_slug?: string;
}

// Canonical summary shape emitted by v2_stream completed events
export interface CompletedSummary {
  total_tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  total_cost: number;
  total_latency_ms: number;
  // Present only when handovers occurred
  orchestrator_tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  orchestrator_cost?: number;
}

export interface CompletedEvent {
  seq?: number;
  iteration: number;
  status: 'completed';
  // Canonical in v2_stream — read this
  content?: string;
  // Legacy alias (still sent by backend for backward compat)
  message?: string;
  // Canonical token/cost summary in v2_stream
  summary?: CompletedSummary;
  // Legacy alias
  tokens?: {
    prompt: number;
    completion: number;
  };
  // Late-connect / SSE-replay flag. Always present on the terminal event
  // emitted from the DB. true = server has content (event.content is set).
  // false = server discarded the content (confidential mode); client must
  // fall back to local IndexedDB transcript.
  replayable?: boolean;
  timestamp: string;
}

// Terminal event emitted by backend when a streaming execution is cancelled
// via POST /api/chat/stream/{executionId}/cancel. This is authoritative — the
// UI must wait for this (or another terminal event) before closing the stream.
export interface CancelledEvent {
  seq?: number;
  iteration?: number;
  status?: 'cancelled';
  timestamp?: string;
}

// v2_stream token-level streaming events
export interface TextDeltaEvent {
  delta: string;
  iteration: number;
  timestamp: string;
  seq?: number; // ordering hint only — never use for dedup
  agent_slug?: string; // present when text is from a specialist sub-agent
}

export interface TextDoneEvent {
  iteration: number;
  timestamp: string;
  seq?: number;
  agent_slug?: string;
}

export interface TextResetEvent {
  iteration: number;
  timestamp: string;
  seq?: number;
  agent_slug?: string;
  reason?: string;
  text_type?: 'response' | 'narration';
  accumulated_text?: string;
}

export interface HandoverStartedEvent {
  seq?: number;
  iteration: number;
  status: 'handover_started';
  agent_slug: string;
  query: string;
  handover_type?: 'consult' | 'transfer';
  timestamp: string;
}

export interface HandoverCompleteEvent {
  seq?: number;
  iteration: number;
  status: 'handover_complete';
  agent_slug: string;
  success: boolean;
  response_preview?: string;
  content?: string;
  latency_ms: number;
  handover_type?: 'consult' | 'transfer';
  timestamp: string;
}

export interface ThinkingEvent {
  iteration: number;
  timestamp: string;
  seq?: number;
}

export interface HeartbeatEvent {
  timestamp: string;
}

export interface ErrorEvent {
  iteration?: number;
  status?: string;
  error_code?: string;
  error_message?: string;
  message?: string;
  timestamp?: string;
}

// Pending response (409) from POST /api/chat
export interface PendingResponseData {
  conversation_id: string;
  execution_id: string | null;
  stream_url: string | null;
  pending_since: string;
}

// Conversation status endpoint (GET /api/conversations/{uuid}/status)
export interface ConversationStatusData {
  status: 'idle' | 'pending' | 'completed' | 'failed' | 'expired';
  messages: ApiMessage[];
  execution_id: string | null;
  stream_url: string | null;
  pending_since: string | null;
}

export interface ConversationStatusResponse {
  success: boolean;
  message: string;
  data: ConversationStatusData;
}

// Prior-turn entry sent in the `messages` array for confidential chats.
// The device owns the transcript; server reads but does not store these.
export interface ConfidentialHistoryEntry {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

// Chat API request/response types
export interface ChatStartRequest {
  message: string;
  stream: boolean;
  // Opt-in token-level streaming. When set, backend emits text_delta events.
  stream_mode?: 'v2_stream';
  conversation_id?: string;
  workflow_id?: number;
  agent_id?: number;
  study_mode?: boolean;
  file_id?: number;
  // Three-state field. Absent = backend auto-resolves from profile/IP.
  // String = override with that jurisdiction slug. Explicit null =
  // skip jurisdiction injection (comparative / academic mode).
  jurisdiction?: string | null;
  // Confidential mode: set once at conversation creation (turn 1). Immutable
  // afterwards — sending on an existing conversation returns 422.
  is_confidential?: boolean;
  // Prior transcript for confidential chats. Required (even as []) on every
  // confidential turn. Forbidden for non-confidential — server returns 422.
  messages?: ConfidentialHistoryEntry[];
}

export interface ChatStartResponse {
  success: boolean;
  message: string;
  data: {
    conversation_id: string;
    workflow_id: number;
    execution_id: string;
    stream_url: string;
    // Echoed back by backend to confirm what's active
    stream_mode?: 'v2_stream' | null;
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
  onHistoryLoaded?: (data: ConversationData) => void;
  onNarration?: (text: string, agentSlug?: string) => void;
}

// Options for the send() method
export interface SendMessageOptions {
  conversationId?: string;
  fileId?: number;
  attachment?: MessageAttachment;
  studyMode?: boolean;
  workflowId?: number;
  // Opt-in token streaming; forwarded into ChatStartRequest.stream_mode
  streamMode?: 'v2_stream';
  // Per-conversation jurisdiction choice. Translated into the wire field
  // by applyJurisdiction() at send time.
  jurisdiction?: JurisdictionChoice;
  // Set on turn 1 when the user opted into confidential mode on the home page.
  // The hook reads the prior transcript from IndexedDB on subsequent turns.
  isConfidential?: boolean;
}

// Chat state for hook
export interface ChatState {
  messages: ConversationMessage[];
  isStreaming: boolean;
  // Optimistic flag between clicking Stop (cancel POST fired) and the
  // authoritative terminal SSE event (`cancelled`/`completed`/`error`/`timeout`).
  isCancelling: boolean;
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
    type?: 'tool_call' | 'tool_result' | 'handover' | 'handover_result' | 'error' | 'narration';
    tool_name?: string;
    tool_parameters?: Record<string, unknown>;
    success?: boolean;
    latency_ms?: number;
    iteration?: number;
    seq?: number;
    context?: 'handover';
    target_agent?: string;
    agent_slug?: string;
    task?: string;
    parent_agent?: number;
    handover_type?: 'consult' | 'transfer';
    // Error message fields
    error_code?: string;
    retryable?: boolean;
    retry_after_ms?: number | null;
    execution_id?: string;
    // Partial message fields (streaming cancel/error with rescued text buffer).
    // When partial === true, content holds the actual partial assistant text
    // the user saw stream in. reason describes why it was cut short.
    partial?: boolean;
    reason?: 'cancelled' | 'error' | 'timeout';
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
  is_confidential?: boolean;
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
  is_private: boolean;
  is_confidential?: boolean;
  agent: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
  };
  messages_count: number;
  created_at: string;
  updated_at: string;
}

// List conversations response
export interface ConversationsListResponse {
  success: boolean;
  message: string;
  data: ConversationListItem[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

// Query parameters for listing conversations
export interface ListConversationsParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: 'active' | 'archived';
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

// Activity / message-history endpoint (GET /api/messages)
export interface ActivityMessage extends ApiMessage {
  conversation: { uuid: string; title: string };
}

export interface ListMessagesParams {
  page?: number;
  per_page?: number;
  sort_order?: 'asc' | 'desc';
  conversation_id?: string;
  role?: 'user' | 'assistant' | 'tool';
  search?: string;
  exclude_errors?: boolean;
}

export interface MessagesListResponse {
  success: boolean;
  message: string;
  data: ActivityMessage[];
  pagination: ConversationsListResponse['pagination'];
  links: ConversationsListResponse['links'];
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
