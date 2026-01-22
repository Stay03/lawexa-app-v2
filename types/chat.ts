// Message role types
export type MessageRole = 'user' | 'assistant' | 'tool';

// Chat message interface
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
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

// Union type for all message types
export type ConversationMessage = ChatMessage | ToolMessage;

// Type guard for tool messages
export function isToolMessage(message: ConversationMessage): message is ToolMessage {
  return message.role === 'tool';
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
  conversation_id?: number;
  workflow_id?: number;
  agent_id?: number;
}

export interface ChatStartResponse {
  success: boolean;
  message: string;
  data: {
    conversation_id: number;
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
  conversationId: number | null;
  conversationTitle: string | null;
  error: string | null;
}

// API message from server (different structure than local ChatMessage)
export interface ApiMessage {
  id: number;
  conversation_id: number;
  agent_id: number | null;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  metadata: {
    type?: 'tool_call' | 'tool_result';
    tool_name?: string;
    tool_parameters?: Record<string, unknown>;
    success?: boolean;
    latency_ms?: number;
    iteration?: number;
  } | null;
  created_at: string;
}

export interface ConversationData {
  id: number;
  user_id: number;
  agent_id: number;
  title: string;
  status: 'active' | 'archived';
  messages: ApiMessage[];
  messages_count: number;
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
  id: number;
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
