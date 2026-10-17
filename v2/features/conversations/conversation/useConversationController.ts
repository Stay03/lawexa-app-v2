'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useConversationStream,
  claimTranscript,
  deleteTranscript,
  type SendRefusal,
} from '@/v2/runtime/chat-engine';
import type {
  ConversationReference,
  ConversationStatusData,
  ConversationTurnUser,
  MessageAttachment,
  MessageReplyTo,
} from '@/types/chat';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { stripPastedTags } from '@/lib/utils';
import { setHeaderContext, clearHeaderContext } from '@/v2/shell/header-context';
import { useStreamStyle } from '@/v2/stream-style';
import { conversationsCache, spaceOfListedChat } from '../cache';
import { useSkeletonHold } from './skeleton-hold';
import { goneOnServer } from './gone';
import { markGoneOnServer, useGoneMark } from './gone-marks';
import { ConfidentialConversationError, conversationsQueries } from '../queries';
import { spacesQueries } from '@/v2/features/spaces/queries';
import type { RosterEntry } from './member-colour';
import { rosterFromRecord } from './record-roster';
import { spaceMentionOptions } from './mention-options';
import { useAuthStore } from '@/lib/stores/authStore';
import type { MentionOptions } from '@/v2/features/channels/model';
import {
  askAgainRefusal,
  askingLabel,
  canSendIn,
  hasSpaceContract,
  isOwnTurn,
  sendRefusal,
  stopsPolling,
  turnChanged,
  UNKNOWN_TURN_LABEL,
  viewOnlyReason,
  whoseTurn,
  type SendRefused,
  type ViewOnlyReason,
} from './space-turn';
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
  mime_type?: string;
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
  /** Server-verified ownership: the owner's verbs (share, move, rename,
   *  delete, export) follow it. */
  isOwner: boolean;
  /**
   * Whether the reader may send in this chat, which decides composer against
   * view-only. The server's `can_send` when the record carries it (backend B4:
   * the chat's owner, or an Owner or Contributor of its space), else
   * ownership. Resolves with ownership, from the same record.
   */
  canSend: boolean;
  /** Why the reader reads only, for the view-only pill (space-turn.ts). */
  viewOnlyReason: ViewOnlyReason;
  /** Whether the chat sits in a space (backend B3's `space` on the record). */
  isSpaceChat: boolean;
  /** The chat's space, or null: where a space chat's attachments are uploaded. */
  spaceUuid: string | null;
  /** Name who asked each user turn: a space chat whose record carries the B4
   *  fields. False on a personal chat, which looks exactly as before. */
  showAuthors: boolean;
  /** The space's roster for each person's colour (member-colour.ts), or null:
   *  a personal chat, or the roster not read yet. */
  spaceRoster: readonly RosterEntry[] | null;
  /** The same, from the chat record's `space_roster` (record-roster.ts), or null:
   *  a personal chat, or a record without it. It colours the chat when it lists
   *  every asker, so the colours land with the transcript. */
  recordRoster: readonly RosterEntry[] | null;
  /** Who the composer's `@` picker offers (mention-options.ts), or null: a
   *  personal chat, or the roster not read yet. */
  mentionOptions: MentionOptions | null;
  /**
   * The colleague whose turn is streaming in this space chat, or null when
   * nothing streams or the turn is the reader's own. Drives "{name} is
   * asking" and holds Send.
   */
  sendHeldBy: string | null;
  /** When that colleague's turn started (epoch ms, from `pending_since`), for
   *  the activity row's clock; null when unknown or not held. */
  heldSince: number | null;
  /** The activity row's resting label for a turn that is not the reader's:
   *  "{name} is asking", or a nameless one while whose it is is not known
   *  yet; undefined for the reader's own turn (its default label). */
  turnLabel: string | undefined;
  /** Whether the reader may stop the running turn: their own turn, and the
   *  status does not say otherwise (`can_cancel`). */
  canStop: boolean;
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
  /**
   * `isLoadingHistory` held back by `SKELETON_HOLD_MS`: the skeleton itself.
   * While the hold runs the screen draws nothing, so a copy read from the
   * device in that time paints with no skeleton before it (skeleton-hold.ts).
   */
  showHistorySkeleton: boolean;
  /**
   * The server no longer serves this conversation (deleted, made private or
   * unshared elsewhere) although the screen still holds its transcript: the
   * screen then shows "not available" (gone.ts).
   */
  isGoneOnServer: boolean;
  /** Confidential surface treatment (device-owned transcript). */
  isConfidential: boolean;
  /** Redacted mode (sticky) — drives the composer's locked redacted pill. */
  isRedacted: boolean;
  references: ConversationReference[];
  jurisdiction: JurisdictionChoice;
  setJurisdiction: (next: JurisdictionChoice) => void;
  /** Latest transient narration line for the unified activity region (or null). */
  narration: string | null;
  /**
   * Send a turn on this conversation (the engine resolves confidential/redacted).
   * Resolves to the refusal when the server would not take it (another member's
   * turn is running, or the reader may no longer send): the composer gives the
   * message back and shows the sentence.
   */
  /** Send a turn; `replyTo` makes it a reply to that saved message (space chats). */
  submit: (
    message: string,
    attachments: MessageAttachment[],
    replyTo?: MessageReplyTo | null,
  ) => Promise<SendRefused | undefined>;
  /** Graceful cancel (cancel POST; the engine waits for the terminal SSE event). */
  stop: () => void;
  /** Re-ask the last user turn to get a fresh answer (drives engine.send).
   *  Resolves to the refusal's sentence when the server would not take it. */
  regenerate: () => Promise<SendRefused | undefined>;
  /** True when a completed answer exists and nothing is streaming. */
  canRegenerate: boolean;
  /**
   * Delete this confidential conversation from the device (§A7-39): wipes the
   * IndexedDB transcript — the ONLY copy of the content — clears the local
   * confidential/redacted marks, refreshes the recents, and navigates home.
   */
  deleteConfidential: () => Promise<void>;
}

/**
 * Embedded mode (the case page's side chat). The controller is route-shaped by
 * default — it publishes the shell header, rewrites the URL when consuming the
 * create handoff, and navigates home after a confidential delete. Embedded in
 * ANOTHER route's page, all three would trample the host: the case's header
 * title, the case's `?chat=` URL, and the reader's place. `embed` suppresses
 * them and delegates "this conversation is gone" to the host (which closes the
 * panel). Everything else — engine, privacy resolvers, recovery — is identical.
 */
export interface ConversationEmbed {
  /** Called instead of the home navigation when the conversation is deleted. */
  onDeleted: () => void;
  /**
   * `'external'` ⇒ the HOST owns the one composer element (the case chat's
   * one-screen rule): `ConversationScreen` renders the transcript only and
   * publishes its composer surface through `embedded-composer.ts`. Read by the
   * screen, not the controller — it lives here because it is embed CONFIG, and
   * the embed object already travels this path.
   */
  composer?: 'external';
}

export function useConversationController(
  conversationId: string,
  serverUserId: number | null,
  embed?: ConversationEmbed,
): ConversationController {
  const embedded = embed !== undefined;
  // The callback rides a ref so a host re-render can never churn the delete
  // callback's identity (and the mount flow's) through a changed prop.
  const embedRef = useRef(embed);
  useEffect(() => {
    embedRef.current = embed;
  });

  const [localOwnerId, setLocalOwnerId] = useState<number | null>(null);
  const [jurisdiction, setJurisdictionState] = useState<JurisdictionChoice>({ mode: 'auto' });
  const [narration, setNarration] = useState<string | null>(null);
  // The conversation whose mount flow has settled its recovery (it attached
  // to a running turn, or found none). Until then the status poll waits, so
  // it can never attach to a turn the mount flow is attaching to.
  const [recoveredFor, setRecoveredFor] = useState<string | null>(null);
  // Who the reader's last refused send met (a 409), and since when: the turn
  // then followed is theirs, until a status read says whose it is.
  const [refusedTurn, setRefusedTurn] = useState<{
    by: ConversationTurnUser | null;
    since: string | null;
  } | null>(null);

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
  // A conversation the server dropped during this visit is never read again
  // (gone-marks.ts): the screen shows "not available" instead.
  const isGoneMarked = useGoneMark(conversationId);
  const detailQuery = useQuery({ ...detailOptions, enabled: !isConfidential && !isGoneMarked });
  const detailData = detailQuery.data ?? null;
  const detailKey = detailOptions.queryKey;
  // The space a space chat is in: its chats list moves the chat up on each new
  // message too (`conversationsCache.touch`), and its roster colours the askers.
  // Until the record answers, the cached lists name it (`spaceOfListedChat`), so
  // the roster loads beside the record and the colours land with the first
  // transcript, not a moment after it.
  const listedSpace = useMemo(() => spaceOfListedChat(queryClient, conversationId), [queryClient, conversationId]);
  const spaceUuid = detailData ? (detailData.space?.uuid ?? null) : listedSpace;
  // A space chat's status (Spaces F4): the poll below, and the one read the
  // mount flow makes when it attaches to a turn already running.
  const statusOptions = useMemo(
    () => conversationsQueries.status({ conversationId, viewerId: serverUserId }),
    [conversationId, serverUserId],
  );
  const statusKey = statusOptions.queryKey;

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
    // The server took the reader's question (a send or Ask again, 2xx): it is the
    // chat's newest message, so the chat moves to the top of every list, its
    // space's chats too. Only now: a refused (403, 409) or failed send saved
    // nothing, so it moves nothing, and no refetch puts the row back down.
    onAccepted: () => {
      conversationsCache.touch(queryClient, conversationId, {
        spaceUuid: queryClient.getQueryData(detailKey)?.space?.uuid ?? null,
      });
    },
    onConnected: () => {
      // A connect is the mount flow's recovery decision made (the handoff's
      // attach, or the recovery's): the space chat's poll may run from now.
      setRecoveredFor(conversationId);
      if (isConfidentialMark(conversationId)) return;
      void queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'none' });
    },
    // The status the engine read to attach (a reload mid-turn, a turn the poll
    // or a 409 led to, Spaces F4): kept as the status poll's own entry, so whose
    // turn it is and whether Stop is this reader's are known from the moment it
    // attaches, whatever order the transcript and the status arrive in. Never
    // for a confidential chat, whose status the screen does not keep.
    onStatusRead: (id, response) => {
      if (isConfidentialMark(id)) return;
      queryClient.setQueryData(
        conversationsQueries.status({ conversationId: id, viewerId: serverUserId }).queryKey,
        response,
      );
    },
    onNarration: (text) => {
      const line = truncateNarration(text);
      if (line) setNarration(line);
    },
    // A turn finished: the answer is the chat's newest message, so the chat moves
    // to the top of every list (its space's chats too, the space read off the
    // cached record at the time it ends) with that time. This also covers the
    // home-created turn 1, whose send ran in start-conversation rather than
    // `submit`. No-op-stable when the row isn't cached (e.g. a
    // confidential stub the server omits), so it never fabricates a leak.
    //
    // ALSO the transcript's terminal cache write: the turn is persisted server-side,
    // so revalidate. With this screen mounted the active observer refetches in the
    // background (the engine ignores the result — it holds the richer live copy —
    // but the CACHE becomes server truth, so the next open is correct rather than
    // one turn short). With no observer left, the entry is simply marked invalid and
    // the next open revalidates on mount.
    onCompleted: () => {
      // The turn a refused send met is over (Spaces F4): its sender no longer
      // holds the next one. Cleared on every end of a stream, here and below.
      setRefusedTurn(null);
      conversationsCache.touch(queryClient, conversationId, {
        spaceUuid: queryClient.getQueryData(detailKey)?.space?.uuid ?? null,
      });
      if (isConfidentialMark(conversationId)) return;
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
    onError: () => setRefusedTurn(null),
    onCancelled: () => setRefusedTurn(null),
  });

  const { connectToStream, adoptConversationHistory, loadConversationHistoryFromIDB, setConversationId, setError, recoverPendingState, send, cancelStream, disconnect, fetchConversationTitle, isStreaming, messages, conversationTitle, turnOrigin } = stream;

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
  //
  // `liveRef` names the conversation this mount is showing, for async work that
  // starts outside this effect (a 409's follow, `takeRefusal`): set here, cleared
  // in the cleanup, so work that resolves after the reader left never attaches
  // to a turn nobody draws, or into another chat's transcript.
  const liveRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    liveRef.current = conversationId;

    const { message, executionId, attachments } = readConvInit(conversationId);
    setConversationId(conversationId);

    if (executionId && message) {
      // Fresh handoff from the home composer: attach to the live execution. The
      // creator is the owner (server-verified id threaded from the page).
      connectToStream(executionId, message, attachments);
      if (serverUserId != null) setLocalOwnerId(serverUserId);
      // Drop the ?init=1 marker so a manual reload takes the recovery path —
      // unless embedded, where the URL is the HOST's (`/cases/…?chat=…`, no
      // init marker to drop) and rewriting it would hijack the reader's page.
      if (!embedded && typeof window !== 'undefined') {
        window.history.replaceState({}, '', `/c/${conversationId}`);
      }
      return () => {
        cancelled = true;
        liveRef.current = null;
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
      //
      // KNOWN LIMIT, A SPACE CHAT OPENED FROM ITS CACHED COPY MID-TURN (Spaces F4,
      // accepted by the techlead 13 October 2026). `ensureQueryData` above hands
      // back the copy held in memory or on the device without waiting, so when a
      // colleague's turn is running the screen attaches below with a transcript
      // that ends BEFORE their question. The revisit's re-read lands while the
      // engine streams, and the engine declines it (a live stream is never
      // disturbed, `adoptConversationHistory`), so their answer streams in under
      // the earlier question. It resolves at the turn's end when the engine
      // followed it by polling (no execution id: `pollForCompletion` reloads the
      // whole transcript), and on the next open of the chat when it followed the
      // stream: the stream's terminal ids name the question as already shown,
      // so the merge after `completed` does not add it. A cold open reads the
      // transcript first and has neither gap; so does a turn the status poll
      // finds once the screen is open (it reads the transcript before attaching).
      // The status it reads reaches the screen before it attaches (`onStatusRead`
      // above), so a colleague's turn is held from its first frame.
      await recoverPendingState(conversationId).catch(() => {});
      if (cancelled) return;
      setRecoveredFor(conversationId);
    })();

    return () => {
      cancelled = true;
      liveRef.current = null;
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
    embedded,
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
    // Embedded, the header belongs to the HOST route (the case's title) —
    // publishing here would clobber it.
    if (embedded) return;
    // A tap from the list already published the row's title (move-first.tsx),
    // so the bar shows it from its first frame. Until this record's own title
    // resolves, publishing null would wipe that and bring the shimmer back; a
    // direct load starts from the empty store, so it still shows the shimmer.
    if (!conversationTitle) return;
    setHeaderContext(
      {
        title: stripPastedTags(conversationTitle),
        confidential: isConfidential,
      },
      conversationId,
    );
  }, [conversationTitle, isConfidential, embedded, conversationId]);

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

  // Clear on unmount only (a separate effect, so a title/flag change
  // republishes without a transient empty flash), so the next route never inherits
  // this conversation's context. Embedded, nothing was published — and clearing
  // would wipe the HOST's title the moment the panel closes.
  //
  // Owned: a tap from this chat to another (sidebar, drawer) has already
  // published the other chat's title by the time this one unmounts, and this
  // cleanup must not wipe it.
  useEffect(() => {
    if (embedded) return;
    return () => clearHeaderContext(conversationId);
  }, [embedded, conversationId]);

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
  // Sending is the server's answer when it gave one (space-turn.ts). The two
  // paths with no record (the fresh-create handoff, the device-only
  // confidential chat) are the owner's own, so ownership answers there.
  const canSend = detailData ? canSendIn(detailData, isOwner) : isOwner;
  const isSpaceChat = detailData?.space != null;
  // The reader is a member of the chat's space (they have a role in it). Only a
  // member may read the status (B4); a stranger reading a published space chat
  // would be refused it once and then re-read the transcript (F4 review N8).
  const isSpaceMember = isSpaceChat && detailData?.my_space_role != null;
  const showAuthors = isSpaceChat && hasSpaceContract(detailData);

  // The space's roster, for each person's colour (member-colour.ts): the Owner
  // first, then by join time. One page of a hundred covers a space; anyone
  // past it, or who has left, takes the next free colour by first appearance.
  const rosterQuery = useQuery({
    ...spacesQueries.members(spaceUuid ?? '', { viewerId: serverUserId, per_page: 100 }),
    // Early on the lists' word; once the record is here, only where it shows authors.
    enabled: spaceUuid !== null && (detailData === null || showAuthors),
  });
  const rosterRows = rosterQuery.data?.data;
  const spaceRoster = useMemo<readonly RosterEntry[] | null>(
    () =>
      showAuthors && rosterRows
        ? rosterRows.map((member) => ({
            uuid: member.user.uuid,
            owner: member.role === 'owner' || member.content_role === 'owner',
            joinedAt: member.joined_at ?? member.created_at,
          }))
        : null,
    [showAuthors, rosterRows],
  );
  // The record's own roster (backend, 17 October 2026): the colours from it
  // need no second read, which on a direct open came a round trip after the
  // transcript. The members read above stays, for tagging people and for an
  // asker it does not list (record-roster.ts).
  const recordRows = detailData?.space_roster;
  const recordRoster = useMemo<readonly RosterEntry[] | null>(
    () => (showAuthors && recordRows ? rosterFromRecord(recordRows) : null),
    [showAuthors, recordRows],
  );
  // The same roster, for tagging people (Viewers included, the reader left out;
  // mention-options.ts).
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const mentionOptions = useMemo(
    () => (showAuthors && rosterRows ? spaceMentionOptions(rosterRows, viewerUuid) : null),
    [showAuthors, rosterRows, viewerUuid],
  );

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
  // The skeleton waits SKELETON_HOLD_MS, so a device copy read in that time
  // paints with no skeleton flashed over it (measured on live, 7 October 2026).
  const showHistorySkeleton = useSkeletonHold(isLoadingHistory, conversationId);
  // A re-read that the server refuses (403 / 404 / 410) for a record we hold:
  // the conversation is gone elsewhere. A confidential one never asks the server.
  const isGoneOnServer = isGoneMarked || (!isConfidential && goneOnServer(detailQuery));
  // Once gone: mark it FIRST (which disables the query, so dropping it cannot
  // start a new read), then drop the transcript from memory and the row from
  // every cached list. The copy on the device was already deleted by the
  // persister when the re-read failed (persist/persister.ts, isGoneError).
  useEffect(() => {
    if (!isGoneOnServer || isGoneMarked) return;
    markGoneOnServer(conversationId);
    conversationsCache.remove(queryClient, conversationId);
    void queryClient.invalidateQueries({ queryKey: conversationsQueries.lists() });
    queryClient.removeQueries({ queryKey: [...conversationsQueries.details(), conversationId] });
  }, [isGoneOnServer, isGoneMarked, conversationId, queryClient]);

  // ── A space chat follows its other members (Spaces F4, backend B4). ──
  // B4 has no push channel, so an open space chat reads its status every four
  // seconds (`conversationsQueries.status`: paused in a hidden tab, stopped by
  // a 403 or 404). Never while this screen streams: the engine owns liveness
  // then. Never before the mount flow settled its recovery, never for a reader
  // who is not a member of the space, and never on a personal or confidential
  // chat.
  const statusQuery = useQuery({
    ...statusOptions,
    enabled:
      isSpaceMember &&
      !isConfidential &&
      !isGoneOnServer &&
      recoveredFor === conversationId &&
      !isStreaming,
  });
  const statusData = statusQuery.data?.data ?? null;

  // FOLLOW A TURN THAT IS ALREADY RUNNING (a colleague's in a space chat, or
  // the reader's own from another tab). Read the transcript FIRST, so the
  // turn's question is on screen (with its author) before the answer streams
  // under it, then attach: to the stream when its execution is known (B6: a
  // member may), else the way a reload mid-turn does (`recoverPendingState`:
  // the stream, or the engine's own status poll when there is no execution
  // yet). Two doors lead here, the status poll and a send refused with 409,
  // and they can open together, so one follow runs at a time.
  const followingRef = useRef(false);
  //
  // WHOSE TURN IT IS comes with the attach. `recoverPendingState` hands over the
  // status it reads (`onStatusRead`). An attach to a known execution reads the
  // status too when the screen does not hold a fresh one (`readStatus`: a 409's
  // follow; the status poll's own follow already holds it), so the screen is
  // never left showing the reader's own-turn state for a colleague's turn.
  const followTurn = useCallback(
    async (executionId: string | null, stillWanted: () => boolean, readStatus: boolean) => {
      if (followingRef.current) return;
      followingRef.current = true;
      try {
        await queryClient.refetchQueries({ queryKey: detailKey, exact: true });
        if (!stillWanted()) return;
        const fresh = queryClient.getQueryData(detailKey);
        if (fresh) adoptConversationHistory(fresh);
        if (executionId) {
          connectToStream(executionId);
          if (readStatus) void queryClient.fetchQuery(statusOptions).catch(() => {});
        } else {
          await recoverPendingState(conversationId).catch(() => {});
        }
      } finally {
        followingRef.current = false;
      }
    },
    [queryClient, detailKey, adoptConversationHistory, connectToStream, statusOptions, recoverPendingState, conversationId],
  );

  // React to each new status read, once. An engine action and query calls,
  // no setState, so it is React-Compiler-clean in an effect.
  //  - A turn is running and this screen is idle: follow it (`followTurn`).
  //  - Otherwise, a turn that began since the last read (it may have ended
  //    too) is fetched by reading the transcript again; the engine merges it.
  const seenStatusRef = useRef<ConversationStatusData | null>(null);
  useEffect(() => {
    if (statusData === null || statusData === seenStatusRef.current) return;
    const previous = seenStatusRef.current;
    seenStatusRef.current = statusData;
    if (isStreaming) return;
    // A message came since the last read (a colleague's question or its answer,
    // or the reader's own from another tab): the chat moves to the top of the
    // lists. The first read compares with nothing; the lists' own fetch has the
    // order up to then.
    const changed = previous !== null && turnChanged(previous, statusData);
    if (changed) conversationsCache.touch(queryClient, conversationId, { spaceUuid });
    if (statusData.status !== 'pending') {
      if (changed) void queryClient.refetchQueries({ queryKey: detailKey, exact: true });
      return;
    }
    let cancelled = false;
    void followTurn(statusData.execution_id, () => !cancelled, false);
    return () => {
      cancelled = true;
    };
  }, [statusData, isStreaming, queryClient, detailKey, followTurn, conversationId, spaceUuid]);

  // A refused status read: read the transcript again, whose own refusal
  // shows "not available" (gone.ts). The poll has already stopped itself.
  const statusRefused = stopsPolling(statusQuery.error);
  useEffect(() => {
    if (statusRefused) void queryClient.refetchQueries({ queryKey: detailKey, exact: true });
  }, [statusRefused, queryClient, detailKey]);

  // Whose turn streams, read off the last status, else off the refused send
  // that met it: a colleague's holds Send and names them; the reader's own
  // keeps Stop, unless the status says the reader may not cancel it.
  // Whose turn streams (space-turn.ts `whoseTurn`): from who started it, the
  // last status read, and a 409's sender, never from the conversation record,
  // so the answer does not depend on the order they arrive in. A pending status
  // outranks the refusal (a turn that ended by polling fires no handler, so a
  // later turn found by the poll may be someone else's).
  const turn = whoseTurn({
    isStreaming,
    origin: turnOrigin,
    status: statusData,
    refusal: refusedTurn,
    viewerId: serverUserId,
  });
  const heldBy = turn.kind === 'colleague' ? turn.name : null;
  // The clock runs from the turn's own start, not from when this screen began
  // to follow it.
  const heldSince = turn.kind === 'colleague' || turn.kind === 'unknown' ? turn.since : null;
  // Stop only for the reader's own turn: one this engine started, or one a
  // status says they may cancel (`can_cancel`, B4).
  const canStop = turn.kind === 'own' && turn.canStop;
  const turnLabel =
    turn.kind === 'colleague'
      ? askingLabel(turn.name)
      : turn.kind === 'unknown'
        ? UNKNOWN_TURN_LABEL
        : undefined;

  // What a refused send or re-ask changes here: a 409's turn is followed, read
  // first (`followTurn`), and its sender holds Send meanwhile; a 403 re-reads
  // the record, so `can_send` false swaps the composer for the view-only pill.
  const takeRefusal = useCallback(
    (refusal: SendRefusal) => {
      if (refusal.kind === 'held') {
        setRefusedTurn({ by: refusal.by, since: refusal.since });
        // The follow waits on a transcript read: it attaches only if this
        // screen still shows this chat when the read lands.
        void followTurn(refusal.executionId, () => liveRef.current === conversationId, true);
      } else if (refusal.kind !== 'unsent') {
        // An unsent turn reached nobody (likely offline): nothing changed to re-read.
        void queryClient.invalidateQueries({ queryKey: detailKey });
      }
    },
    [queryClient, detailKey, followTurn, conversationId],
  );

  const submit = useCallback(
    async (message: string, attachments: MessageAttachment[], replyTo: MessageReplyTo | null = null) => {
      // The last status read is from before this send: dropped, so a stale
      // "pending, by a colleague" can never label the reader's own turn, and
      // forgotten as seen, so the first read after this turn is not taken for
      // a new one (`onCompleted` already re-reads the transcript).
      queryClient.removeQueries({ queryKey: statusKey, exact: true });
      seenStatusRef.current = null;
      setRefusedTurn(null);
      const fileIds = attachments.map((a) => a.file_id);
      const refusal = await send(message, {
        conversationId,
        streamMode: 'v2_stream',
        jurisdiction,
        ...(fileIds.length > 0 && { fileIds, attachments }),
        ...(replyTo && { replyTo }),
      });
      if (refusal === null) return undefined;
      takeRefusal(refusal);
      return {
        refused: sendRefusal(refusal, serverUserId),
        ...(refusal.kind === 'reply-gone' && { dropReply: true as const }),
      };
    },
    [send, conversationId, jurisdiction, queryClient, statusKey, takeRefusal, serverUserId],
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
    // Route-shaped: drop the header and go home. Embedded: the host owns both
    // the header and the URL — just tell it the conversation is gone.
    const embedHandlers = embedRef.current;
    if (embedHandlers) {
      embedHandlers.onDeleted();
      return;
    }
    clearHeaderContext();
    router.push('/');
  }, [disconnect, conversationId, queryClient, router]);

  // "Ask again": re-send the last user turn (there is NO backend regenerate
  // endpoint, so this drives a fresh turn through engine.send — it genuinely adds
  // a new turn to the server thread, which is why the UI labels it "Ask again"
  // rather than faking an in-place regenerate). Guarded to completed, non-streaming,
  // and to the owner: a viewer of a shared chat cannot add a turn to it (the
  // server answers 404 for a conversation that is not theirs), so they are not
  // offered the button. In a space chat the last question may be a colleague's
  // (Spaces F4): asking it again would put their words under the owner's name,
  // so it is offered only on the owner's own question.
  const lastUserTurn = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i];
    }
    return null;
  }, [messages]);
  const lastUserContent = lastUserTurn?.content ?? null;

  const lastIsCompletedAssistant = useMemo(() => {
    const last = messages[messages.length - 1];
    return (
      !!last &&
      last.role === 'assistant' &&
      !last.isStreaming &&
      !('messageType' in last && (last as { messageType?: string }).messageType)
    );
  }, [messages]);

  const canRegenerate =
    isOwner &&
    !isStreaming &&
    lastIsCompletedAssistant &&
    lastUserTurn !== null &&
    !!lastUserTurn.content &&
    (!showAuthors || isOwnTurn(lastUserTurn, serverUserId));

  // A refused re-ask (Spaces F4: a colleague's turn, or a demotion) is told in
  // the composer's banner, as a refused send is; there is nothing to give back.
  const regenerate = useCallback(async (): Promise<SendRefused | undefined> => {
    if (isStreaming || !lastUserContent) return undefined;
    queryClient.removeQueries({ queryKey: statusKey, exact: true });
    seenStatusRef.current = null;
    setRefusedTurn(null);
    const refusal = await send(lastUserContent, {
      conversationId,
      streamMode: 'v2_stream',
      jurisdiction,
    });
    if (refusal === null) return undefined;
    takeRefusal(refusal);
    return { refused: askAgainRefusal(refusal, serverUserId) };
  }, [isStreaming, lastUserContent, queryClient, statusKey, send, conversationId, jurisdiction, takeRefusal, serverUserId]);

  return {
    stream,
    isOwner,
    canSend,
    viewOnlyReason: viewOnlyReason(detailData),
    isSpaceChat,
    spaceUuid,
    showAuthors,
    spaceRoster,
    recordRoster,
    mentionOptions,
    sendHeldBy: heldBy,
    heldSince,
    turnLabel,
    canStop,
    isOwnerResolved: ownerId !== null,
    isLoadingHistory,
    showHistorySkeleton,
    isGoneOnServer,
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
