'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useConversationStream,
  claimTranscript,
  deleteTranscript,
} from '@/v2/runtime/chat-engine';
import type { MessageAttachment, ConversationReference } from '@/types/chat';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { stripPastedTags } from '@/lib/utils';
import { setHeaderContext, clearHeaderContext } from '@/v2/shell/header-context';
import { useStreamStyle } from '@/v2/stream-style';
import { conversationsCache } from '../cache';
import { ConfidentialConversationError, conversationsQueries } from '../queries';
import {
  isConfidentialMark,
  isRedactedMark,
  markConfidential,
  markRedacted,
  unmarkConfidential,
  unmarkRedacted,
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
 *
 * TRANSCRIPT CACHING (why the history fetch moved out of the engine). Opening a
 * conversation used to re-download it EVERY time — the engine fired
 * `GET /conversations/{id}` on every mount and held `isLoadingHistory` for the whole
 * round trip, so the tenth visit cost exactly as much as the first and showed the
 * same two skeletons. The fetch now goes through `conversationsQueries.detail`, the
 * same TanStack layer the rest of v2 runs on, and the engine is SEEDED from that
 * cache at construction. A revisit therefore paints the transcript in its first
 * committed render — with ownership already resolved from the same cached record, so
 * the composer is real rather than a skeleton — and the revalidation lands behind it.
 *
 * THE THREE THINGS THAT CACHE MUST NEVER DO, and where each is stopped:
 *  1. HOLD CONFIDENTIAL CONTENT. A confidential transcript is device-owned (IDB) and
 *     404s from the server by design. The query is left DISABLED for a conversation
 *     this device knows is confidential, the fetcher refuses any record flagged
 *     `is_confidential` (throwing, so nothing is stored), the engine's IDB path never
 *     writes to the cache, and {@link ConversationController.deleteConfidential}
 *     removes the entry outright. See each site below.
 *  2. LET ANOTHER USER READ IT. The cache entry is partitioned by the
 *     server-verified viewer id (see `conversationsQueries.detail`), because the v2
 *     QueryClient is a module singleton that survives v1's sign-out.
 *  3. RACE THE LIVE STREAM. Adoption is guarded inside the engine
 *     (`adoptConversationHistory`), not here — a background revalidation cannot
 *     disturb a streaming answer even if this controller asked it to.
 */

/** Stable empty references — a fresh `[]` per render would churn every consumer. */
const NO_REFERENCES: ConversationReference[] = [];

/**
 * Map a failed history load onto the sentinel strings the screen renders. Byte-identical
 * to the mapping the engine's former `loadConversationHistory` performed, so `not_found`
 * still reaches the screen's "not available" state and everything else is an inline banner.
 */
function historyErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } } | null | undefined)?.response?.status;
  if (status === 404) return 'not_found';
  return err instanceof Error ? err.message : 'Failed to load conversation';
}

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
  /**
   * Whether the transcript is still being loaded and there is NOTHING to show yet.
   * The union of both history paths (the device-owned IndexedDB load and the server
   * query), AND-ed with "the engine holds no messages" — so it is structurally
   * impossible for a skeleton to cover cached content. On a revisit it is `false`
   * from the very first render.
   */
  isLoadingHistory: boolean;
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
  /**
   * Delete this confidential conversation from the device (§A7-39): wipes the
   * IndexedDB transcript — the ONLY copy of the content — clears the local
   * confidential/redacted marks, refreshes the recents, and navigates home.
   */
  deleteConfidential: () => Promise<void>;
}

export function useConversationController(
  conversationId: string,
  serverUserId: number | null,
): ConversationController {
  const [localOwnerId, setLocalOwnerId] = useState<number | null>(null);
  const [jurisdiction, setJurisdictionState] = useState<JurisdictionChoice>({ mode: 'auto' });
  const [narration, setNarration] = useState<string | null>(null);

  const narrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();
  const queryClient = useQueryClient();

  const { isConfidential, isRedacted } = useModeMarks(conversationId);

  // ── The cached transcript (server path). ──
  // DISABLED for a conversation this device already knows is confidential: that
  // content is device-owned and 404s server-side, so the request would be both
  // pointless and the one request whose response we must never store. The
  // `claimTranscript` check in the mount flow below is the authority; this mark is the
  // synchronous first gate, and the fetcher's `is_confidential` refusal is the third.
  const detailOptions = useMemo(
    () => conversationsQueries.detail({ conversationId, viewerId: serverUserId }),
    [conversationId, serverUserId],
  );
  const detailQuery = useQuery({ ...detailOptions, enabled: !isConfidential });
  const detailData = detailQuery.data ?? null;
  const detailKey = detailOptions.queryKey;

  // ── Streaming style (a per-device developer preference) → the engine. ──
  // Memoized on the primitive so the object identity only changes when the choice
  // does; the engine's `setSmoothing` also no-ops on an unchanged resolution, so a
  // live stream switches rhythm mid-answer without rebuilding anything.
  const streamStyle = useStreamStyle();
  const smoothing = useMemo(() => ({ style: streamStyle }), [streamStyle]);

  const stream = useConversationStream({
    smoothing,
    // THE WARM-CACHE SEED. Read once, when the engine is constructed: on a revisit
    // this is already the full transcript, so the engine's first snapshot carries it
    // and the screen paints with no skeleton and no empty frame. On a cold open it is
    // null and the mount flow adopts the fetch when it lands.
    initialHistory: detailData,
    // ── Privacy resolvers WIRED (see docblock). ──
    isConfidential: isConfidentialMark,
    isRedacted: isRedactedMark,
    // Server history the ENGINE fetched for itself during stream recovery
    // (`pollForCompletion` / `checkStaleStream` — the paths that reload a
    // conversation after a dropped stream). It is fresher than anything cached, so
    // it is written straight into the same entry the query owns: one source for
    // ownership, references, and the next open. NEVER for a confidential
    // conversation — its content is device-owned. (Those paths cannot produce
    // confidential content anyway, since the server 404s it; this is the belt.)
    onHistoryLoaded: (data) => {
      // Mirror server stickiness into the local marks so the composer reflects the
      // conversation's mode and the resolvers agree on subsequent turns.
      if (data.is_redacted) markRedacted(data.id);
      if (data.is_confidential) markConfidential(data.id);
      if (data.is_confidential || isConfidentialMark(data.id)) return;
      // Keyed off `data.id`, not this render's conversation, so a record can only
      // ever be written under its OWN entry.
      queryClient.setQueryData(
        conversationsQueries.detail({ conversationId: data.id, viewerId: serverUserId }).queryKey,
        data,
      );
    },
    // A turn is now in flight, so whatever is cached for this conversation is about
    // to be out of date. Mark it invalid but do NOT refetch: the live stream is the
    // truth on screen, and `onCompleted` below is where the real revalidation
    // belongs. This fires for every connect — the home handoff's first turn, a
    // `submit`, "ask again", a retry, and a recovery reconnect — so no route into a
    // turn can leave a stale entry behind if the user navigates away mid-answer.
    onConnected: () => {
      if (isConfidentialMark(conversationId)) return;
      void queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'none' });
    },
    onNarration: (text) => {
      const line = truncateNarration(text);
      if (line) setNarration(line);
    },
    // A turn finished — refresh this conversation's recents position + timestamp
    // directly (covers the home-created turn 1, whose send ran in start-conversation
    // rather than `submit`). No-op-stable when the row isn't cached (e.g. a
    // confidential stub the server omits), so it never fabricates a leak.
    //
    // ALSO the transcript's terminal cache write: the turn is persisted server-side,
    // so revalidate. With this screen mounted the active observer refetches in the
    // background (the engine ignores the result — it holds the richer live copy —
    // but the CACHE becomes server truth, so the next open is correct rather than
    // one turn short). With no observer left, the entry is simply marked invalid and
    // the next open revalidates on mount.
    onCompleted: () => {
      conversationsCache.touch(queryClient, conversationId);
      if (isConfidentialMark(conversationId)) return;
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });

  const { connectToStream, adoptConversationHistory, loadConversationHistoryFromIDB, setConversationId, setError, recoverPendingState, send, cancelStream, disconnect, fetchConversationTitle, isStreaming, messages, conversationTitle } = stream;

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
      if (serverUserId != null) setLocalOwnerId(serverUserId);
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
      // WHO, NOT JUST WHETHER (the shared-device fix). This used to ask only
      // `hasTranscript` — does this DEVICE hold one — and then hand ownership to
      // whoever was signed in. A device is not a person: on a shared laptop the next
      // user to sign in could open this conversation's URL out of the browser
      // history and be shown the whole transcript as its owner. `claimTranscript`
      // answers for the VIEWER, and binds an unowned record to them (see its
      // docblock for why adoption, and not refusal, is the right rule for content
      // that has no other copy).
      const claim = await claimTranscript(conversationId, serverUserId).catch(
        () => 'missing' as const,
      );
      if (cancelled) return;
      if (claim === 'foreign') {
        // A transcript IS here, and it is someone else's. Render exactly what a
        // genuinely absent one renders — saying more would confirm that this
        // conversation exists on this device and that a particular colleague used
        // it, which is the leak, not the fix. No owner id is set, so the composer
        // stays view-only regardless.
        markConfidential(conversationId);
        setError('confidential_transcript_lost');
        return;
      }
      if (claim === 'owned') {
        markConfidential(conversationId);
        await loadConversationHistoryFromIDB(conversationId);
        if (cancelled) return;
        // Ownership is now EARNED, not assumed: this branch is only reachable when
        // the stored `owner_user_id` is this viewer (or was unset and has just been
        // bound to them).
        if (serverUserId != null) setLocalOwnerId(serverUserId);
        await recoverPendingState(conversationId).catch(() => {});
        return;
      }

      try {
        // Cache-first history. Resolves from the warm entry with NO request (the
        // revisit case — the engine was already seeded with this exact record at
        // construction, so `adopt` is a no-op and simply confirms it), or performs
        // the single fetch the query layer then owns, dedupes and retains.
        const data = await queryClient.ensureQueryData(detailOptions);
        if (cancelled) return;
        adoptConversationHistory(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ConfidentialConversationError) {
          // The server reported a device-owned conversation whose transcript this
          // device does NOT have, or holds for a DIFFERENT user (the claim above already
          // said so).
          // Nothing was cached; fall through to the device path, which surfaces the
          // honest "not available here" state instead of an empty transcript.
          markConfidential(conversationId);
          await loadConversationHistoryFromIDB(conversationId);
          if (cancelled) return;
        } else {
          setError(historyErrorMessage(err));
        }
      }
      if (cancelled) return;
      // Unchanged ordering: history ALWAYS settles before recovery re-attaches, so a
      // reconnect can never find an empty transcript to stream into.
      await recoverPendingState(conversationId).catch(() => {});
    })();

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    serverUserId,
    detailOptions,
    queryClient,
    connectToStream,
    adoptConversationHistory,
    loadConversationHistoryFromIDB,
    setConversationId,
    setError,
    recoverPendingState,
  ]);

  // ── Bind a NEW confidential transcript to its creator. ──
  // The mount flow's `claimTranscript` guards the DIRECT-NAV path, but a freshly
  // created confidential conversation arrives through the `conv_init` handoff
  // branch, which returns before reaching it — so without this the transcript would
  // stay unowned from creation until its first re-open, and anyone signing in on
  // the device during that window could open it. Claiming here closes the window:
  // the creator is by definition the viewer looking at it right now. Idempotent
  // (a claim on an already-owned record is a read), so it is safe on every render
  // pass and on a remount.
  useEffect(() => {
    if (!isConfidential || serverUserId == null) return;
    void claimTranscript(conversationId, serverUserId).catch(() => {});
  }, [isConfidential, conversationId, serverUserId]);

  // Mirror the server's sticky modes into the local marks the composer and the
  // engine's resolvers read. An external-store write (not React setState) and
  // idempotent, so it is React-Compiler-clean in an effect and safe to re-run.
  // Structural sharing keeps `detailData` referentially identical across a
  // revalidation that changed nothing, so this does not even re-run then.
  useEffect(() => {
    if (!detailData) return;
    if (detailData.is_redacted) markRedacted(detailData.id);
    if (detailData.is_confidential) markConfidential(detailData.id);
  }, [detailData]);

  // BRIDGE THE VIEWER-KEY SWAP. `detailOptions` is keyed by `serverUserId`, so when
  // the session refresh flips it null → real (the guest window on a first v2 visit,
  // a sign-in, an expired cookie, or an `/auth/me` blip), the query key CHANGES and
  // `detailData` is undefined for one render. Without this, `ownerId` would fall
  // back to null for that render and the working composer would collapse into
  // `ComposerSkeleton` and back — a grey flash on a surface the user is already
  // typing into. Remembering the last server-resolved owner bridges the gap.
  // Ownership does NOT weaken: this only carries a value the SERVER already
  // returned for THIS conversation, and `isOwner` still compares it against the
  // server-verified `serverUserId`.
  useEffect(() => {
    if (detailData?.user_id != null) setLocalOwnerId(detailData.user_id);
  }, [detailData]);

  // Adopt a COLD fetch that resolved after this screen mounted (the mount flow's
  // `ensureQueryData` covers the common case; this covers a fetch that was already
  // in flight, e.g. a StrictMode remount landing on the first mount's request). The
  // engine's own guards decide: a live stream, another conversation's record, or an
  // already-populated transcript all decline. An engine call, not setState.
  useEffect(() => {
    if (detailData) adoptConversationHistory(detailData);
  }, [detailData, adoptConversationHistory]);

  // ── Header context publish (§A7-43 seam; consumed by the header work). ──
  // Push the conversation title + confidential flag into the shared header store
  // so the centre slot can render them on `/c/{id}`. `title` is null until it
  // resolves (skeleton-first); the title strips pasted-content tags exactly as v1's
  // breadcrumb does. This is an external-store write (not React setState), so it is
  // React-Compiler-clean in an effect.
  useEffect(() => {
    setHeaderContext({
      title: conversationTitle ? stripPastedTags(conversationTitle) : null,
      confidential: isConfidential,
    });
  }, [conversationTitle, isConfidential]);

  // ── Title upgrade → sidebar, no list refetch (wave-4 acceptance c). ──
  // When this conversation's title resolves or upgrades (the async AI-name generation,
  // or a history load), patch it into every recents cache IN PLACE — the sidebar/drawer
  // adopt the real name without refetching the list, and WITHOUT reordering (recency
  // owns position, not when the title happened to resolve). Confidential chats are
  // skipped: their title is device-owned (IDB), whereas any server list stub is
  // server-owned, so writing the device title onto it would only flicker on the next
  // refetch. The RAW title is stored (consumers strip via `stripPastedTags`, exactly as
  // for server rows); the write is no-op-stable when the title already matches, so this
  // effect stays idempotent. `setQueriesData` is an external-store write (not React
  // setState), so it is React-Compiler-clean inside an effect.
  useEffect(() => {
    if (conversationTitle && !isConfidential) {
      conversationsCache.patch(queryClient, conversationId, { title: conversationTitle });
    }
  }, [conversationTitle, isConfidential, conversationId, queryClient]);

  // Clear on unmount only (a separate empty-dep effect, so a title/flag change
  // republishes without a transient empty flash), so the next route never inherits
  // this conversation's context.
  useEffect(() => () => clearHeaderContext(), []);

  // ── Title arrival for the fresh-create handoff (mirrors v1 first-hand). ──
  // A brand-new conversation reaches the screen via the streaming handoff with NO
  // history load, so its title is unknown until the first turn finishes. When the
  // stream ends and no title is known yet, fetch it once (an engine action → its
  // own external store, not React setState). Confidential chats 404 server-side
  // (title lives in IDB), so the pointless fetch is skipped there.
  const prevIsStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming && !conversationTitle && !isConfidential) {
      void fetchConversationTitle(conversationId);
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, conversationTitle, isConfidential, conversationId, fetchConversationTitle]);

  // ── Ownership (composer vs. view-only) — still SERVER-DERIVED. ──
  // The owner id comes from the conversation record the server returned: on a
  // revisit that record is the CACHED one, but it is the same server response, it
  // was fetched under this viewer's own bearer token, and its cache entry is
  // partitioned by the server-verified viewer id — so a different signed-in user on
  // this device reads a different (cold) entry and can never inherit it. `null`
  // still means "not the owner", the strictly safe direction.
  //
  // `localOwnerId` is the fallback for the two paths that have no server record to
  // read: the fresh-create handoff (the creator IS the owner) and the confidential
  // device path (see the defect note in the mount flow).
  const ownerId = detailData?.user_id ?? localOwnerId;
  const isOwner = serverUserId != null && ownerId != null && serverUserId === ownerId;

  const references = detailData?.references ?? NO_REFERENCES;

  // ── The skeleton gate (standing rule: never a skeleton over cached content). ──
  // `detailQuery.isPending` means "this query has no data at all"; it is also true
  // for a DISABLED query, hence the `enabled` term. AND-ing the whole thing with an
  // empty transcript is what makes the rule structural rather than a promise: the
  // instant the engine holds rows — seeded from cache, adopted from a fetch, loaded
  // from IndexedDB, or streaming a live turn — the skeleton is off.
  const isLoadingHistory =
    (stream.isLoadingHistory || (!isConfidential && detailQuery.isPending)) &&
    messages.length === 0;

  const submit = useCallback(
    async (message: string, attachments: MessageAttachment[]) => {
      // Optimistically bump this conversation to the top of the recents caches the
      // instant the user sends — the sidebar/drawer reorder with NO refetch (wave-4
      // acceptance a). No-op-stable when the row isn't cached; `onCompleted` refreshes
      // the timestamp again when the turn settles.
      conversationsCache.touch(queryClient, conversationId);
      const fileIds = attachments.map((a) => a.file_id);
      await send(message, {
        conversationId,
        streamMode: 'v2_stream',
        jurisdiction,
        ...(fileIds.length > 0 && { fileIds, attachments }),
      });
    },
    [send, conversationId, jurisdiction, queryClient],
  );

  const stop = useCallback(() => cancelStream(), [cancelStream]);

  const deleteConfidential = useCallback(async () => {
    // Stop any in-flight stream FIRST so a late SSE write can't recreate the row
    // we're about to delete, then wipe the transcript (the only copy of the
    // content), shed the local marks (in-memory + persisted envelope, so a reload
    // can't resurrect them), refresh recents, drop the header context, and go home.
    disconnect();
    await deleteTranscript(conversationId).catch(() => {});
    unmarkConfidential(conversationId);
    unmarkRedacted(conversationId);
    // Drop the row from every cached conversations list (peek + infinite pages)
    // via the shared shape-aware writer so no ghost entry lingers in the
    // sidebar/drawer, THEN revalidate. There is no server delete endpoint — if the
    // backend still returns a contentless stub on refetch, that's server truth
    // (recorded as a backend ask); the content itself is already gone.
    conversationsCache.remove(queryClient, conversationId);
    void queryClient.invalidateQueries({ queryKey: conversationsQueries.lists() });
    // …and drop any transcript cache entry for this conversation, for EVERY viewer
    // partition (the key prefix stops before the viewer id). Nothing confidential is
    // supposed to be in there — the query is disabled for confidential conversations
    // and the fetcher refuses such records — so this removes at most a stub. It is
    // here anyway because "the delete wiped the content but a cached copy outlived
    // it" is the one failure this affordance must be structurally incapable of, and
    // a `removeQueries` is cheaper than trusting three upstream guards forever.
    queryClient.removeQueries({
      queryKey: [...conversationsQueries.details(), conversationId],
    });
    clearHeaderContext();
    router.push('/');
  }, [disconnect, conversationId, queryClient, router]);

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
    isLoadingHistory,
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
    deleteConfidential,
  };
}
