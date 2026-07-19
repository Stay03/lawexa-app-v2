'use client';

/**
 * v2 chat-engine — confidential transcript store (IndexedDB).
 *
 * PORTED from v1's `lib/storage/confidentialTranscriptStore.ts` (per the wave brief:
 * the confidential engine lands inside `chat-engine/` as a self-contained, clearly
 * named module rather than an import back into v1). Confidential conversations are
 * device-owned: they 404 from the server by design, so their full transcript lives
 * here in IndexedDB and never leaves the device except as the prior-turn `messages[]`
 * the client re-sends each confidential turn.
 *
 * WIRE / SCHEMA COMPATIBILITY — the database identity is byte-for-byte identical to
 * v1 (`DB_NAME`/`DB_VERSION`/`STORE`/keyPath/index below). During the strangler
 * period a confidential conversation created under v1 must remain readable under v2
 * and vice-versa; both open the SAME physical database. => Any future schema change
 * MUST be coordinated across BOTH this module and v1's (bump `DB_VERSION` in lockstep
 * with a migration), or one side will hit a VersionError.
 *
 * IMPROVEMENT over v1: the connection is typed with idb's `DBSchema` generic, so the
 * previous `as ConfidentialTranscript` casts on every `get`/`put` are gone — reads
 * and writes are statically checked against the store's value type.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ConfidentialHistoryEntry } from '@/types/chat';

const DB_NAME = 'lawexa-confidential';
const DB_VERSION = 1;
const STORE = 'transcripts';

/**
 * Confidential FILE lifetime (fix round §A7-39, item 1c). Confidential UPLOADS are
 * deleted server-side after 24 hours — this is the documented server policy, shown
 * to the user in the composer's file notice ("kept for up to 24 hours, then
 * permanently deleted"). The upload response (`DocumentUploadResponse`, types/chat.ts)
 * carries NO expiry timestamp, so there is no server-authoritative value to read;
 * this 24h policy is the real contract, and it is stamped onto each attachment at
 * write time as `expires_at`. IMPORTANT: this bounds only the FILE, never the
 * TRANSCRIPT TEXT — the owner copy promises the transcript is "stored on this device
 * until you delete it", so the text has NO TTL; only the ephemeral server file does.
 */
const CONFIDENTIAL_FILE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ConfidentialAttachment {
  file_id: number;
  file_name: string;
  file_size: number;
  /**
   * When the server-side FILE is deleted (write time + 24h; see
   * {@link CONFIDENTIAL_FILE_TTL_MS}). Optional so v1-written rows (which never set
   * it — the DB is physically shared) read back cleanly and are treated as
   * never-expiring by {@link isConfidentialAttachmentExpired}.
   */
  expires_at?: string;
}

/**
 * True when a confidential attachment's server file has passed its `expires_at`
 * (the 24h server-side deletion). PURE — `now` is threaded in (never `Date.now()`
 * in a render path). A missing/unparseable `expires_at` (e.g. a legacy v1-written
 * row) is treated as NOT expired, so nothing is pruned on uncertainty.
 */
export function isConfidentialAttachmentExpired(
  expiresAt: string | undefined,
  now: number,
): boolean {
  if (!expiresAt) return false;
  const at = Date.parse(expiresAt);
  return !Number.isNaN(at) && at <= now;
}

/** Stamp `expires_at` (write time + the 24h file policy) onto attachments that
 *  don't already carry one — the single point that populates the dormant field. */
function withFileExpiry(attachments: ConfidentialAttachment[]): ConfidentialAttachment[] {
  const expiresAt = new Date(Date.now() + CONFIDENTIAL_FILE_TTL_MS).toISOString();
  return attachments.map((a) => (a.expires_at ? a : { ...a, expires_at: expiresAt }));
}

export interface ConfidentialTranscriptEntry {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  created_at: string;
  local_id: string;
  attachments?: ConfidentialAttachment[];
}

export interface ConfidentialTranscript {
  conversation_id: string;
  created_at: string;
  updated_at: string;
  agent_id?: number;
  workflow_id?: number;
  title?: string;
  messages: ConfidentialTranscriptEntry[];
}

// Typed schema — the single improvement over v1's untyped `IDBPDatabase`. The
// keyPath and index MUST match v1 exactly (see the compatibility note above).
interface ConfidentialDB extends DBSchema {
  transcripts: {
    key: string;
    value: ConfidentialTranscript;
    indexes: { updated_at: string };
  };
}

let dbPromise: Promise<IDBPDatabase<ConfidentialDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ConfidentialDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable on the server'));
  }
  if (!dbPromise) {
    dbPromise = openDB<ConfidentialDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'conversation_id' });
          store.createIndex('updated_at', 'updated_at');
        }
      },
    });
  }
  return dbPromise;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Return the transcript for a conversation, creating an empty one if absent. */
export async function ensureTranscript(
  conversation_id: string,
  seed?: Partial<Omit<ConfidentialTranscript, 'conversation_id'>>,
): Promise<ConfidentialTranscript> {
  const db = await getDB();
  const existing = await db.get(STORE, conversation_id);
  if (existing) return existing;

  const transcript: ConfidentialTranscript = {
    conversation_id,
    created_at: seed?.created_at ?? nowIso(),
    updated_at: seed?.updated_at ?? nowIso(),
    agent_id: seed?.agent_id,
    workflow_id: seed?.workflow_id,
    title: seed?.title,
    messages: seed?.messages ?? [],
  };
  await db.put(STORE, transcript);
  return transcript;
}

/** Read a transcript, or null if this device has none for the conversation. */
export async function getTranscript(
  conversation_id: string,
): Promise<ConfidentialTranscript | null> {
  const db = await getDB();
  const row = await db.get(STORE, conversation_id);
  return row ?? null;
}

/** True if this device holds a transcript for the conversation (cheap key probe). */
export async function hasTranscript(conversation_id: string): Promise<boolean> {
  const db = await getDB();
  const key = await db.getKey(STORE, conversation_id);
  return key != null;
}

/** Append a user turn (persisted BEFORE the POST so a crash never loses it). */
export async function appendUserTurn(
  conversation_id: string,
  payload: { content: string; attachments?: ConfidentialAttachment[] },
): Promise<ConfidentialTranscriptEntry> {
  const transcript = await ensureTranscript(conversation_id);
  const entry: ConfidentialTranscriptEntry = {
    role: 'user',
    content: payload.content,
    created_at: nowIso(),
    local_id: newLocalId(),
    ...(payload.attachments && payload.attachments.length > 0 && {
      // Stamp the 24h file expiry as the attachment is persisted, so the dormant
      // `expires_at` field reflects the file's real server-side lifetime (§A7-39).
      attachments: withFileExpiry(payload.attachments),
    }),
  };
  const updated: ConfidentialTranscript = {
    ...transcript,
    updated_at: nowIso(),
    messages: [...transcript.messages, entry],
  };
  const db = await getDB();
  await db.put(STORE, updated);
  return entry;
}

/**
 * Replace the content of the most recent user turn. Used by redacted-mode chats to
 * swap the raw input (written pre-POST for crash recovery) with the server-returned
 * redacted form once the response lands. Idempotent — no-op if the tail isn't a user
 * turn.
 */
export async function replaceLastUserTurnContent(
  conversation_id: string,
  content: string,
): Promise<void> {
  const transcript = await getTranscript(conversation_id);
  if (!transcript) return;
  const tail = transcript.messages[transcript.messages.length - 1];
  if (!tail || tail.role !== 'user') return;
  const merged: ConfidentialTranscriptEntry = { ...tail, content };
  const updated: ConfidentialTranscript = {
    ...transcript,
    updated_at: nowIso(),
    messages: [...transcript.messages.slice(0, -1), merged],
  };
  const db = await getDB();
  await db.put(STORE, updated);
}

/**
 * Append (or idempotently update) the assistant turn. If the tail is already an
 * assistant row, its content is replaced — this is what makes the `text_done` and
 * `completed` writes idempotent: the first creates the row, the second updates it
 * with the authoritative final text.
 *
 * Never creates the transcript itself (unlike {@link appendUserTurn}): the user
 * turn is always persisted BEFORE the POST, so an absent transcript here means it
 * was just DELETED — a late in-flight write must not resurrect a row the user
 * erased (§A7-39). Returns null in that case.
 */
export async function appendAssistantTurn(
  conversation_id: string,
  content: string,
): Promise<ConfidentialTranscriptEntry | null> {
  const transcript = await getTranscript(conversation_id);
  if (!transcript) return null;

  const tail = transcript.messages[transcript.messages.length - 1];
  if (tail && tail.role === 'assistant') {
    const merged: ConfidentialTranscriptEntry = { ...tail, content };
    const updated: ConfidentialTranscript = {
      ...transcript,
      updated_at: nowIso(),
      messages: [...transcript.messages.slice(0, -1), merged],
    };
    const db = await getDB();
    await db.put(STORE, updated);
    return merged;
  }

  const entry: ConfidentialTranscriptEntry = {
    role: 'assistant',
    content,
    created_at: nowIso(),
    local_id: newLocalId(),
  };
  const updated: ConfidentialTranscript = {
    ...transcript,
    updated_at: nowIso(),
    messages: [...transcript.messages, entry],
  };
  const db = await getDB();
  await db.put(STORE, updated);
  return entry;
}

/** Set the transcript title (no-op if the transcript doesn't exist yet). */
export async function upsertTranscriptTitle(
  conversation_id: string,
  title: string,
): Promise<void> {
  const existing = await getTranscript(conversation_id);
  if (!existing) return;
  const db = await getDB();
  await db.put(STORE, { ...existing, title, updated_at: nowIso() });
}

/**
 * Re-key a transcript from a provisional id to the server-assigned id. A single
 * readwrite transaction puts the renamed row and deletes the old key atomically.
 */
export async function renameTranscript(oldId: string, newId: string): Promise<void> {
  if (oldId === newId) return;
  const db = await getDB();
  const existing = await db.get(STORE, oldId);
  if (!existing) return;
  const renamed: ConfidentialTranscript = {
    ...existing,
    conversation_id: newId,
    updated_at: nowIso(),
  };
  const tx = db.transaction(STORE, 'readwrite');
  await tx.store.put(renamed);
  await tx.store.delete(oldId);
  await tx.done;
}

/** All conversation ids with a local transcript on this device. */
export async function listConversationIds(): Promise<string[]> {
  const db = await getDB();
  const keys = await db.getAllKeys(STORE);
  return keys.map((k) => String(k));
}

/** Delete a single transcript. */
export async function deleteTranscript(conversation_id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, conversation_id);
}

/** Wipe every transcript (e.g. on logout). */
export async function clearAllTranscripts(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

/**
 * Project a transcript into the `messages[]` prior-turn array the client re-sends
 * on every confidential turn (role + content only — the server reads but never
 * stores these).
 */
export function historyEntriesFor(
  transcript: ConfidentialTranscript | null,
): ConfidentialHistoryEntry[] {
  if (!transcript) return [];
  return transcript.messages.map((m) => ({ role: m.role, content: m.content }));
}
