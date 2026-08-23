'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

/** How long a held request waits before it is actually sent. */
export const HELD_COMMIT_MS = 5000;

interface HoldOptions {
  /** Identifies the hold; a second hold on the same key commits the first. */
  key: string;
  /** Toast copy shown for the duration of the hold. */
  message: string;
  /** Sends the real request. Runs after the delay, on flush, or on unmount. */
  onCommit: () => void;
  /** Reverts the optimistic UI. Runs only if Undo is pressed in time. */
  onUndo: () => void;
}

interface PendingHold {
  timer: number;
  toastId: string | number;
  commit: () => void;
}

/**
 * Delays an irreversible request so the only undo that can exist — the one
 * before the request leaves — actually does. The screen updates optimistically
 * at hold time; `onCommit` fires after HELD_COMMIT_MS unless the reviewer
 * presses Undo on the toast, in which case no request is ever sent.
 *
 * `flush` commits every pending hold immediately. The page calls it when the
 * reviewer moves to another case, and the unmount cleanup does the same, so a
 * held action can outrun the person's attention but never outlive the screen.
 * The one way a hold is genuinely lost is closing the tab inside the window —
 * and that loss is in the safe direction: nothing was deleted or published,
 * and the row simply returns on the next load.
 */
export function useHeldCommits() {
  const pendingRef = useRef(new Map<string, PendingHold>());

  const flush = useCallback(() => {
    for (const hold of pendingRef.current.values()) {
      window.clearTimeout(hold.timer);
      toast.dismiss(hold.toastId);
      hold.commit();
    }
    pendingRef.current.clear();
  }, []);

  const hold = useCallback(({ key, message, onCommit, onUndo }: HoldOptions) => {
    const existing = pendingRef.current.get(key);
    if (existing) {
      window.clearTimeout(existing.timer);
      toast.dismiss(existing.toastId);
      existing.commit();
    }

    const commit = () => {
      pendingRef.current.delete(key);
      onCommit();
    };

    const undo = () => {
      const current = pendingRef.current.get(key);
      if (!current) return;
      window.clearTimeout(current.timer);
      pendingRef.current.delete(key);
      toast.dismiss(current.toastId);
      onUndo();
    };

    const timer = window.setTimeout(() => {
      const current = pendingRef.current.get(key);
      if (!current) return;
      toast.dismiss(current.toastId);
      current.commit();
    }, HELD_COMMIT_MS);

    const toastId = toast(message, {
      duration: HELD_COMMIT_MS,
      action: { label: 'Undo', onClick: undo },
    });

    pendingRef.current.set(key, { timer, toastId, commit });
  }, []);

  // Commit anything still pending if the screen unmounts mid-hold. The map is
  // empty on a fresh mount, so strict-mode's double invocation is a no-op.
  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const holdEntry of pending.values()) {
        window.clearTimeout(holdEntry.timer);
        toast.dismiss(holdEntry.toastId);
        holdEntry.commit();
      }
      pending.clear();
    };
  }, []);

  return { hold, flush };
}
