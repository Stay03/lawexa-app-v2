'use client';

import { useCallback, useRef, useState } from 'react';

import type { LawyerDocumentType } from '@/lib/api/lawyerVerification';
import { extractApiError } from '@/lib/utils/api-error';
import { documentProblem, uploadFailure } from './model';
import { useEnsureVerificationProfile, useUploadVerificationDocument } from './queries';

/**
 * use-document-uploads — the file on its way to each slot: how far it has
 * got, whether it failed and why, and what can be done about it. At most one
 * per slot, because a slot holds one file and the server refuses a second.
 *
 * It follows the channel upload tray (`channels/files/use-upload-queue.ts`) on
 * the three points that tray settled the hard way:
 *
 *  - `mutateAsync`, one promise per file. A mutation observer holds ONE set of
 *    per-call callbacks and drops the earlier ones, so with two slots
 *    uploading at once only the last would ever leave its "uploading" state.
 *  - 100 % is not done. When every byte is sent the server is still storing
 *    the file, so the slot says "Finishing" and offers no Cancel, because
 *    aborting then would drop a response for a file that is stored anyway.
 *  - Only an attempt that could succeed again is retried. A refusal before
 *    sending (wrong type, too big) or by the server (a 422: this slot already
 *    has a file) carries its reason and a Dismiss; a dropped connection or a
 *    server fault carries Retry (`uploadFailure` in `model.ts`).
 *
 * A file that arrives leaves this state in the same turn its document joins
 * the cached profile, so the slot turns from progress into the stored file
 * rather than flashing empty in between.
 */

export type UploadStatus = 'uploading' | 'finishing' | 'failed' | 'rejected';

export interface UploadEntry {
  /** New on every attempt, so a late answer to an old one is ignored. */
  attempt: number;
  type: LawyerDocumentType;
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

export type UploadsBySlot = Partial<Record<LawyerDocumentType, UploadEntry>>;

export interface DocumentUploads {
  bySlot: UploadsBySlot;
  /** Uploads that will become documents if they succeed. */
  inFlight: number;
  /** Check one file against the rules, then send it for `type`. */
  add: (type: LawyerDocumentType, file: File) => void;
  cancel: (type: LawyerDocumentType) => void;
  retry: (type: LawyerDocumentType) => void;
  dismiss: (type: LawyerDocumentType) => void;
}

export function useDocumentUploads(hasProfile: boolean): DocumentUploads {
  const uploadAsync = useUploadVerificationDocument().mutateAsync;
  const ensureAsync = useEnsureVerificationProfile().mutateAsync;

  const [bySlot, setBySlot] = useState<UploadsBySlot>({});
  const nextAttempt = useRef(0);
  /** Refs, not state: neither is drawn, and a `File` in state would be copied
   *  on every progress tick. */
  const files = useRef(new Map<LawyerDocumentType, File>());
  const controllers = useRef(new Map<LawyerDocumentType, AbortController>());
  /** One profile creation shared by every slot of the first uploads. */
  const creating = useRef<Promise<void> | null>(null);

  /** Update a slot's entry IF it is still the same attempt: a cancelled
   *  upload's late rejection must not bring its row back. */
  const patch = useCallback(
    (type: LawyerDocumentType, attempt: number, next: Partial<UploadEntry>) => {
      setBySlot((previous) => {
        const entry = previous[type];
        if (!entry || entry.attempt !== attempt) return previous;
        return { ...previous, [type]: { ...entry, ...next } };
      });
    },
    [],
  );

  /** Drop a slot's entry; with `attempt`, only if it is still that attempt. */
  const clear = useCallback((type: LawyerDocumentType, attempt?: number) => {
    setBySlot((previous) => {
      const entry = previous[type];
      if (!entry || (attempt !== undefined && entry.attempt !== attempt)) return previous;
      const next = { ...previous };
      delete next[type];
      return next;
    });
  }, []);

  const ensureProfile = useCallback((): Promise<void> => {
    if (hasProfile) return Promise.resolve();
    if (!creating.current) {
      creating.current = ensureAsync().catch((error: unknown) => {
        // Let the next upload try again rather than reusing a failure.
        creating.current = null;
        throw error;
      });
    }
    return creating.current;
  }, [hasProfile, ensureAsync]);

  const start = useCallback(
    async (type: LawyerDocumentType, file: File) => {
      const attempt = nextAttempt.current++;
      const controller = new AbortController();
      controllers.current.get(type)?.abort();
      controllers.current.set(type, controller);
      files.current.set(type, file);
      setBySlot((previous) => ({
        ...previous,
        [type]: {
          attempt,
          type,
          name: file.name,
          total: file.size,
          sent: 0,
          status: 'uploading',
          message: null,
          retryable: false,
          cancellable: true,
        },
      }));
      try {
        await ensureProfile();
        await uploadAsync({
          file,
          documentType: type,
          signal: controller.signal,
          onProgress: (sent, total) => {
            const finished = sent >= total;
            patch(type, attempt, {
              sent,
              total,
              status: finished ? 'finishing' : 'uploading',
              cancellable: !finished,
            });
          },
        });
        files.current.delete(type);
        controllers.current.delete(type);
        clear(type, attempt);
      } catch (error) {
        if (controller.signal.aborted) return;
        const { message, retryable } = uploadFailure(extractApiError(error));
        patch(type, attempt, { status: 'failed', message, retryable, cancellable: false });
      }
    },
    [ensureProfile, uploadAsync, patch, clear],
  );

  const add = useCallback(
    (type: LawyerDocumentType, file: File) => {
      const problem = documentProblem(file);
      if (!problem) {
        void start(type, file);
        return;
      }
      files.current.delete(type);
      setBySlot((previous) => ({
        ...previous,
        [type]: {
          attempt: nextAttempt.current++,
          type,
          name: file.name,
          total: file.size,
          sent: 0,
          status: 'rejected',
          message: problem,
          retryable: false,
          cancellable: false,
        },
      }));
    },
    [start],
  );

  const cancel = useCallback(
    (type: LawyerDocumentType) => {
      controllers.current.get(type)?.abort();
      controllers.current.delete(type);
      files.current.delete(type);
      clear(type);
    },
    [clear],
  );

  const retry = useCallback(
    (type: LawyerDocumentType) => {
      const file = files.current.get(type);
      if (file) void start(type, file);
    },
    [start],
  );

  const dismiss = useCallback(
    (type: LawyerDocumentType) => {
      files.current.delete(type);
      clear(type);
    },
    [clear],
  );

  const inFlight = Object.values(bySlot).filter(
    (entry) => entry.status === 'uploading' || entry.status === 'finishing',
  ).length;

  return { bySlot, inFlight, add, cancel, retry, dismiss };
}
