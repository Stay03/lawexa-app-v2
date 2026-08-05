'use client';

import { useCallback, useRef, useState } from 'react';

import { extractApiError } from '@/lib/utils/api-error';
import { useUploadChannelFile } from '../lists-files-mutations';
import { validateChannelFile } from '../model';

/**
 * use-upload-queue — the state behind the docked upload tray: what is in
 * flight, how far along it is, what failed and why, and what the reader can do
 * about each one.
 *
 * ── WHAT IT REPLACES ───────────────────────────────────────────────────────
 * A spinner and the word "Uploading…" — no percentage, no cancel — beside an
 * UNBOUNDED red strip of rejection sentences that only a Dismiss-all could
 * clear. The research is unambiguous on both halves: a determinate indicator
 * is the right form once a wait passes ~10s (and a 15 MB cap over a phone
 * connection is well past it), and a queue that shows progress without
 * offering cancel gives information but no agency. Rejections belong in the
 * same place as the uploads they were meant to join, addressable one at a
 * time.
 *
 * ── 100 % IS NOT "DONE", SO IT NEVER SAYS SO ───────────────────────────────
 * `onUploadProgress` measures BYTES PUT ON THE WIRE. When the last byte is
 * sent the server is still storing and content-sniffing the file, and a bar
 * parked at 100 % for two seconds reads as a hang. So a fully-sent upload
 * moves to its own `finishing` state and says "Finishing…" until the response
 * lands — the honest description of what is actually happening.
 *
 * ── ONE OBSERVER, MANY UPLOADS: WHY `mutateAsync` ─────────────────────────
 * A queue is a MULTI-file surface, and `useMutation` is a SINGLE observer.
 * TanStack v5 stores the per-call callbacks passed to `mutate(vars, {onSuccess,
 * onError})` on the observer as `#mutateOptions` and OVERWRITES them on every
 * subsequent `mutate()`, detaching the previous mutation — so with three files
 * in flight only the LAST one's callbacks ever fire. The hook-level cache
 * writer still runs for all three (it lives on the mutation, not the observer),
 * which is what makes the bug so quiet: the files really do land in the
 * library while their tray rows sit at "Finishing…" forever, a 422 never
 * reaches `failed`, and each stranded row pins a `File` of up to 15 MB plus an
 * `AbortController` for the life of the tab.
 *
 * `mutateAsync` returns a PROMISE PER CALL, which is not shared state, so each
 * upload resolves or rejects on its own. Every call is therefore awaited in its
 * own `try`/`catch` here, and nothing about this queue depends on observer-level
 * callbacks.
 *
 * ── CANCELLATION IS NOT A FAILURE ──────────────────────────────────────────
 * An aborted request rejects like any other, so the queue cannot tell the two
 * apart from the error alone — and asking it to would mean importing axios's
 * cancellation sentinel into a v2 feature. Instead, cancelling REMOVES the
 * entry immediately, and every failure handler writes through an updater that
 * only touches an entry still present. An entry the reader dismissed cannot be
 * resurrected by its own late rejection.
 *
 * ── AND CANCEL IS OFFERED ONLY WHILE IT CAN WORK ──────────────────────────
 * `finishing` means every byte is already on the wire and the server is
 * storing the file. Aborting there tears down a response the server will
 * complete anyway, so the row would vanish and the file would appear in the
 * library a second later. {@link UploadEntry.cancellable} says when the verb is
 * honest, and the tray renders it only then.
 *
 * ── ONLY A REAL ATTEMPT MAY BE RETRIED ─────────────────────────────────────
 * A client-side rejection ("isn't a supported file type", "larger than 15 MB")
 * is not going to succeed the second time, so those entries carry the reason
 * and a Dismiss, never a Retry that would spend a round trip to be told the
 * same thing. Entries that reached the server keep the file and offer Retry —
 * the one control that lets a dropped connection be recovered without hunting
 * for the file again.
 */

export type UploadStatus = 'uploading' | 'finishing' | 'failed' | 'rejected';

export interface UploadEntry {
  id: number;
  name: string;
  /** Bytes accepted for sending — the denominator of the progress bar. */
  total: number;
  /** Bytes on the wire so far. */
  sent: number;
  status: UploadStatus;
  /** The reason, for `failed` / `rejected`. */
  message: string | null;
  /** Present only when the entry can be tried again. */
  retryable: boolean;
  /** Whether aborting would actually stop anything — see the docblock. */
  cancellable: boolean;
}

export interface UploadQueue {
  entries: readonly UploadEntry[];
  /** Validate and start every file in a selection or a drop. */
  add: (files: FileList | readonly File[]) => void;
  /** Abort an in-flight upload and drop its row. */
  cancel: (id: number) => void;
  /** Send a failed upload again, from the file already in hand. */
  retry: (id: number) => void;
  /** Drop one finished-with row (a failure or a rejection). */
  dismiss: (id: number) => void;
  /** Drop every finished-with row. In-flight uploads are untouched. */
  dismissSettled: () => void;
}

export function useUploadQueue(channelUuid: string): UploadQueue {
  const uploadFile = useUploadChannelFile(channelUuid);
  // `mutateAsync`, never `mutate` — one observer cannot hold per-call callbacks
  // for concurrent uploads. See the docblock.
  const uploadAsync = uploadFile.mutateAsync;

  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const nextId = useRef(0);
  /** The bytes of each entry that can still be retried, and its abort handle.
   *  Refs, not state: neither is rendered, and a `File` in state would make
   *  every progress tick copy it. */
  const files = useRef(new Map<number, File>());
  const controllers = useRef(new Map<number, AbortController>());

  /** Update one entry IF IT IS STILL PRESENT — the whole cancellation model. */
  const patch = useCallback((id: number, next: Partial<UploadEntry>) => {
    setEntries((previous) => {
      let changed = false;
      const rows = previous.map((entry) => {
        if (entry.id !== id) return entry;
        changed = true;
        return { ...entry, ...next };
      });
      return changed ? rows : previous;
    });
  }, []);

  const forget = useCallback((id: number) => {
    files.current.delete(id);
    controllers.current.delete(id);
  }, []);

  /** Fire one attempt for an entry whose row already exists. Every call gets
   *  its OWN promise, so concurrent uploads never share a resolution path. */
  const start = useCallback(
    async (id: number, file: File) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      try {
        await uploadAsync({
          file,
          signal: controller.signal,
          onProgress: (sent, total) => {
            // Whole-percent granularity: axios fires this per chunk, and a
            // render per chunk would be a hundred renders per file for a bar
            // that cannot show the difference.
            setEntries((previous) => {
              const entry = previous.find((row) => row.id === id);
              if (!entry || entry.status === 'failed' || entry.status === 'rejected') {
                return previous;
              }
              const done = sent >= total;
              const status: UploadStatus = done ? 'finishing' : 'uploading';
              const samePercent =
                Math.floor((entry.sent / Math.max(1, entry.total)) * 100) ===
                Math.floor((sent / Math.max(1, total)) * 100);
              if (samePercent && entry.status === status) return previous;
              return previous.map((row) =>
                row.id === id
                  ? { ...row, sent, total, status, cancellable: !done }
                  : row,
              );
            });
          },
        });
        forget(id);
        // The cache writer (the hook's own `onSuccess`) has the row now; the
        // tray's job for this file is over.
        setEntries((previous) => previous.filter((entry) => entry.id !== id));
      } catch (error) {
        // A cancellation lands here too, and correctly does nothing: `cancel`
        // already removed the row, and `patch` only touches a row still present.
        controllers.current.delete(id);
        patch(id, {
          status: 'failed',
          message: extractApiError(error).message,
          retryable: true,
          cancellable: false,
        });
      }
    },
    [forget, patch, uploadAsync],
  );

  const add = useCallback(
    (incoming: FileList | readonly File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      const rows: UploadEntry[] = [];
      const starts: { id: number; file: File }[] = [];

      for (const file of list) {
        const id = (nextId.current += 1);
        const rejection = validateChannelFile(file);
        if (rejection) {
          rows.push({
            id,
            name: file.name,
            total: file.size,
            sent: 0,
            status: 'rejected',
            message: rejection,
            retryable: false,
            cancellable: false,
          });
          continue;
        }
        files.current.set(id, file);
        rows.push({
          id,
          name: file.name,
          total: file.size,
          sent: 0,
          status: 'uploading',
          message: null,
          retryable: false,
          cancellable: true,
        });
        starts.push({ id, file });
      }

      setEntries((previous) => [...previous, ...rows]);
      // `void`: each attempt owns its own promise and reports through state.
      for (const attempt of starts) void start(attempt.id, attempt.file);
    },
    [start],
  );

  const cancel = useCallback(
    (id: number) => {
      controllers.current.get(id)?.abort();
      forget(id);
      setEntries((previous) => previous.filter((entry) => entry.id !== id));
    },
    [forget],
  );

  const retry = useCallback(
    (id: number) => {
      const file = files.current.get(id);
      if (!file) return;
      patch(id, {
        status: 'uploading',
        sent: 0,
        message: null,
        retryable: false,
        cancellable: true,
      });
      void start(id, file);
    },
    [patch, start],
  );

  const dismiss = useCallback(
    (id: number) => {
      forget(id);
      setEntries((previous) => previous.filter((entry) => entry.id !== id));
    },
    [forget],
  );

  const dismissSettled = useCallback(() => {
    // The released handles are computed HERE, not inside the updater: a state
    // updater must be pure, and React may run it twice.
    for (const entry of entries) {
      if (entry.status === 'failed' || entry.status === 'rejected') forget(entry.id);
    }
    setEntries((previous) =>
      previous.filter(
        (entry) => entry.status === 'uploading' || entry.status === 'finishing',
      ),
    );
  }, [entries, forget]);

  return { entries, add, cancel, retry, dismiss, dismissSettled };
}
