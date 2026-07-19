'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useConversationStream,
  hasTranscript,
} from '@/v2/runtime/chat-engine';
import type { MessageAttachment, ConversationReference } from '@/types/chat';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import {
  isConfidentialMark,
  isRedactedMark,
  markConfidential,
  markRedacted,
  useModeMarks,
} from './mode-marks';

/**
 * useConversationController — the v2 conversation screen's mount flow, decomposed
 * out of v1's 1470-line god component. It owns EVERYTHING the transcript and the
 * dock composer share: the engine instance (with the privacy resolvers WIRED), the
 * `conv_init` streaming handoff, reload/direct-nav recovery, the per-conversation
 * jurisdiction slot, ownership (view-only) detection, and the unified activity
 * region's narration text. The screen and composer stay thin.
 *
 * RESOLVER WIRING (the privacy acceptance criterion). The engine's
 * confidential/redacted resolvers default to inert `() => false`; here they are
 * wired to {@link isConfidentialMark} / {@link isRedactedMark} (the reader over v1's
 * mode-store sessionStorage envelope — never `lib/stores`). So a confidential
 * turn writes the device-owned IndexedDB + replays `messages[]`, and a redacted
 * turn gets the server's redacted swap — byte-identical to v1's behavior.
 */

const CONV_INIT_PREFIX = 'conv_init_';
const CONV_JURISDICTION_PREFIX = 'conv_jurisdiction_';
/** Narration auto-expiry so the calm status line returns to its resting label. */
const NARRATION_TTL_MS = 8000;

interface InitAttachment {
  file_id: number;
  file_name: string;
  file_size: number;
}

interface StoredInit {
  msg?: string;
  exec?: string;
  attachments?: InitAttachment[];
  file_id?: number;
  file_name?: string;
  file_size?: number;
}

/** Read + parse the byte-compatible `conv_init_{id}` handoff wave-2 writes. */
function readConvInit(conversationId: string): {
  message: string | null;
  executionId: string | null;
  attachments: MessageAttachment[] | undefined;
} {
  if (typeof window === 'undefined') {
    return { message: null, executionId: null, attachments: undefined };
  }
  const key = `${CONV_INIT_PREFIX}${conversationId}`;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return { message: null, executionId: null, attachments: undefined };
  try {
    const parsed = JSON.parse(raw) as StoredInit;
    let attachments: MessageAttachment[] | undefined;
    if (Array.isArray(parsed.attachments) && parsed.attachments.length > 0) {
      attachments = parsed.attachments;
    } else if (parsed.file_id && parsed.file_name && parsed.file_size) {
      // Legacy single-file shape — wrap into the canonical array (v1 parity).
      attachments = [
        { file_id: parsed.file_id, file_name: parsed.file_name, file_size: parsed.file_size },
      ];
    }
    return {
      message: parsed.msg ?? null,
      executionId: parsed.exec ?? null,
      attachments,
    };
  } catch {
    return { message: null, executionId: null, attachments: undefined };
  } finally {
    // Consume once — a reload must not replay a finished handoff.
    window.sessionStorage.removeItem(key);
  }
}

/** Read v1's per-conversation jurisdiction slot (defaults to auto when absent). */
function readJurisdictionSlot(conversationId: string): JurisdictionChoice {
  if (typeof window === 'undefined') return { mode: 'auto' };
  try {
    const raw = window.sessionStorage.getItem(`${CONV_JURISDICTION_PREFIX}${conversationId}`);
    if (!raw) return { mode: 'auto' };
    const parsed = JSON.parse(raw) as JurisdictionChoice;
    return parsed && typeof parsed === 'object' && 'mode' in parsed ? parsed : { mode: 'auto' };
  } catch {
    return { mode: 'auto' };
  }
}

/** Truncate narration to a calm one-line status (first sentence / 120 chars). */
function truncateNarration(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 120) return trimmed;
  const dot = trimmed.indexOf('.', 60);
  const end = dot > 0 ? dot + 1 : 120;
  return `${trimmed.slice(0, end).trim()}…`;
}

export interface ConversationController {
  stream: ReturnType<typeof useConversationStream>;
  /** Server-verified ownership: false ⇒ the read-only / shared view. */
  isOwner: boolean;
  /**
   * Whether ownership has been DETERMINED yet. False until the owner id resolves
   * (from the synchronous handoff path, or async history load). While false the
   * dock must show a skeleton — NOT the "shared" pill, which would otherwise flash
   * for owners on every direct-nav/reload/recents click (isOwner is false while the
   * owner id is still null).
   */
  isOwnerResolved: boolean;
  /** Confidential surface treatment (device-owned transcript). */
  isConfidential: boolean;
  /** Redacted mode (sticky) — drives the composer's locked redacted pill. */
  isRedacted: boolean;
  references: ConversationReference[];
  jurisdiction: JurisdictionChoice;
  setJurisdiction: (next: JurisdictionChoice) => void;
  /** Latest transient narration line for the unified activity region (or null). */
  narration: string | null;
  /** Send a turn on this conversation (the engine resolves confidential/redacted). */
  submit: (message: string, attachments: MessageAttachment[]) => Promise<void>;
  /** Graceful cancel (cancel POST; the engine waits for the terminal SSE event). */
  stop: () => void;
  /** Re-ask the last user turn to get a fresh answer (drives engine.send). */
  regenerate: () => void;
  /** True when a completed answer exists and nothing is streaming. */
  canRegenerate: boolean;
}

export function useConversationController(
  conversationId: string,
  serverUserId: number | null,
): ConversationController {
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [references, setReferences] = useState<ConversationReference[]>([]);
  const [jurisdiction, setJurisdictionState] = useState<JurisdictionChoice>({ mode: 'auto' });
  const [narration, setNarration] = useState<string | null>(null);

  const narrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stream = useConversationStream({
    // ── Privacy resolvers WIRED (see docblock). ──
    isConfidential: isConfidentialMark,
    isRedacted: isRedactedMark,
    onHistoryLoaded: (data) => {
      setOwnerId(data.user_id);
      setReferences(data.references ?? []);
      // Mirror server stickiness into the local marks so the composer reflects the
      // conversation's mode and the resolvers agree on subsequent turns.
      if (data.is_redacted) markRedacted(data.id);
      if (data.is_confidential) markConfidential(data.id);
    },
    onNarration: (text) => {
      const line = truncateNarration(text);
      if (line) setNarration(line);
    },
  });

  const { connectToStream, loadConversationHistory, loadConversationHistoryFromIDB, setConversationId, recoverPendingState, send, cancelStream, isStreaming, messages } = stream;

  // ── Jurisdiction slot: seed once per conversation, persist on change. ──
  useEffect(() => {
    setJurisdictionState(readJurisdictionSlot(conversationId));
  }, [conversationId]);

  const setJurisdiction = useCallback(
    (next: JurisdictionChoice) => {
      setJurisdictionState(next);
      if (typeof window === 'undefined') return;
      try {
        const key = `${CONV_JURISDICTION_PREFIX}${conversationId}`;
        if (next.mode === 'auto') window.sessionStorage.removeItem(key);
        else window.sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        // sessionStorage unavailable — the choice still applies in-memory this turn.
      }
    },
    [conversationId],
  );

  // ── Narration auto-expiry: the calm line fades back to its resting label. ──
  useEffect(() => {
    if (!narration) return;
    if (narrationTimerRef.current) clearTimeout(narrationTimerRef.current);
    narrationTimerRef.current = setTimeout(() => setNarration(null), NARRATION_TTL_MS);
    return () => {
      if (narrationTimerRef.current) clearTimeout(narrationTimerRef.current);
    };
  }, [narration]);

  // Clear narration when a stream ends.
  useEffect(() => {
    if (!isStreaming) setNarration(null);
  }, [isStreaming]);

  // ── Mount flow: handoff → stream, else history + recovery. ──
  //
  // STRICTMODE / REMOUNT RE-ESTABLISHMENT. The engine does NOT auto-restart a
  // stream across a StrictMode remount (its adapter disconnects on unmount); this
  // flow owns re-establishment. So it runs on EVERY mount rather than being blocked
  // by a persistent "initialized" ref: the `conv_init` handoff is consumed once
  // (sessionStorage removeItem), so a remount naturally falls through to the
  // recovery path, where `recoverPendingState` re-attaches to the live execution —
  // the same path that recovers a reload-mid-stream. A per-mount `cancelled` flag
  // guards the async work against a unmount landing setState after teardown.
  useEffect(() => {
    let cancelled = false;

    const { message, executionId, attachments } = readConvInit(conversationId);
    setConversationId(conversationId);

    if (executionId && message) {
      // Fresh handoff from the home composer: attach to the live execution. The
      // creator is the owner (server-verified id threaded from the page).
      connectToStream(executionId, message, attachments);
      if (serverUserId != null) setOwnerId(serverUserId);
      // Drop the ?init=1 marker so a manual reload takes the recovery path.
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', `/c/${conversationId}`);
      }
      return () => {
        cancelled = true;
      };
    }

    // Direct navigation / reload / remount (handoff already consumed). Confidential
    // conversations 404 from the server by design — check the device-owned
    // IndexedDB transcript FIRST, then still try to recover any in-flight execution
    // (confidential status carries execution_id).
    void (async () => {
      const localExists = await hasTranscript(conversationId).catch(() => false);
      if (cancelled) return;
      if (localExists) {
        markConfidential(conversationId);
        await loadConversationHistoryFromIDB(conversationId);
        if (cancelled) return;
        if (serverUserId != null) setOwnerId(serverUserId);
        await recoverPendingState(conversationId).catch(() => {});
        return;
      }
      await loadConversationHistory(conversationId);
      if (cancelled) return;
      await recoverPendingState(conversationId).catch(() => {});
    })();

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    serverUserId,
    connectToStream,
    loadConversationHistory,
    loadConversationHistoryFromIDB,
    setConversationId,
    recoverPendingState,
  ]);

  const { isConfidential, isRedacted } = useModeMarks(conversationId);

  const isOwner = serverUserId != null && ownerId != null && serverUserId === ownerId;

  const submit = useCallback(
    async (message: string, attachments: MessageAttachment[]) => {
      const fileIds = attachments.map((a) => a.file_id);
      await send(message, {
        conversationId,
        streamMode: 'v2_stream',
        jurisdiction,
        ...(fileIds.length > 0 && { fileIds, attachments }),
      });
    },
    [send, conversationId, jurisdiction],
  );

  const stop = useCallback(() => cancelStream(), [cancelStream]);

  // "Ask again": re-send the last user turn (there is NO backend regenerate
  // endpoint, so this drives a fresh turn through engine.send — it genuinely adds
  // a new turn to the server thread, which is why the UI labels it "Ask again"
  // rather than faking an in-place regenerate). Guarded to completed, non-streaming.
  const lastUserContent = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i].content;
    }
    return null;
  }, [messages]);

  const lastIsCompletedAssistant = useMemo(() => {
    const last = messages[messages.length - 1];
    return (
      !!last &&
      last.role === 'assistant' &&
      !last.isStreaming &&
      !('messageType' in last && (last as { messageType?: string }).messageType)
    );
  }, [messages]);

  const canRegenerate = !isStreaming && lastIsCompletedAssistant && !!lastUserContent;

  const regenerate = useCallback(() => {
    if (isStreaming || !lastUserContent) return;
    void send(lastUserContent, {
      conversationId,
      streamMode: 'v2_stream',
      jurisdiction,
    });
  }, [isStreaming, lastUserContent, send, conversationId, jurisdiction]);

  return {
    stream,
    isOwner,
    isOwnerResolved: ownerId !== null,
    isConfidential,
    isRedacted,
    references,
    jurisdiction,
    setJurisdiction,
    narration,
    submit,
    stop,
    regenerate,
    canRegenerate,
  };
}
