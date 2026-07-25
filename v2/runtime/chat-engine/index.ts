/**
 * v2 chat-engine — public entry.
 *
 * The streaming engine, lifted out of v1's `useChatStream` god-component hook into
 * a clean, layered, typed core. Waves 2–3 import from here.
 *
 *  - {@link useConversationStream} — the React adapter hook (v1 `useChatStream`
 *    surface + per-message streaming sources). START HERE.
 *  - {@link useStreamingText} / {@link useStreamingReasoning} — per-message row
 *    subscriptions (only the streaming row re-renders; the list stays still).
 *  - {@link createChatEngine} — the framework-light core, for non-React consumers
 *    or bespoke wiring.
 *  - Confidential transcript API — device-owned IndexedDB store for confidential
 *    conversations (ported here so the engine is self-contained).
 */

export { createChatEngine } from './engine';
export {
  useConversationStream,
  useStreamingText,
  useStreamingReasoning,
  type UseConversationStreamOptions,
  type UseConversationStreamResult,
} from './use-conversation-stream';
export type {
  ChatEngine,
  ChatEngineConfig,
  ChatEngineSnapshot,
  EngineMessage,
  ReasoningTrace,
  RecoverResult,
  StreamingSource,
  StreamSmoothingConfig,
  StreamStyle,
} from './types';
export {
  ensureTranscript,
  getTranscript,
  hasTranscript,
  appendUserTurn,
  appendAssistantTurn,
  replaceLastUserTurnContent,
  upsertTranscriptTitle,
  renameTranscript,
  listConversationIds,
  deleteTranscript,
  clearAllTranscripts,
  historyEntriesFor,
  isConfidentialAttachmentExpired,
  type ConfidentialAttachment,
  type ConfidentialTranscript,
  type ConfidentialTranscriptEntry,
} from './confidential-transcript';
