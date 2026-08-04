'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { queryOptions } from '@tanstack/react-query';

/**
 * draft-mirror — the note editor's device-local copy of the working draft.
 *
 * WHAT IT IS FOR. Autosave puts the note on the server every 1.5 idle seconds,
 * which covers everything except the gap: the keystrokes since the last save,
 * the burst that was in flight when the tab died, and everything typed while the
 * network (or the plan's create quota) refused the save outright. This store
 * holds the working copy through all of that, including for a note that does not
 * exist on the server yet.
 *
 * ── IT IS OFFERED, NEVER APPLIED ────────────────────────────────────────────
 * Nothing here restores anything. On entry the editor READS the mirror, compares
 * it with what the server returned, and if the local copy is newer it offers the
 * reader a choice with the timestamp attached ("Unsaved changes from …
 * Restore / Discard"). A silent restore would be the one behaviour a local copy
 * must never have: it can be stale, it can predate an edit made on another
 * device, and overwriting the server copy with it is not ours to decide.
 *
 * ── SHAPE BORROWED FROM `confidential-transcript.ts` ────────────────────────
 * Same module shape as the chat engine's device store: a versioned typed
 * `DBSchema`, one lazily-opened connection, plain async functions, and an owner
 * stamp so a shared device never shows one account's draft to the next person to
 * sign in. Two deliberate differences:
 *
 *  - This database is NEW and v2-only, so it has no byte-for-byte compatibility
 *    obligation to v1 and `owner_user_id` is REQUIRED rather than optional.
 *  - Every operation DEGRADES rather than rejects. A confidential transcript is
 *    the only copy of its content and a failure there must be loud; here the
 *    server holds the note, so a browser in private mode with IndexedDB blocked
 *    should simply lose the safety net, not the editor.
 */

const DB_NAME = 'lawexa-note-drafts';
const DB_VERSION = 1;
const STORE = 'drafts';

/**
 * How long an untouched mirror row survives. Rows are pruned on editor entry,
 * so this is the outer bound on how far back a "you have unsaved changes" offer
 * can reach — long enough to cover a laptop left closed over a holiday, short
 * enough that the store never becomes an unbounded archive of abandoned drafts.
 */
const MIRROR_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface NoteDraftMirror {
  /**
   * The row's identity. `note:{id}` once the note exists on the server,
   * `draft:{uuid}` before it does — and the row is RE-KEYED at the moment of
   * creation (see {@link adoptDraftMirror}) so one editing session leaves one row
   * behind, not two.
   */
  key: string;
  /** The server id, or `null` while the note has never been created. */
  note_id: number | null;
  /** `null` means untitled — the same first-class state the wire uses. */
  title: string | null;
  /** The full HTML body as the editor held it. */
  content: string;
  /** When this row was written (ISO). What the restore offer shows the reader. */
  updated_at: string;
  /**
   * Who was signed in when it was written. A device is not a person: without
   * this, the next person to sign in on a shared laptop could be offered a
   * colleague's unsaved note. Reads filter on it and never explain a miss.
   */
  owner_user_id: number;
}

interface NoteDraftDB extends DBSchema {
  drafts: {
    key: string;
    value: NoteDraftMirror;
    indexes: { updated_at: string };
  };
}

let dbPromise: Promise<IDBPDatabase<NoteDraftDB>> | null = null;

function getDB(): Promise<IDBPDatabase<NoteDraftDB>> | null {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  if (!dbPromise) {
    dbPromise = openDB<NoteDraftDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('updated_at', 'updated_at');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Run a store operation, or give up quietly. Private browsing, a blocked
 * storage origin, or a quota refusal all land here — none of them is a reason to
 * break the editor, because the server copy is the real one.
 */
async function withStore<T>(
  run: (db: IDBPDatabase<NoteDraftDB>) => Promise<T>,
  fallback: T,
): Promise<T> {
  const pending = getDB();
  if (!pending) return fallback;
  try {
    return await run(await pending);
  } catch {
    return fallback;
  }
}

/** The mirror key for a note that exists on the server. */
export function noteMirrorKey(noteId: number): string {
  return `note:${noteId}`;
}

/** The mirror key for a note that does not exist yet. */
export function draftMirrorKey(draftId: string): string {
  return `draft:${draftId}`;
}

/** A fresh client draft id — the pre-create identity of one editing session. */
export function newDraftId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Write (or overwrite) the working copy for one key. */
export async function writeDraftMirror(record: NoteDraftMirror): Promise<void> {
  await withStore(async (db) => {
    await db.put(STORE, record);
  }, undefined);
}

/** Read one row, or `null` — including when it belongs to a different account. */
export async function readDraftMirror(
  key: string,
  viewerId: number | null,
): Promise<NoteDraftMirror | null> {
  if (viewerId === null) return null;
  return withStore(async (db) => {
    const row = await db.get(STORE, key);
    if (!row || row.owner_user_id !== viewerId) return null;
    return row;
  }, null);
}

/** Forget one row (the reader discarded it, or its note was deleted). */
export async function deleteDraftMirror(key: string): Promise<void> {
  await withStore(async (db) => {
    await db.delete(STORE, key);
  }, undefined);
}

/**
 * Re-key a pre-create row onto its new server id, atomically. Called the moment
 * a create succeeds, so the session that started as `draft:{uuid}` continues as
 * `note:{id}` instead of leaving an orphan behind that the next visit to
 * `/notes/create` would offer to restore.
 */
export async function adoptDraftMirror(
  draftId: string,
  noteId: number,
): Promise<void> {
  const from = draftMirrorKey(draftId);
  const to = noteMirrorKey(noteId);
  await withStore(async (db) => {
    const existing = await db.get(STORE, from);
    if (!existing) return;
    const tx = db.transaction(STORE, 'readwrite');
    await tx.store.put({ ...existing, key: to, note_id: noteId });
    await tx.store.delete(from);
    await tx.done;
  }, undefined);
}

/**
 * The newest never-created draft this viewer left behind, if any. This is what
 * `/notes/create` offers to restore: a session that ended before its first save
 * has no note id and therefore no address, so the only way back to it is to ask
 * the store what the most recent one was.
 */
export async function latestUnsentDraftMirror(
  viewerId: number | null,
): Promise<NoteDraftMirror | null> {
  if (viewerId === null) return null;
  return withStore(async (db) => {
    const rows = await db.getAllFromIndex(STORE, 'updated_at');
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      if (row.note_id === null && row.owner_user_id === viewerId) return row;
    }
    return null;
  }, null);
}

/**
 * Drop rows older than {@link MIRROR_TTL_MS}. Runs on entry rather than on a
 * schedule: the only moment the store's size matters is when something is about
 * to read it, and a browser has no other place to run maintenance.
 */
export async function pruneDraftMirror(now: number): Promise<void> {
  await withStore(async (db) => {
    const rows = await db.getAllFromIndex(STORE, 'updated_at');
    const expired = rows.filter((row) => {
      const at = Date.parse(row.updated_at);
      return !Number.isNaN(at) && now - at > MIRROR_TTL_MS;
    });
    if (expired.length === 0) return;
    const tx = db.transaction(STORE, 'readwrite');
    await Promise.all(expired.map((row) => tx.store.delete(row.key)));
    await tx.done;
  }, undefined);
}

/** What one entry's mirror lookup needs to know. */
export interface DraftMirrorLookup {
  /** The row for this editing session's key, or `null`. */
  mirror: NoteDraftMirror | null;
  /**
   * A never-created draft found by scanning (create route only). Separate from
   * `mirror` because it carries its OWN key — restoring it adopts that identity
   * rather than starting a new one.
   */
  orphan: NoteDraftMirror | null;
}

/**
 * The editor's ONE device-local read, as a query leaf.
 *
 * TanStack rather than an effect on purpose: this is an async read with pending
 * and error states, and routing it through the query cache keeps the editor free
 * of the `useState` + `useEffect` pair the React Compiler lint rejects.
 *
 * Its own root key (`note-draft-mirror`), NOT under `notesQueries.all`: a note
 * list invalidation has no business re-reading a device file, and this row is
 * not server state.
 *
 * `gcTime: 0` + `staleTime: 0` — every entry to the editor asks the device
 * afresh, and nothing lingers in the cache behind it. `refetchOnWindowFocus` is
 * off because a local file has no writer but this tab; that is not papering over
 * staleness, it is the absence of a second source.
 */
export function draftMirrorQuery(params: {
  key: string;
  viewerId: number | null;
  /** Scan for an abandoned never-created draft too (the create route). */
  includeOrphan: boolean;
}) {
  const { key, viewerId, includeOrphan } = params;
  return queryOptions({
    queryKey: ['note-draft-mirror', key, { viewerId, includeOrphan }] as const,
    queryFn: async (): Promise<DraftMirrorLookup> => {
      await pruneDraftMirror(Date.now());
      const [mirror, orphan] = await Promise.all([
        readDraftMirror(key, viewerId),
        includeOrphan ? latestUnsentDraftMirror(viewerId) : Promise.resolve(null),
      ]);
      return { mirror, orphan };
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
