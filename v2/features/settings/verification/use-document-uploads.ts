'use client';

import { useCallback, useRef, useState } from 'react';

import { extractApiError } from '@/lib/utils/api-error';
import { sortSelection } from './model';
import { useEnsureVerificationProfile, useUploadVerificationDocument } from './queries';

/**
 * use-document-uploads — the files on their way to the server: how far each
 * one has got, which failed and why, and what can be done about each.
 *
 * It follows the channel upload tray (`channels/files/use-upload-queue.ts`) on
 * the three points that tray settled the hard way:
 *
 *  - `mutateAsync`, one promise per file. A mutation observer holds ONE set of
 *    per-call callbacks and drops the earlier ones, so with two files in flight
 *    only the last would ever leave its "uploading" state.
 *  - 100 % is not done. When every byte is sent the server is still storing
 *    the file, so the row says "Finishing" and offers no Cancel, because
 *    aborting then would drop a response for a file that is stored anyway.
 *  - Only a real attempt can be retried. A refusal before sending (wrong type,
 *    too big, no place left) carries its reason and a Dismiss.
 *
 * A file that arrives is removed from this list in the same turn its document
 * joins the cached profile, so the progress row turns into the document row
 * rather than leaving a gap.
 */

export type UploadStatus = 'uploading' | 'finishing' | 'failed' | 'rejected';

export interface UploadEntry {
  id: number;
  name: string;
  /** Bytes to send: the progress bar's denominator. */
  total: number;
  /** Bytes sent so far. */
  sent: number;
  status: UploadStatus;
  /** The reason, for `failed` and `rejected`. */
  message: string | null;
  retryable: boolean;
  cancellable: boolean;
}

export interface DocumentUploads {
  entries: readonly UploadEntry[];
  /** Uploads that will become documents if they succeed. */
  inFlight: number;
  /** Check a selection against the rules and the places left, then send it. */
  add: (files: readonly File[], placesLeft: number) => void;
  cancel: (id: number) => void;
  retry: (id: number) => void;
  dismiss: (id: number) => void;
}

/** A failure the reader can act on, in the server's words when it has some. */
function failureMessage(error: unknown): string {
  const apiError = extractApiError(error);
  if (apiError.status === 422 && apiError.errors) {
    const first = Object.values(apiError.errors).flat()[0];
    if (first) return first;
  }
  if (apiError.status >= 400 && apiError.status < 500) return apiError.message;
  return 'The upload did not finish. Check your connection and try again.';
}

export function useDocumentUploads(hasProfile: boolean): DocumentUploads {
  const uploadAsync = useUploadVerificationDocument().mutateAsync;
  const ensureAsync = useEnsureVerificationProfile().mutateAsync;

  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const nextId = useRef(0);
  /** Refs, not state: neither is drawn, and a `File` in state would be copied
   *  on every progress tick. */
  const files = useRef(new Map<number, File>());
  const controllers = useRef(new Map<number, AbortController>());
  /** One profile creation shared by every file of the first selection. */
  const creating = useRef<Promise<void> | null>(null);

  /** Update one entry IF IT IS STILL THERE: a cancelled upload's late
   *  rejection must not bring its row back. */
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

  const drop = useCallback((id: number) => {
    files.current.delete(id);
    controllers.current.delete(id);
    setEntries((previous) => previous.filter((entry) => entry.id !== id));
  }, []);

  const ensureProfile = useCallback((): Promise<void> => {
    if (hasProfile) return Promise.resolve();
    if (!creating.current) {
      creating.current = ensureAsync().catch((error: unknown) => {
        // Let the next selection try again rather than reusing a failure.
        creating.current = null;
        throw error;
      });
    }
    return creating.current;
  }, [hasProfile, ensureAsync]);

  const start = useCallback(
    async (id: number, file: File) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      patch(id, {
        status: 'uploading',
        sent: 0,
        message: null,
        retryable: false,
        cancellable: true,
      });
      try {
        await ensureProfile();
        await uploadAsync({
          file,
          signal: controller.signal,
          onProgress: (sent, total) => {
            const finished = sent >= total;
            patch(id, {
              sent,
              total,
              status: finished ? 'finishing' : 'uploading',
              cancellable: !finished,
            });
          },
        });
        drop(id);
      } catch (error) {
        if (controller.signal.aborted) return;
        patch(id, {
          status: 'failed',
          message: failureMessage(error),
          retryable: true,
          cancellable: false,
        });
      }
    },
    [ensureProfile, uploadAsync, patch, drop],
  );

  const add = useCallback(
    (selection: readonly File[], placesLeft: number) => {
      const verdict = sortSelection(selection, placesLeft);
      const added: UploadEntry[] = [];
      const toStart: Array<[number, File]> = [];

      for (const { file, reason } of verdict.rejected) {
        added.push({
          id: nextId.current++,
          name: file.name,
          total: file.size,
          sent: 0,
          status: 'rejected',
          message: reason,
          retryable: false,
          cancellable: false,
        });
      }
      for (const file of verdict.accepted) {
        const id = nextId.current++;
        files.current.set(id, file);
        toStart.push([id, file]);
        added.push({
          id,
          name: file.name,
          total: file.size,
          sent: 0,
          status: 'uploading',
          message: null,
          retryable: false,
          cancellable: true,
        });
      }

      if (added.length === 0) return;
      setEntries((previous) => [...previous, ...added]);
      for (const [id, file] of toStart) void start(id, file);
    },
    [start],
  );

  const cancel = useCallback(
    (id: number) => {
      controllers.current.get(id)?.abort();
      drop(id);
    },
    [drop],
  );

  const retry = useCallback(
    (id: number) => {
      const file = files.current.get(id);
      if (file) void start(id, file);
    },
    [start],
  );

  const inFlight = entries.filter(
    (entry) => entry.status === 'uploading' || entry.status === 'finishing',
  ).length;

  return { entries, inFlight, add, cancel, retry, dismiss: drop };
}
