import type { JurisdictionChoice } from './jurisdiction';
import type { IBlockedReason } from './message-pack';

// Message role types
export type MessageRole = 'user' | 'assistant' | 'tool';

// Attachment on a message (a document or a picture)
export interface MessageAttachment {
  file_id: number;
  file_name: string;
  file_size: number;
  /**
   * Known for a file uploaded in this session (the upload answers with it) and
   * for a history row (read from `metadata.files`, see {@link ApiMessageFile}).
   * Absent on older confidential transcripts, which stored only the three
   * fields above; a reader then falls back to the file name's extension.
   */
  mime_type?: string;
}

/**
 * One entry of a user message's `metadata.files`, as `ChatController` writes it
 * (read from lawexa-api-v3 main, 24 September 2026). The message resource's
 * `attachments` list keeps only id, name and size, so this is where the type
 * lives. `rendered_from_file_id` marks a page picture the server made from a
 * scanned PDF; the PDF itself is not listed beside it.
 */
export interface ApiMessageFile {
  file_id: number;
  file_name: string;
  file_size: number;
  file_mime_type?: string;
  is_image?: boolean;
  rendered_from_file_id?: number;
}

// Chat message interface
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  // Canonical multi-attachment shape. Always check `attachments` first.
  attachments?: MessageAttachment[];
  // Legacy alias for renderers not migrated yet — always equals attachments[0].
  attachment?: MessageAttachment;
  // Marks a message that was cut short mid-stream (cancelled or errored).
  // content holds the partial text the user saw before the stream ended.
  partial?: {
    reason: 'cancelled' | 'error' | 'timeout';
  };
  /**
   * Who asked, on a user turn read from the server (backend B4, see
   * {@link ApiMessage.author}). Absent on a turn this client drew itself and on
   * a server before B4; `null` when the server withholds the writer.
   */
  author?: ConversationAuthor | null;
  /**
   * Set on the user turn this client drew itself, before the server's copy
   * replaces it: the only row that is the reader's without an author. A row
   * that merely lacks `author` is not assumed to be the reader's.
   */
  drawnHere?: true;
  /**
   * An answer the server stored as a Radar report (`metadata.type`
   * "radar_report", written by the Radar scan). Drawn as an answer, with a
   * small "Radar report" label above it.
   */
  kind?: 'radar_report';
  /**
   * The message this turn answers (space chat replies, 14 October 2026): the
   * server's {@link ApiMessage.reply_to}, or, on the row this client drew, the
   * target the writer picked. Absent when the turn replies to nothing.
   */
  replyTo?: MessageReplyTo;
  /**
   * The people this question tags (space chats): the server's
   * {@link ApiMessage.mentions}. A reader outside the space gets names only,
   * with the `@handle`s in the text already written as names.
   */
  mentions?: MessageMention[];
  /** Handles the writer typed that matched nobody in the space: on their own rows only. */
  unmatchedHandles?: string[];
  /**
   * What redaction hid in this user turn, in a redacted chat: the POST's
   * `redaction`, or the stored `metadata.redaction` on a reload. Absent in other
   * chats and on redacted turns from before the server sent it.
   */
  redaction?: RedactionSummary;
}

/**
 * What the server's redaction hid in one user turn (backend contract, 22
 * October 2026). `details_hidden` is the count the reader sees; `by_type` maps
 * a kind (PERSON, ADDRESS, PHONE, EMAIL, DOB, ACCOUNT, BVN, NIN, PASSPORT,
 * LICENSE, TAX_ID, MEDICAL, ORG, CASE_NUMBER, OTHER) to how many of it.
 */
export interface RedactionSummary {
  details_hidden: number;
  places_replaced: number;
  by_type: Record<string, number>;
}

/**
 * The message a reply quotes (techlead's contract, 14 October 2026). `author`
 * follows the rule of {@link ApiMessage.author}: `null` for an answer of
 * Lawexa's and for a writer withheld from the reader. A deleted target keeps
 * its role, with no preview and `is_unavailable` set.
 */
export interface MessageReplyTo {
  id: number;
  role: 'user' | 'assistant';
  author: ConversationAuthor | null;
  preview: string | null;
  is_unavailable: boolean;
}

/** A person tagged in a space chat message. A reader outside the space gets the name only. */
export interface MessageMention {
  uuid?: string;
  name: string;
  username?: string;
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
  /**
   * The step's result was left out of the chat download (v2 asks for
   * `?results=lazy`): `toolResult.data` is null, and the result is fetched
   * from `/conversations/{id}/messages/{messageId}/result` when the step is
   * opened. Absent when the result came with the chat or the live stream.
   */
  resultRef?: { messageId: number; size: number | null };
  /** A `read_statute` step's statute name, kept for its label when the result is not loaded. */
  statuteTitle?: string;
  /** The title of the note or case a read step opened, from the result's
   *  metadata, so a closed step can name it without loading the result. */
  entityTitle?: string;
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
  /** The server's block when the send was refused for messages (the reason,
   *  the reset time); absent for every other error. */
  blocked?: IBlockedReason | null;
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
  /** See {@link TerminalEvent.persisted_message_ids}. */
  persisted_message_ids?: number[];
}

// Terminal event emitted by backend when a streaming execution is cancelled
// via POST /api/chat/stream/{executionId}/cancel. This is authoritative — the
// UI must wait for this (or another terminal event) before closing the stream.
export interface CancelledEvent {
  seq?: number;
  iteration?: number;
  status?: 'cancelled';
  timestamp?: string;
  /** See {@link TerminalEvent.persisted_message_ids}. */
  persisted_message_ids?: number[];
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
  /** See {@link TerminalEvent.persisted_message_ids}. */
  persisted_message_ids?: number[];
}

/**
 * The three events that END a stream all carry the ids of every message the
 * execution saved (backend `docs/streaming/persisted-message-ids.md`, 2026-07-25).
 *
 * WHAT IT IS FOR. A client draws its rows from the stream before the server has
 * saved anything, so those rows have no server identity — and the user's own
 * message is never delivered as a stream event at all, so nothing else could ever
 * supply it. This list is what lets a screen that has sent a turn tell "the
 * server's copy of a row I am already showing" apart from "a new row from another
 * tab", which is the whole of the cross-tab merge.
 *
 * IDS, NOT `seq`. `seq` was asked for first and the backend correctly refused it:
 * it restarts at 1 on every turn (so it collides with earlier turns in the same
 * conversation) and it is absent from both the user's message and the final
 * assistant answer — the two rows the feature exists for. These are `Message.id`
 * values, which appear on every row of `GET /api/conversations/{id}`.
 *
 * SEMANTICS: every row the turn wrote (user message, tool calls and results,
 * handovers, narration, the answer); present on all three delivery paths (live
 * relay, catchup replay, rebuilt-from-database); `[]` for confidential
 * conversations, which persist nothing. Order and repeats are not meaningful —
 * treat it as a set.
 *
 * KNOWN LIMIT (backend §7): the client-side `timeout` event does NOT carry it,
 * because nothing is finalized at that moment. The authoritative terminal event
 * received on reconnect does.
 */
export interface TerminalEvent {
  persisted_message_ids?: number[];
}

/** The member whose turn is running in a chat (backend B4, `execution_user`). */
export interface ConversationTurnUser {
  id: number;
  name: string;
}

/**
 * The user message a running turn answers (backend B4, `pending_message`):
 * its id, the first 140 characters of it, and who wrote it (`null` when the
 * server withholds the writer).
 */
export interface PendingUserMessage {
  id: number;
  preview: string;
  author_id: number | null;
}

// Pending response (409) from POST /api/chat. While another send holds the
// chat but has not made its request yet, every field but `execution_user` is
// null (backend B4).
export interface PendingResponseData {
  conversation_id: string | null;
  execution_id: string | null;
  stream_url: string | null;
  pending_since: string | null;
  /** Who is generating (backend B4); absent on a server before B4. */
  execution_user?: ConversationTurnUser | null;
  /** The message being answered (backend B4); absent on a server before B4. */
  pending_message?: PendingUserMessage | null;
}

// Conversation status endpoint (GET /api/conversations/{uuid}/status)
export interface ConversationStatusData {
  status: 'idle' | 'pending' | 'completed' | 'failed' | 'expired';
  messages: ApiMessage[];
  execution_id: string | null;
  stream_url: string | null;
  /** When the latest turn started. It stays set after the turn ends (B4). */
  pending_since: string | null;
  /**
   * The latest turn's sender (backend B4). It stays set after the turn ends,
   * so it names who is asking only while `status` is `'pending'`.
   */
  execution_user?: ConversationTurnUser | null;
  /** The message being answered; non-null only while `status` is `'pending'`. */
  pending_message?: PendingUserMessage | null;
  /** Whether THIS reader may stop the running turn: its sender only (B4). */
  can_cancel?: boolean;
  /**
   * The id of the chat's latest user message, `null` when it has none (backend
   * 1135730). A change between two reads is a turn that began, even one that
   * also ended between them.
   */
  last_message_id?: number | null;
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

// Id-native way to tie a new chat to the content it's about (case/statute/note
// via slug, radar/radar_scan via uuid). Replaces the legacy <case_slug> message
// tags and is the only way to tie radar / radar_scan. Validated server-side
// before the turn runs; sticky & idempotent.
export type ChatReferenceType = 'case' | 'statute' | 'note' | 'radar' | 'radar_scan';

export interface ChatReference {
  type: ChatReferenceType;
  id: string;
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
  // Legacy single-file field. Prefer `file_ids` for new code. The server
  // returns 422 if both are populated with non-empty values.
  file_id?: number;
  // Canonical multi-file field. Up to 10 IDs per turn; duplicates are
  // silently deduped server-side.
  file_ids?: number[];
  // Three-state field. Absent = backend auto-resolves from profile/IP.
  // String = override with that jurisdiction slug. Explicit null =
  // skip jurisdiction injection (comparative / academic mode).
  jurisdiction?: string | null;
  // Confidential mode: set once at conversation creation (turn 1). Immutable
  // afterwards — sending on an existing conversation returns 422.
  is_confidential?: boolean;
  // Redacted mode: same sticky-on-turn-1 contract as is_confidential. Composes
  // with it. Server replaces the message text with the redacted form before
  // persistence and before the LLM call.
  is_redacted?: boolean;
  // Prior transcript for confidential chats. Required (even as []) on every
  // confidential turn. Forbidden for non-confidential — server returns 422.
  messages?: ConfidentialHistoryEntry[];
  // Tie this new conversation to the content it's about. Sent on the first
  // turn only (the link is sticky); merged + deduped server-side.
  references?: ChatReference[];
  // Start the conversation in a space (backend B4): first turn only, never with
  // conversation_id, is_confidential or is_redacted (the server answers 422).
  space_uuid?: string;
  // A new chat's first send only, never with conversation_id (422): a uuid made
  // once per composed send and sent again on every retry of it, so a retry after
  // the server already made the chat gets that chat back (backend, 17 October
  // 2026). Not a uuid: 422 on this field.
  client_request_id?: string;
  // The saved message this turn replies to (space chat replies). Needs
  // conversation_id; a target outside the chat, a step, an error or a deleted
  // row is one 422 on this field.
  reply_to_message_id?: number;
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
    // For redacted conversations, the canonical (redacted) form of the user's
    // turn. Use this in place of the raw input so the local store stays in
    // sync without a refetch.
    user_message_content?: string;
    /** What redaction hid in that turn: redacted chats only (see {@link RedactionSummary}). */
    redaction?: RedactionSummary;
    /**
     * The saved id of the user's message (backend, 2026-07-25). Belt-and-braces for
     * the cross-tab merge: the client draws the user's row optimistically, before
     * the server has saved anything, so without this the row has no server identity
     * until the turn's terminal event reports it. Knowing it at SEND time means the
     * user's own message stays reconcilable even if the stream dies before that
     * terminal event ever arrives.
     *
     * Absent for confidential turns, which persist nothing.
     */
    user_message_id?: number;
    /** Handles in this turn that matched nobody in the space (the writer's, space chats). */
    unmatched_handles?: string[];
    /**
     * A retry of a first send the server already answered (`client_request_id`):
     * only `conversation_id` comes with it, no execution, nothing charged. Open
     * that chat. If the reader deleted it since, it reads 404: not sent.
     */
    already_sent?: boolean;
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
  // Legacy single-file convenience. Prefer fileIds[] for new code.
  fileId?: number;
  // Canonical multi-file IDs (max 10 per turn).
  fileIds?: number[];
  // Single-attachment convenience for optimistic message rendering.
  attachment?: MessageAttachment;
  // Multi-attachment list for optimistic message rendering.
  attachments?: MessageAttachment[];
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
  // Set on turn 1 when the user opted into redacted mode on the home page.
  // Subsequent turns omit the flag — the server reads the persisted setting.
  isRedacted?: boolean;
  // The message this turn replies to: sent as reply_to_message_id, and drawn
  // as the quote on the row this client draws.
  replyTo?: MessageReplyTo;
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
    type?: 'tool_call' | 'tool_result' | 'handover' | 'handover_result' | 'error' | 'narration' | 'radar_report';
    tool_name?: string;
    tool_parameters?: Record<string, unknown>;
    success?: boolean;
    latency_ms?: number;
    iteration?: number;
    seq?: number;
    /**
     * The execution that wrote this row (backend, 2026-07-25). Its arrival means
     * `metadata` is now an OBJECT on every message — rows that used to carry
     * `metadata: null` no longer do. Nothing here reads null-ness as "plain
     * message" (`transform-api-messages.ts` keys on the absence of `metadata.type`,
     * which is the real marker and is unchanged) — verified, not assumed.
     */
    execution_id?: string;
    context?: 'handover';
    target_agent?: string;
    agent_slug?: string;
    task?: string;
    parent_agent?: number;
    handover_type?: 'consult' | 'transfer';
    // A step's result left out of a lazy chat download: the step's label and
    // state still need these.
    statute_title?: string;
    // The note or case a read step opened, for its label (Stay's #13).
    note_title?: string;
    case_title?: string;
    error?: string;
    // Error message fields
    error_code?: string;
    retryable?: boolean;
    retry_after_ms?: number | null;
    // Partial message fields (streaming cancel/error with rescued text buffer).
    // When partial === true, content holds the actual partial assistant text
    // the user saw stream in. reason describes why it was cut short.
    partial?: boolean;
    reason?: 'cancelled' | 'error' | 'timeout';
    /** The files on a user message, with their types. */
    files?: ApiMessageFile[];
    /** What redaction hid in a user turn of a redacted chat (see {@link RedactionSummary}). */
    redaction?: RedactionSummary;
  } | null;
  // Canonical multi-attachment shape (backend normalizes both legacy and new
  // storage shapes into this array). Always check `attachments` first.
  attachments?: MessageAttachment[];
  // Legacy alias for clients not migrated — equals attachments[0].
  attachment?: MessageAttachment;
  created_at: string;
  /** A step result left out of a lazy chat download (`?results=lazy`): `content` is empty. */
  has_result?: boolean;
  /** That result's size in bytes, when left out. */
  result_bytes?: number;
  /**
   * Who wrote a user turn (backend B4): on every user row, `null` on assistant
   * and tool rows. Old rows with no recorded writer name the chat's owner.
   * `null` on a user row too when a stranger reads a published chat and the
   * writer is not its owner. Absent on a server before B4.
   */
  author?: ConversationAuthor | null;
  /** The message this row replies to; `null` when it replies to nothing. Absent on a server before replies. */
  reply_to?: MessageReplyTo | null;
  /** The people tagged in this row (`[]` when none, and in personal chats). */
  mentions?: MessageMention[];
  /** Handles the writer typed that matched nobody in the space: on the writer's own rows only. */
  unmatched_handles?: string[];
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

// ─── Conversation references ───────────────────────────────
// Each conversation can be "about" one or more pieces of content (the case /
// note / statute it was started from, or a radar + its scans). The backend
// returns these on the list, per-content-page, and single-conversation
// endpoints. `content` is a compact summary, or null when the target was deleted.

export interface CaseReferenceContent {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  judgment_date: string | null;
  citation: string | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
  views_count: number;
}

export interface StatuteReferenceContent {
  id: number;
  title: string;
  short_title: string | null;
  slug: string;
  year: string | null;
  status: string | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
}

export interface NoteReferenceContent {
  id: number;
  title: string;
  slug: string;
  content_preview: string | null;
  content_preview_html: string | null;
  user: { id: number; name: string; avatar_url: string | null } | null;
  tags: string[] | null;
  price_ngn: number | null;
  price_usd: number | null;
  is_free: boolean;
  thumbnail_url: string | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
  views_count: number;
  created_at: string;
}

export interface RadarReferenceContent {
  uuid: string;
  name: string;
  status: string;
  last_scan_at: string | null;
  created_at: string;
}

export interface RadarScanReferenceContent {
  uuid: string;
  title: string;
  status: string;
  has_findings: boolean;
  priority: string | null;
  read_at: string | null;
  created_at: string;
}

export type ConversationReference =
  | { type: 'case'; content: CaseReferenceContent | null }
  | { type: 'statute'; content: StatuteReferenceContent | null }
  | { type: 'note'; content: NoteReferenceContent | null }
  | { type: 'radar'; content: RadarReferenceContent | null }
  | { type: 'radar_scan'; content: RadarScanReferenceContent | null };

export interface ConversationData {
  id: string;
  user_id: number;
  /** What the reader may do with this chat; see {@link ConversationCan}. */
  can?: ConversationCan;
  agent_id: number;
  title: string;
  status: 'active' | 'archived';
  is_private: boolean;
  is_confidential?: boolean;
  is_redacted?: boolean;
  messages: ApiMessage[];
  messages_count: number;
  views_count?: number;
  author?: ConversationAuthor;
  agent?: ConversationAgentSummary;
  references?: ConversationReference[];
  /** See {@link ConversationListItem.space}. */
  space?: ConversationSpaceRef | null;
  /** See {@link ConversationListItem.my_space_role}. */
  my_space_role?: ConversationSpaceRole | null;
  /** See {@link ConversationListItem.can_send}. */
  can_send?: boolean;
  /**
   * The space's newest 100 active members, for each person's colour (backend,
   * 17 October 2026): only for an active member of the chat's space, absent
   * otherwise and on the public route. See record-roster.ts.
   */
  space_roster?: SpaceRosterEntry[];
  created_at: string;
  updated_at: string;
  /** When its newest message was written (yours, a colleague's or Lawexa's); every
   *  chat list sorts by it, newest first (Stay, 13 October 2026). Absent on an older
   *  server, where the rows show updated_at (activity.ts). */
  last_message_at?: string | null;
}

export interface ConversationResponse {
  success: boolean;
  message: string;
  data: ConversationData;
}

// A substantive-message preview on a list row. The backend skips machinery
// rows (tool calls/results, handovers, narration, errors), strips HTML +
// context slug tags + attachment blocks, and caps at ~140 chars. Used for both
// `last_message` (latest, user|assistant) and `first_message` (earliest user
// message — `role` is always 'user'; `preview` may be '' for a slug-only open).
export interface ConversationMessagePreview {
  role: 'user' | 'assistant';
  preview: string;
  created_at: string;
  /**
   * Who sent it (backend, 15 October 2026): the person for a user turn, null
   * for Lawexa's answer. Withheld as `MessageResource.author` is: a reader
   * outside the space gets the chat owner's name only (no uuid), and null for
   * anyone else. Absent on an API before it.
   */
  author?: { uuid?: string; name: string } | null;
}

/**
 * What the READER may do with a chat (backend, 15 October 2026), worked out by
 * the server's own rules: the owner, a space's Contributor or Viewer, or the
 * space's Owner on a member's chat. The "…" menu shows an item only when its
 * flag is true (`conversation-menu.ts`). Absent on an older server.
 */
export interface ConversationCan {
  rename: boolean;
  move_to_space: boolean;
  move: boolean;
  remove: boolean;
  share: boolean;
  delete: boolean;
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
  is_redacted?: boolean;
  agent: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
  };
  references?: ConversationReference[];
  // Earliest user message — used as the row's identity in content-scoped lists.
  first_message?: ConversationMessagePreview | null;
  last_message?: ConversationMessagePreview | null;
  messages_count: number;
  /** The space the chat sits in, or `null` when it is the owner's alone
   *  (backend B3). Absent on an API before B3 and on payloads that do not
   *  carry it, which reads the same as `null`. */
  space?: ConversationSpaceRef | null;
  /** The READER's role in that space (backend B4), whether or not they own the
   *  chat; `null` outside a space or for a non-member. Absent before B4. */
  my_space_role?: ConversationSpaceRole | null;
  /** Whether the reader may send in this chat (backend B4). It already counts
   *  ownership, so it is the one answer the composer follows. Absent before B4. */
  can_send?: boolean;
  /** What the reader may do with this chat; see {@link ConversationCan}. */
  can?: ConversationCan;
  created_at: string;
  updated_at: string;
  /** When its newest message was written (yours, a colleague's or Lawexa's); every
   *  chat list sorts by it, newest first (Stay, 13 October 2026). Absent on an older
   *  server, where the rows show updated_at (activity.ts). */
  last_message_at?: string | null;
}

/** One member on a chat record's `space_roster`. Roles are the space's words
 *  (MemberRole and ContentRole in `types/collab`), kept as
 *  strings here because `types/collab` imports this file. */
export interface SpaceRosterEntry {
  user_uuid: string;
  role: string;
  content_role: string | null;
  joined_at: string | null;
}

/** The two keys of a space a chat payload carries (backend B3). Declared here
 *  rather than imported from `types/collab`, which already imports this file. */
export interface ConversationSpaceRef {
  uuid: string;
  name: string;
}

/** A reader's role in a chat's space, the stored value (backend B4): the
 *  screens call `editor` a Contributor. */
export type ConversationSpaceRole = 'owner' | 'editor' | 'viewer';

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
  sort_by?: 'created_at' | 'updated_at' | 'last_message_at' | 'title';
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
  /** The person's uuid, for the space's owner and members only (backend
   *  a9a0b96): it matches the space roster, so a space chat gives each person
   *  their colour (member-colour.ts). */
  uuid?: string;
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
