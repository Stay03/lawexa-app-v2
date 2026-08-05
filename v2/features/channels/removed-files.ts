import { useSyncExternalStore } from 'react';

/**
 * removed-files — the tiny external store that tells the composer a file it is
 * holding has LEFT the channel's library. Same shape as `./send-outbox.ts`
 * (module store + `useSyncExternalStore`, no context, no zustand), for the same
 * reason: one publisher, one subscriber, and nothing worth a provider.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Attaching a file stages a LIBRARY ROW in the composer — the upload put it in
 * two places at once, and the staging tray says so, with a link to the Files
 * section. A reader who follows that link and deletes the file used to come
 * back to a chip that was still armed: Send posted an id the server no longer
 * had, the 422 was silent, and the row landed in the outbox as "Not sent" with
 * a Retry that re-posted the same dead id forever. The reader lost the message
 * and its caption for following the composer's own instruction.
 *
 * So the delete publishes here — from the mutation's `onMutate` (the viewer's
 * own delete, optimistic) and from the room's `.file.changed` `removed` branch
 * (anybody's) — and the composer drops the chip BEFORE a send can carry it.
 * Parsing the 422 afterwards would be too late by exactly one lost message.
 *
 * ── THE LOG IS APPEND-ONLY, AND THAT IS THE DESIGN ─────────────────────────
 * The optimistic delete can fail and roll the LIBRARY back. Nothing rolls back
 * here, and a rolled-back file is never re-staged: the reader watched that chip
 * disappear, and a control that puts itself back — possibly after they have
 * already sent — is worse than one file they can attach again in two taps. The
 * file is still in the library, so re-attaching is exactly that.
 *
 * Nothing prunes a channel's set either. Entries are integers, one per file
 * ever deleted while this tab was open, and the set is the only thing that can
 * answer "was this id revoked?" for a chip staged at any point afterwards.
 *
 * SNAPSHOT CONTRACT (the outbox's, and the Zustand-selector lesson): a
 * channel's set is REPLACED only when that channel gains an id, so every
 * subscriber gets a referentially-stable snapshot and a publish re-renders only
 * the composer whose channel actually moved.
 */

/** One frozen empty set for every channel that has lost nothing. */
const NONE: ReadonlySet<number> = new Set();

const removedByChannel = new Map<string, ReadonlySet<number>>();
const listeners = new Set<() => void>();

/**
 * A file has left this channel's library — optimistically, or because someone
 * else deleted it. Idempotent: a re-delivered broadcast notifies nobody.
 */
export function noteChannelFileRemoved(channelUuid: string, fileId: number): void {
  const current = removedByChannel.get(channelUuid) ?? NONE;
  if (current.has(fileId)) return;
  const next = new Set(current);
  next.add(fileId);
  removedByChannel.set(channelUuid, next);
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * The ids this channel's library has lost since the tab opened. Stable
 * reference between publishes; frozen-empty when nothing has gone, and on the
 * server, where no file has been deleted by definition.
 */
export function useRemovedChannelFiles(channelUuid: string): ReadonlySet<number> {
  return useSyncExternalStore(
    subscribe,
    () => removedByChannel.get(channelUuid) ?? NONE,
    () => NONE,
  );
}
