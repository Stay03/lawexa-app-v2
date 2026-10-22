import type { QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { chatApi } from '@/lib/api/chat';
import { applyJurisdiction } from '@/lib/utils/jurisdiction-payload';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { isRedactionSummary } from '@/lib/utils/redaction-summary';
import type { ChatReference, MessageAttachment, RedactionSummary } from '@/types/chat';
import {
  appendUserTurn,
  deleteTranscript,
  renameTranscript,
  replaceLastUserTurnContent,
} from '@/v2/runtime/chat-engine';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { conversationsCache, makeOptimisticConversation } from './cache';
import { renewRequestId, requestIdFor, settleRequestId, type FirstSend } from './first-send-id';
import { conversationsQueries } from './queries';

/**
 * startConversation — the ONE create-a-conversation flow for v2, extracted so both
 * this wave's home composer AND the wave-3 conversation screen call the exact same
 * code path.
 *
 * THE STRANGLER CONTRACT. The v2 conversation screen does not exist yet, so after
 * this creates a conversation it navigates to `/c/{id}`, which falls through the
 * proxy to v1's conversation page. That page is the CONSUMER, and it is untouched
 * this wave — so everything this module writes for the handoff is BYTE-COMPATIBLE
 * with what v1's own home wrote (studied first-hand in `app/(main)/page.tsx` and its
 * reader in `app/(main)/c/[conversationId]/conversation-client.tsx`). Three sacred
 * wire surfaces:
 *
 *  1. `sessionStorage['conv_init_{id}']` — the streaming handoff v1's page reads on
 *     mount: `{ msg, exec, stream_mode, attachments? }`. Field-for-field identical.
 *  2. `sessionStorage['conv_jurisdiction_{id}']` — v1's `useJurisdictionChoice`
 *     per-conversation slot, so subsequent turns typed on v1's page keep the chosen
 *     jurisdiction (v1 wrote this via `bridgeHomeJurisdictionToConversation`).
 *  3. `sessionStorage['lawexa-confidential-mode' | 'lawexa-redacted-mode']` — v1's
 *     confidential / redacted Zustand stores persist to sessionStorage; v2 cannot
 *     import those stores (boundary), so it writes their marks in the exact
 *     zustand-persist envelope and the caller HARD-navigates for those modes, so
 *     v1's store hydrates the mark fresh on the new page (see below).
 *
 * CONFIDENTIAL. Confidential conversations are device-owned: the transcript lives in
 * IndexedDB (`v2/runtime/chat-engine/confidential-transcript`, the SAME physical DB
 * v1 reads) and the server never stores the content. Exactly like v1, the user turn
 * is persisted to IDB under a temp id BEFORE the POST (crash-safe), then re-keyed to
 * the server id on success — and the request sends `is_confidential: true` with an
 * empty `messages: []` (turn 1) and nothing that must stay local.
 */

/** Uploaded attachment as carried into create + the handoff (v1's shape). */
export type StartAttachment = MessageAttachment;

export interface StartConversationInput {
  /** The user's message (already trimmed; never empty). */
  message: string;
  /** Uploaded files (each already has a server `file_id`). */
  attachments: StartAttachment[];
  /** Jurisdiction furniture choice (auto / override slug / none). */
  jurisdiction: JurisdictionChoice;
  /** Effective workflow id from the selector, if any (sent as `workflow_id`). */
  workflowId?: number;
  /** Study-mode CTA state (Study tab) — sends `study_mode: true`. */
  studyMode?: boolean;
  /** Confidential mode (plus-menu) — turn-1 create semantics + IDB persistence. */
  confidential?: boolean;
  /** Redacted mode (plus-menu) — turn-1 sticky flag; 503 fails closed. */
  redacted?: boolean;
  /**
   * Tie this new conversation to the content it is about — the case page's
   * "ask about this case" composer sends `[{ type: 'case', id: slug }]`.
   *
   * Id-native and sticky: the backend validates the reference, merges and dedupes
   * it server-side, and honours it on the FIRST turn only, which is exactly what
   * this create path is. That link is what makes
   * `GET /cases/{slug}/conversations` able to list a reader's prior threads about
   * a case, so the follow-up a week later resumes rather than restarts.
   */
  references?: ChatReference[];
  /**
   * Start the conversation in this space (Spaces F4, backend B4): everyone in
   * it reads the chat, and its Owner and Contributors may continue it. A space
   * chat is never private: the server refuses `is_confidential` and
   * `is_redacted` beside `space_uuid` (422), so the space's composer offers
   * neither and this flow sends neither with it.
   */
  spaceUuid?: string;
}

export interface StartConversationDeps {
  /** The v2 query client, for invalidating the recents lists on success. */
  queryClient: QueryClient;
}

export type StartConversationResult =
  /** A brand-new conversation: the handoff is written; navigate to `/c/{id}?init=1`.
   *  `hardNavigate` is set for confidential/redacted so v1's mode store rehydrates. */
  | { status: 'created'; conversationId: string; hardNavigate: boolean }
  /** 409 — a pending conversation already exists; navigate to it (no handoff). */
  | { status: 'existing'; conversationId: string };

/**
 * The redaction service was unavailable (503). Redacted mode FAILS CLOSED — we never
 * fall back to sending raw text — so the caller surfaces a retry-aware message and
 * keeps the toggle on. `retryAfter` is the server's `Retry-After` seconds, if given.
 */
export class RedactionUnavailableError extends Error {
  readonly retryAfter?: string;
  constructor(retryAfter?: string) {
    super('Redaction service is temporarily unavailable.');
    this.name = 'RedactionUnavailableError';
    this.retryAfter = retryAfter;
  }
}

function newTempId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Whether the chat an `already_sent` names can still be opened. Only a 404
 * says no (the reader deleted it since); any other failure to read it leaves
 * the chat page to say what is wrong, as for any other open.
 */
async function chatIsThere(conversationId: string): Promise<boolean> {
  try {
    await chatApi.getStatus(conversationId, { withoutMessages: true });
    return true;
  } catch (err) {
    return !(err instanceof AxiosError && err.response?.status === 404);
  }
}

/** Strip an uploaded file to the wire/handoff attachment shape. */
function toAttachment(a: StartAttachment): MessageAttachment {
  return {
    file_id: a.file_id,
    file_name: a.file_name,
    file_size: a.file_size,
    ...(a.mime_type && { mime_type: a.mime_type }),
  };
}

/**
 * Write the BYTE-COMPATIBLE streaming handoff v1's conversation page reads on mount.
 * Shape is identical to v1's home write: `{ msg, exec, stream_mode, attachments? }`,
 * plus `redaction` in a redacted chat (what the send hid, for the "Sent as
 * redacted" line under the first message; v1 ignores it).
 */
function writeConvInit(
  conversationId: string,
  data: { msg: string; exec: string; attachments: StartAttachment[]; redaction?: RedactionSummary },
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `conv_init_${conversationId}`,
      JSON.stringify({
        msg: data.msg,
        exec: data.exec,
        stream_mode: 'v2_stream',
        ...(data.attachments.length > 0 && {
          attachments: data.attachments.map(toAttachment),
        }),
        ...(data.redaction && { redaction: data.redaction }),
      }),
    );
  } catch {
    // sessionStorage unavailable (privacy mode) — the page falls back to its
    // recover-from-status path, so this is non-fatal.
  }
}

/**
 * Carry the composer's jurisdiction into v1's per-conversation slot so subsequent
 * turns typed on v1's page keep the same choice. Mirrors v1's
 * `useJurisdictionChoice` storage key + JSON value exactly. `auto` is the default v1
 * resolves to when the slot is absent, so we only write an explicit override/none.
 */
function bridgeJurisdiction(conversationId: string, choice: JurisdictionChoice): void {
  if (typeof window === 'undefined' || choice.mode === 'auto') return;
  try {
    window.sessionStorage.setItem(
      `conv_jurisdiction_${conversationId}`,
      JSON.stringify(choice),
    );
  } catch {
    // Non-fatal — v1 falls back to auto.
  }
}

/**
 * Mark a conversation in v1's confidential / redacted Zustand store by writing its
 * sessionStorage persistence entry in zustand's exact envelope (`{ state, version }`,
 * version 0 — verified against the store definitions and zustand's persist source).
 * Reads-merges-writes so any ids already marked this session are preserved. The
 * caller hard-navigates for these modes, so v1's store hydrates this mark fresh on
 * the new page (a soft nav could miss it if the store module were already resident).
 */
function markInV1ModeStore(
  storageKey: string,
  idsField: 'confidentialIds' | 'redactedIds',
  conversationId: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const prevState: Record<string, unknown> =
      parsed && typeof parsed === 'object' && typeof (parsed as { state?: unknown }).state === 'object'
        ? { ...((parsed as { state: Record<string, unknown> }).state) }
        : {};
    const prevIds: unknown = prevState[idsField];
    const ids = Array.isArray(prevIds) ? (prevIds as string[]) : [];
    const nextIds = ids.includes(conversationId) ? ids : [...ids, conversationId];
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        // `isPending: false` mirrors v1 clearing the home pending toggle after
        // create; the id set is what v1's page actually reads.
        state: { ...prevState, isPending: false, [idsField]: nextIds },
        version: 0,
      }),
    );
  } catch {
    // sessionStorage unavailable — confidential/redacted marking degrades to v1's
    // server/IDB detection on the conversation page; non-fatal.
  }
}

/**
 * Create a conversation and write the v1 handoff. Returns the id + how to navigate.
 * Throws {@link RedactionUnavailableError} on a redaction 503, and rethrows any other
 * failure for the caller to surface (via `extractApiError`).
 */
export async function startConversation(
  input: StartConversationInput,
  deps: StartConversationDeps,
): Promise<StartConversationResult> {
  const {
    message,
    attachments,
    jurisdiction,
    workflowId,
    studyMode,
    references,
    spaceUuid,
  } = input;
  // See `spaceUuid`: the private modes never ride beside a space.
  const confidential = spaceUuid === undefined && input.confidential === true;
  const redacted = spaceUuid === undefined && input.redacted === true;
  const fileIds = attachments.map((a) => a.file_id);
  // The send as composed, for its `client_request_id` (first-send-id.ts): a
  // retry of it carries the same id, so it never makes a second chat.
  const firstSend: FirstSend = { message, fileIds, spaceUuid, references, confidential, redacted };

  // Confidential turn 1: persist the user turn to IDB BEFORE the POST so a crash
  // never loses it. Use a temp id until the server returns the real one.
  let tempConvId: string | null = null;
  if (confidential) {
    tempConvId = newTempId();
    try {
      await appendUserTurn(tempConvId, {
        content: message,
        ...(attachments.length > 0 && { attachments: attachments.map(toAttachment) }),
      });
    } catch {
      // IndexedDB unavailable — fall through; the server path surfaces any real
      // failure and the orphan cleanup below is a no-op.
    }
  }

  try {
    const baseBody = {
      message,
      stream: true as const,
      // Token-level streaming is on by default for everyone (v1 parity).
      stream_mode: 'v2_stream' as const,
      ...(studyMode && { study_mode: true }),
      ...(workflowId ? { workflow_id: workflowId } : {}),
      ...(fileIds.length > 0 && { file_ids: fileIds }),
      // Confidential turn 1: the flag + an empty prior-history array.
      ...(confidential && { is_confidential: true, messages: [] }),
      // Redacted turn 1: sticky flag; the server swaps the message text.
      ...(redacted && { is_redacted: true }),
      // Content this chat is about (case slug, …) — first turn only, sticky.
      ...(references && references.length > 0 && { references }),
      // The space it starts in — first turn only, never with a private mode.
      ...(spaceUuid !== undefined && { space_uuid: spaceUuid }),
    };
    const post = (clientRequestId: string) =>
      chatApi.start(applyJurisdiction({ ...baseBody, client_request_id: clientRequestId }, jurisdiction));
    let response = await post(requestIdFor(firstSend));

    // A RETRY OF A SEND THE SERVER ALREADY ANSWERED: its chat, with nothing
    // run or charged again. Opened as the 409's chat is, and the caller clears
    // the words it kept. If the reader deleted that chat since, the question
    // reached no one they can see: sent again, once, under a new id.
    if (response.success && response.data.already_sent) {
      const sentTo = response.data.conversation_id;
      if (await chatIsThere(sentTo)) {
        settleRequestId(firstSend);
        if (confidential && tempConvId && tempConvId !== sentTo) {
          await renameTranscript(tempConvId, sentTo).catch(() => {});
        }
        return { status: 'existing', conversationId: sentTo };
      }
      response = await post(renewRequestId(firstSend));
      if (response.success && response.data.already_sent) {
        // A new id cannot name an old send; if the server says so anyway, its
        // chat is opened rather than a handoff written without an execution.
        settleRequestId(firstSend);
        return { status: 'existing', conversationId: response.data.conversation_id };
      }
    }

    if (!response.success) {
      if (tempConvId) await deleteTranscript(tempConvId).catch(() => {});
      throw new Error(response.message || 'Failed to start conversation');
    }

    const conversationId = response.data.conversation_id;
    const executionId = response.data.execution_id;

    // Reconcile the IDB temp row with the server id; swap in the redacted form.
    if (confidential) {
      if (tempConvId && tempConvId !== conversationId) {
        await renameTranscript(tempConvId, conversationId).catch(() => {});
      }
      if (redacted && response.data.user_message_content) {
        await replaceLastUserTurnContent(
          conversationId,
          response.data.user_message_content,
        ).catch(() => {});
      }
    }

    // For redacted chats the canonical user-visible text is the server's redacted
    // form — never the raw input (falls back to the input in passthrough mode).
    const displayMessage = response.data.user_message_content ?? message;

    // Bridge v1's session-scoped mode stores (see helper) — hard-nav needed.
    if (confidential) {
      markInV1ModeStore('lawexa-confidential-mode', 'confidentialIds', conversationId);
    }
    if (redacted) {
      markInV1ModeStore('lawexa-redacted-mode', 'redactedIds', conversationId);
    }

    bridgeJurisdiction(conversationId, jurisdiction);
    const redaction = redacted && isRedactionSummary(response.data.redaction) ? response.data.redaction : undefined;
    writeConvInit(conversationId, { msg: displayMessage, exec: executionId, attachments, redaction });

    // Put the new conversation at the top of every recents cache IMMEDIATELY, so the
    // sidebar/drawer/home show it without waiting on a refetch (wave-4 acceptance b).
    // SKIPPED for confidential/redacted: those hard-navigate (below), which rebuilds
    // the cache from the server anyway — and a confidential message's text must never
    // land in the recents cache, even transiently and even though it's client-only.
    // The title is the user's own first message (honest, informative); the follow-up
    // invalidation replaces the whole placeholder row with server truth.
    if (!confidential && !redacted) {
      conversationsCache.upsert(
        deps.queryClient,
        makeOptimisticConversation(conversationId, displayMessage),
      );
    }

    // KEEP the invalidation: it reconciles the optimistic row to server truth (real
    // fallback title, real fields, and the async AI-name upgrade) once the create
    // settles — the upsert is the instant paint, this is the correctness backstop.
    void deps.queryClient.invalidateQueries({ queryKey: conversationsQueries.lists() });
    // Started in a space: its Conversations tab, its counts on its detail and
    // on its row in `/spaces` re-ask, as a chat moved in does (content-mutations).
    if (spaceUuid !== undefined) {
      void deps.queryClient.invalidateQueries({ queryKey: spacesQueries.contentsOf(spaceUuid) });
      void deps.queryClient.invalidateQueries({ queryKey: spacesQueries.detailsOf(spaceUuid) });
      void deps.queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
    }

    settleRequestId(firstSend);
    return {
      status: 'created',
      conversationId,
      hardNavigate: Boolean(confidential || redacted),
    };
  } catch (err) {
    // 409 — the user already has a pending conversation (e.g. navigated back and
    // resent). Reuse it; v1's page recovers the in-flight stream from status/IDB.
    if (err instanceof AxiosError && err.response?.status === 409) {
      const existing: string | undefined = err.response.data?.data?.conversation_id;
      if (existing) {
        // A retry while its first send is still answering lands here too: the
        // chat exists, so this send is done.
        settleRequestId(firstSend);
        if (confidential && tempConvId && tempConvId !== existing) {
          await renameTranscript(tempConvId, existing).catch(() => {});
        }
        return { status: 'existing', conversationId: existing };
      }
    }

    // Any other failure — drop the orphan IDB row so confidential rows don't leak.
    if (tempConvId) await deleteTranscript(tempConvId).catch(() => {});

    // 503 from the redaction service — fail closed (never send raw text).
    if (redacted && err instanceof AxiosError && err.response?.status === 503) {
      const retryAfter = err.response.headers?.['retry-after'];
      throw new RedactionUnavailableError(
        typeof retryAfter === 'string' ? retryAfter : undefined,
      );
    }

    throw err;
  }
}
