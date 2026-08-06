import { useSyncExternalStore } from 'react';

import type { Message, MessageAttachment } from '@/types/collab';
import {
  deviceKey,
  parseMessageAttachment,
  parseMessageReplyTo,
  parseSlimUser,
  readStored,
  removeStored,
  writeStored,
} from './device-store';

/**
 * send-outbox — the tiny external store carrying each optimistic message's
 * SEND STATE (`sending` → gone on success, `failed` until retried or
 * discarded) AND the optimistic row itself. Phase-5 W2; the send-state
 * ladder is foundation-standards §5 ("optimistic insert → sending (subtle) →
 * sent (nothing) → failed (red icon + Retry inline, never silently
 * dropped)") + design-research DIRECTION 9 (2026-08-04).
 *
 * WHY A STORE BESIDE THE QUERY CACHE, HOLDING THE FULL ROW. The optimistic
 * row is written into the message cache too (ordering + the scroll contract
 * read one list) — but the cache is REFETCHABLE state: the room's join-time
 * reconcile and the spine's reconnect invalidation replace pages wholesale,
 * and server pages cannot contain a row the server never accepted. If the
 * cache were the only home, any background refetch would silently drop an
 * unsent message — the exact failure the ladder bans. So this store is the
 * row's durable home while unacknowledged: the feed merges outbox rows that
 * a refetch evicted back into the transcript, and only success (or an
 * explicit Discard) removes them.
 *
 * SNAPSHOT CONTRACT (Zustand-selector lesson, memory note): per-uuid entries
 * are immutable and replaced only when THAT entry changes; the per-channel
 * row arrays are rebuilt ONLY inside mutations. Both `useSendState` and
 * `useOutboxMessages` therefore return referentially-stable snapshots, so a
 * store notify re-renders only the subscribers whose slice actually moved.
 *
 * ── AND IT SURVIVES THE TAB (2026-08-06) ───────────────────────────────────
 * Everything above made a background refetch unable to drop an unsent message,
 * and then a tab close dropped it anyway — the store was memory. A `failed`
 * entry is now mirrored to the device (`./device-store.ts`, one key per
 * account) and comes back on the next load, so "never silently dropped" holds
 * across the one event most likely to happen to a message nobody has retried.
 *
 * ONLY `failed` IS WRITTEN, AND THAT IS THE WHOLE CARE OF IT. A `failed` entry
 * is a FACT: the request completed and the server refused it, so the message is
 * not there and re-posting it cannot duplicate anything. A `sending` entry is a
 * QUESTION — the tab died with the request in flight and it may well have
 * landed — and this API has no idempotency key with which to ask. Restoring a
 * question as an answer would put a row reading "Not sent · Retry" under a
 * message that IS sent, and a reader who obliges posts it twice. So a send
 * still in flight when the tab closes is not restored, and that gap is named
 * rather than papered over.
 *
 * THE ROW COMES BACK EXACTLY AS IT WAS, INCLUDING ITS FILES — a retry re-posts
 * `attachment_ids`, so it must still know them. The attachment `url`s it also
 * carries are signed for about an hour, so a row restored long after the fact
 * can paint a broken thumbnail until the retry succeeds and the server row
 * replaces it. That is a stale picture on a row already flagged as not sent,
 * against losing the message: the trade is not close.
 *
 * AND IT COMES BACK WHERE IT WAS WRITTEN, WHICH IS OFTEN OFF SCREEN. The feed
 * merges outbox rows by `created_at` (`./feed-model.ts`), so a message that
 * failed yesterday lands at the TOP of a freshly loaded newest page while the
 * reader lands at the bottom — restored, honest, and invisible. Restamping it
 * would be a lie about when it was written, so the row keeps its instant and
 * this store NAMES the ones it brought back from the device
 * ({@link useRestoredFailures}); the composer turns that into one line with a
 * way to reach them.
 *
 * ── TWO TABS SHARE ONE KEY (2026-08-06) ────────────────────────────────────
 * Persistence made a failed row visible in EVERY tab of the account, which was
 * never true while this store was memory. Retry it in one tab and it succeeds;
 * the other tab is still holding `failed` in memory, and its Retry button would
 * post the same message a second time — the very duplicate this module refuses
 * to persist a `sending` entry to avoid, arriving by another door.
 *
 * SO THE DISK IS THE AUTHORITY FOR `failed`, AND EVERY TAB LISTENS. A `storage`
 * event re-reads the key: a `failed` entry no longer on disk is dropped from
 * memory, and one on disk this tab has never seen is adopted. `sending` is
 * never touched by that pass — it is this tab's own in-flight request and was
 * deliberately never written down.
 */

export type SendStatus = 'sending' | 'failed';

export interface OutboxEntry {
  readonly status: SendStatus;
  /** What to re-POST on retry. */
  readonly content: string;
  readonly replyToUuid: string | null;
  readonly channelUuid: string;
  /** The optimistic row (uuid = the `local-` id) — the feed's merge source. */
  readonly message: Message;
}

/**
 * One failure this tab did not watch happen — it came off the device at
 * hydration, so it was written before this tab existed and sits wherever its
 * `created_at` puts it, which is above the newest page the reader is looking at.
 */
export interface RestoredFailure {
  readonly localUuid: string;
  /** The instant the message was written. Kept true — never restamped. */
  readonly createdAt: string;
}

const NO_MESSAGES: readonly Message[] = [];
const NO_RESTORED: readonly RestoredFailure[] = [];

const entries = new Map<string, OutboxEntry>();
/** Per-channel row arrays, rebuilt eagerly on every mutation so reads are
 *  stable references between notifies. */
const channelRows = new Map<string, readonly Message[]>();
/** Per-channel restored failures, same contract as {@link channelRows}. */
const channelRestored = new Map<string, readonly RestoredFailure[]>();
/**
 * Local uuids this tab took OFF THE DEVICE rather than sending itself. Only
 * hydration marks one: a failure adopted from another tab a moment ago is
 * minutes old and sorts into view on its own, so calling it "from earlier"
 * would be false.
 */
const restoredFromDisk = new Set<string>();
const listeners = new Set<() => void>();

function rebuildSnapshots(): void {
  channelRows.clear();
  channelRestored.clear();
  // A restored row that has since been sent or discarded is no longer anything
  // — drained here rather than at each exit, so no mutation can forget to.
  for (const localUuid of restoredFromDisk) {
    if (!entries.has(localUuid)) restoredFromDisk.delete(localUuid);
  }
  for (const [localUuid, entry] of entries) {
    const rows = channelRows.get(entry.channelUuid);
    channelRows.set(
      entry.channelUuid,
      rows ? [...rows, entry.message] : [entry.message],
    );
    // A restored row being retried right now is not a row that "wasn't sent" —
    // the line about it goes while the request is in flight, and comes back if
    // this attempt fails too.
    if (entry.status !== 'failed' || !restoredFromDisk.has(localUuid)) continue;
    const restored = channelRestored.get(entry.channelUuid);
    const row: RestoredFailure = { localUuid, createdAt: entry.message.created_at };
    channelRestored.set(
      entry.channelUuid,
      restored ? [...restored, row] : [row],
    );
  }
}

function notify(): void {
  rebuildSnapshots();
  for (const listener of listeners) listener();
}

/* ── The disk half ────────────────────────────────────────────────────────── */

/**
 * Bumped whenever a stored entry's shape changes. A record from an older
 * version is DROPPED rather than migrated: the alternative is a migration path
 * per deploy for data whose worst case is one unsent message the reader can
 * retype, and a wrong migration is harder to notice than a missing draft.
 */
const OUTBOX_FORMAT = 1;

/**
 * How many failed messages one account may leave on the device. A reader with
 * twenty unretried failures has a different problem, and an uncapped store of
 * 8000-character messages is a real hazard — so the OLDEST is dropped past the
 * cap. That is the one place this module drops an unsent message on purpose,
 * and it is bounded, deterministic and stated here.
 */
const MAX_PERSISTED = 20;

/**
 * Whose device this is, published by the composer (the one surface that both
 * knows the server-verified viewer id and makes sending possible at all).
 * `null` means nothing is written: a store keyed to nobody on a shared computer
 * is the failure the key scoping exists to prevent.
 */
let diskOwner: number | null = null;
/** The owner whose stored rows are already in memory — hydration runs once. */
let hydratedOwner: number | null = null;

function outboxKey(ownerId: number): string {
  return deviceKey('outbox', ownerId);
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

/**
 * Rebuild ONE optimistic row from its stored fields. Field by field, and never
 * more than an optimistic row ever holds — a row that entered this store was
 * built by `message-mutations`' `onMutate`, so `mentions` is `[]`, `edited_at`
 * is null, and there is no engagement state to invent.
 */
function reviveMessage(raw: unknown): Message | null {
  if (!isRecord(raw)) return null;
  const { uuid, channel_uuid, content, created_at, author, metadata } = raw;
  if (
    typeof uuid !== 'string' ||
    typeof channel_uuid !== 'string' ||
    typeof content !== 'string' ||
    typeof created_at !== 'string'
  ) {
    return null;
  }
  // A stored `null` author is Lawexa or a deleted account and is a VALUE; a
  // record we cannot read is a refusal, because rendering a real person as
  // "Deleted member" is a worse outcome than dropping the row.
  const revivedAuthor = author === null || author === undefined ? null : parseSlimUser(author);
  if (revivedAuthor === null && author !== null && author !== undefined) return null;

  const replyTo =
    raw.reply_to === null || raw.reply_to === undefined
      ? null
      : parseMessageReplyTo(raw.reply_to);
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .map(parseMessageAttachment)
        .filter((file): file is MessageAttachment => file !== null)
    : [];

  return {
    uuid,
    channel_uuid,
    is_ai: false,
    author: revivedAuthor,
    content,
    metadata: {
      mentions: [],
      lawexa_mentioned: isRecord(metadata) && metadata.lawexa_mentioned === true,
    },
    parent_message_uuid:
      typeof raw.parent_message_uuid === 'string' ? raw.parent_message_uuid : null,
    reply_to: replyTo,
    edited_at: null,
    created_at,
    attachments,
  };
}

/** Every stored row for the current owner, in the order they failed. */
function readPersisted(): { localUuid: string; entry: OutboxEntry }[] {
  if (diskOwner === null) return [];
  const raw = readStored(outboxKey(diskOwner));
  if (!isRecord(raw) || raw.v !== OUTBOX_FORMAT || !Array.isArray(raw.entries)) return [];

  const rows: { localUuid: string; entry: OutboxEntry }[] = [];
  for (const stored of raw.entries) {
    if (!isRecord(stored)) continue;
    const { localUuid, channelUuid, content, replyToUuid } = stored;
    if (typeof localUuid !== 'string' || typeof channelUuid !== 'string') continue;
    if (typeof content !== 'string') continue;
    const message = reviveMessage(stored.message);
    if (!message) continue;
    rows.push({
      localUuid,
      entry: {
        // Everything on disk is failed by construction — see the docblock.
        status: 'failed',
        content,
        replyToUuid: typeof replyToUuid === 'string' ? replyToUuid : null,
        channelUuid,
        message,
      },
    });
  }
  return rows;
}

/** Write the whole failed set back; past the cap the OLDEST failures go. */
function writePersisted(rows: readonly { localUuid: string; entry: OutboxEntry }[]): void {
  if (diskOwner === null) return;
  const key = outboxKey(diskOwner);
  if (rows.length === 0) {
    removeStored(key);
    return;
  }
  const kept = rows.length > MAX_PERSISTED ? rows.slice(rows.length - MAX_PERSISTED) : rows;
  writeStored(key, {
    v: OUTBOX_FORMAT,
    entries: kept.map(({ localUuid, entry }) => ({
      localUuid,
      channelUuid: entry.channelUuid,
      content: entry.content,
      replyToUuid: entry.replyToUuid,
      message: entry.message,
    })),
  });
}

/**
 * Read-modify-WRITE, one entry at a time, rather than dumping this tab's whole
 * map. Two tabs share one key, and a full-snapshot write would silently delete
 * every message the OTHER tab is holding — so the delta is kept as small as the
 * API allows.
 *
 * IT IS STILL NOT ATOMIC, AND SAYING OTHERWISE WOULD BE THE BUG. `localStorage`
 * has no compare-and-swap: two tabs failing a send in the same instant both read
 * the old array and both write, and the second write wins. What makes the tabs
 * converge is not this function — it is {@link adoptDisk}, which every tab runs
 * on the `storage` event that write produces, so within one turn every tab holds
 * exactly what is on the key. The residual is stated plainly: a lost update can
 * drop one failed row from the device, and then every tab agrees it is gone.
 * That is the same bounded, deliberate loss as {@link MAX_PERSISTED}, and it is
 * the safe direction — the other one leaves a live Retry on a sent message.
 */
function persistFailed(localUuid: string, entry: OutboxEntry): void {
  if (diskOwner === null) return;
  const rows = readPersisted().filter((row) => row.localUuid !== localUuid);
  rows.push({ localUuid, entry });
  writePersisted(rows);
}

function forgetPersisted(localUuid: string): void {
  if (diskOwner === null) return;
  const rows = readPersisted();
  const kept = rows.filter((row) => row.localUuid !== localUuid);
  if (kept.length === rows.length) return;
  writePersisted(kept);
}

/**
 * Take this account's key as it now stands: drop what another tab has resolved,
 * adopt what another tab has just failed.
 *
 * ONLY `failed` IS RECONCILED. A `sending` entry is this tab's own request, in
 * flight, and was deliberately never written down (see the docblock) — so its
 * absence from the key means nothing about it and it is left alone. A `failed`
 * entry, by contrast, IS the key: it was put there when it failed, and the only
 * things that take it off are a retry starting or the reader discarding it, in
 * whichever tab they did that.
 */
function adoptDisk(): void {
  if (diskOwner === null) return;
  const stored = new Map(
    readPersisted().map(({ localUuid, entry }) => [localUuid, entry] as const),
  );
  let changed = false;
  for (const [localUuid, entry] of entries) {
    if (entry.status !== 'failed' || stored.has(localUuid)) continue;
    entries.delete(localUuid);
    changed = true;
  }
  for (const [localUuid, entry] of stored) {
    if (entries.has(localUuid)) continue;
    entries.set(localUuid, entry);
    changed = true;
  }
  if (changed) notify();
}

function handleStorageChange(event: StorageEvent): void {
  if (diskOwner === null) return;
  // A `null` key is the whole store being cleared — ours went with it.
  if (event.key !== null && event.key !== outboxKey(diskOwner)) return;
  adoptDisk();
}

/** One listener for the life of the document: `storage` fires only in the OTHER
 *  tabs, so there is no self-echo to guard against and nothing to tear down. */
let listeningToOtherTabs = false;

function listenToOtherTabs(): void {
  if (listeningToOtherTabs || typeof window === 'undefined') return;
  window.addEventListener('storage', handleStorageChange);
  listeningToOtherTabs = true;
}

/**
 * Point the store at an account, and bring that account's failed messages back.
 *
 * CLEARING ON THE IDENTITY EDGE IS THE POINT, not the hydration. A sign-out and
 * a sign-in on one shared computer are both SOFT navigations in this app
 * (`v2/runtime/cache-identity-guard.tsx` documents the same trap for the query
 * cache), so without this the next reader inherits the previous one's unsent
 * messages in memory — visible in the transcript, retryable from their account.
 *
 * IT RUNS FROM THE V2 LAYOUT, NOT FROM A COMPOSER (2026-08-06). It used to hang
 * off `ChannelComposer`, which mounts only for someone who can post — so B
 * browsing home, cases or a channel they may only read never reached it, and A's
 * unsent messages stayed in memory for B's whole session. `v2/features/channels/
 * device-sweep.tsx` is the mount now, beside the cache guard, on the one edge
 * that is always crossed.
 *
 * IN AN EFFECT, ALWAYS. `localStorage` cannot be read on the server, so this
 * store's `getServerSnapshot` answers "nothing" by construction; filling it
 * during render would give the hydrating client a first snapshot the server
 * could not have produced, which is a hydration mismatch rather than a clever
 * head start. FORGETTING is the half that cannot wait for an effect — see
 * {@link outboxForget}.
 */
export function armOutboxStorage(ownerId: number | null): void {
  if (diskOwner === ownerId && hydratedOwner === ownerId) return;
  if (diskOwner !== ownerId) outboxForget();
  diskOwner = ownerId;
  hydratedOwner = ownerId;
  if (ownerId !== null) {
    listenToOtherTabs();
    for (const { localUuid, entry } of readPersisted()) {
      // Memory is empty by construction on the way in here — an owner edge
      // forgets everything above, and a call for the owner already armed
      // returned before it. The guard states the invariant anyway: a row this
      // tab is holding is the LIVE one, and the disk's snapshot of it must
      // never overwrite a retry in flight.
      if (entries.has(localUuid)) continue;
      entries.set(localUuid, entry);
      restoredFromDisk.add(localUuid);
    }
  }
  notify();
}

/**
 * Drop every row this store is holding, in MEMORY only. The disk is untouched:
 * these messages still belong to whoever wrote them, and the next time that
 * account is armed they come back.
 *
 * SAFE TO CALL DURING RENDER, and that is what it is for. Hydration has to wait
 * for an effect (see {@link armOutboxStorage}), but FORGETTING cannot: an effect
 * clears one commit late, and one commit is long enough to paint A's unsent
 * message, under A's name, in B's transcript. So the identity guard calls this
 * in render — it writes no React state and it NEVER NOTIFIES, so nothing here
 * schedules an update while another component is rendering. It does not need to:
 * every `useSyncExternalStore` re-reads its snapshot on the render that follows,
 * and the effect's `armOutboxStorage` notifies a beat later for anything that
 * did not re-render at all.
 */
export function outboxForget(): void {
  entries.clear();
  channelRows.clear();
  channelRestored.clear();
  restoredFromDisk.clear();
  diskOwner = null;
  hydratedOwner = null;
}

/* ── Mutations ────────────────────────────────────────────────────────────── */

/** A NEW send (or a retry's re-arm) — in flight, so nothing is written: only a
 *  settled failure is a fact worth keeping (see the docblock). */
export function outboxSet(localUuid: string, entry: OutboxEntry): void {
  entries.set(localUuid, entry);
  notify();
}

export function outboxMarkFailed(localUuid: string): void {
  const current = entries.get(localUuid);
  if (!current || current.status === 'failed') return;
  const failed: OutboxEntry = { ...current, status: 'failed' };
  entries.set(localUuid, failed);
  persistFailed(localUuid, failed);
  notify();
}

export function outboxMarkSending(localUuid: string): void {
  const current = entries.get(localUuid);
  if (!current || current.status === 'sending') return;
  entries.set(localUuid, { ...current, status: 'sending' });
  // Off the disk while it is in flight: if this attempt lands, the tab that
  // reloads next must not find a "not sent" copy of a message that is sent.
  forgetPersisted(localUuid);
  notify();
}

/** Success or discard — the entry (and its row's overlay) is gone. */
export function outboxRemove(localUuid: string): void {
  const existed = entries.delete(localUuid);
  forgetPersisted(localUuid);
  if (!existed) return;
  notify();
}

export function outboxGet(localUuid: string): OutboxEntry | undefined {
  return entries.get(localUuid);
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * A row's send state: `null` for every real (server-acknowledged) message.
 * Subscribed per row — the snapshot is that row's entry object, so only rows
 * whose delivery state moved re-render on a store change.
 */
export function useSendState(messageUuid: string): OutboxEntry | null {
  return useSyncExternalStore(
    subscribe,
    () => entries.get(messageUuid) ?? null,
    () => null,
  );
}

/**
 * Every unacknowledged optimistic row for one channel, in send order — the
 * feed merges these back in whenever a refetch evicted them from the cache.
 * Stable reference between store mutations; frozen-empty when none.
 */
export function useOutboxMessages(channelUuid: string): readonly Message[] {
  return useSyncExternalStore(
    subscribe,
    () => channelRows.get(channelUuid) ?? NO_MESSAGES,
    () => NO_MESSAGES,
  );
}

/**
 * The failures this tab brought back from the device, oldest first — the rows
 * that are in the transcript at their true instant and therefore nowhere near
 * the reader, who lands at the bottom. Empty for a tab that has failed sends of
 * its own only; those are exactly where they were written.
 *
 * Same snapshot contract as {@link useOutboxMessages}: rebuilt only inside a
 * mutation, frozen-empty when there are none.
 */
export function useRestoredFailures(channelUuid: string): readonly RestoredFailure[] {
  return useSyncExternalStore(
    subscribe,
    () => channelRestored.get(channelUuid) ?? NO_RESTORED,
    () => NO_RESTORED,
  );
}
