'use client';

import { useEffect, useState } from 'react';
import { Check, CloudOff, Loader2, RotateCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { AutosaveView } from './use-autosave';

/**
 * SaveIndicator — what the editor says about saving, which is: as little as
 * possible, for as short a time as possible.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * A permanently lit "Saved" badge is a lie dressed as reassurance: it is true
 * for a second and then it is just decoration, and the reader learns to ignore
 * it — including on the day it says something else. So the confirmation is
 * TRANSIENT (a tick and a word, held two and a half seconds, then faded out),
 * silence is the normal state, and the only thing that persists is a genuine
 * problem.
 *
 * A FAILURE IS QUIET, NOT LOUD. Autosave fires every 1.5 idle seconds; an
 * offline reader would drown in toasts, so the save mutation opts out of the
 * global error channel (`meta.silentError`) and reports here instead — one
 * small chip with a real retry. While a retry is already scheduled the chip
 * says so and offers no button, because pressing it would only race the timer.
 *
 * ── THE FADE, WITHOUT A TIMER IN AN EFFECT BODY ─────────────────────────────
 * The reset is the house's sanctioned "adjust state during render" pattern (the
 * same one `useUrlSearch` uses): a new `savedAt` is noticed in render and clears
 * the faded flag there, so no `setState` runs synchronously inside an effect —
 * which the React Compiler lint rejects outright. The effect only arms a
 * timeout, which is asynchronous and therefore fine.
 */

/** How long a confirmation is worth reading before it gets out of the way. */
const FLASH_MS = 2_500;

export function SaveIndicator({
  status,
  savedAt,
  failure,
  retryScheduled,
  onRetry,
}: Pick<AutosaveView, 'status' | 'savedAt' | 'failure' | 'retryScheduled'> & {
  onRetry: () => void;
}) {
  const [seenSavedAt, setSeenSavedAt] = useState(savedAt);
  const [faded, setFaded] = useState(false);

  // Render-phase reset — a fresh save restarts the flash.
  if (savedAt !== seenSavedAt) {
    setSeenSavedAt(savedAt);
    setFaded(false);
  }

  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setFaded(true), FLASH_MS);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const content = renderSaveState({
    status,
    savedAt,
    failure,
    retryScheduled,
    onRetry,
    faded,
  });

  return (
    // ONE ALWAYS-MOUNTED SLOT, WITH A FLOOR UNDER ITS WIDTH.
    //
    // Returning `null` between saves was a layout bug hiding in a design rule:
    // the header row is `justify-between`, so an indicator that vanished every
    // time typing resumed pulled the insert buttons and the ⋯ menu sideways —
    // right, left, right — once per save cycle. Nothing may move while someone
    // is writing. The slot is therefore permanent and wide enough for its
    // ordinary contents ("Saving" / "Saved"); only the error chip, which is rare
    // and which the reader is meant to notice, is allowed to exceed it.
    //
    // It is also the live region. Keeping ONE `role="status"` mounted for the
    // whole session is what makes a change inside it announce reliably —
    // mounting a fresh live region per state is the classic way to get silence.
    <span
      role="status"
      className="inline-flex min-h-6 min-w-[4.75rem] items-center justify-end gap-1.5 text-xs"
    >
      {content}
    </span>
  );
}

/** The slot's contents for one save state. Pure — the live region is its parent. */
function renderSaveState({
  status,
  savedAt,
  failure,
  retryScheduled,
  onRetry,
  faded,
}: Pick<AutosaveView, 'status' | 'savedAt' | 'failure' | 'retryScheduled'> & {
  onRetry: () => void;
  faded: boolean;
}): React.ReactNode {
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 dark:text-amber-400">
        <CloudOff aria-hidden className="size-3.5" />
        {retryScheduled ? (
          <span>Couldn&apos;t save — retrying</span>
        ) : (
          <>
            <span>
              {failure?.kind === 'rejected' ? failure.message : "Couldn't save"}
            </span>
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                'v2-interactive inline-flex min-h-6 items-center gap-1 rounded-full px-2 font-medium text-foreground transition-colors hover:bg-secondary',
                FOCUS_RING,
              )}
            >
              <RotateCw aria-hidden className="size-3" />
              Retry
            </button>
          </>
        )}
      </span>
    );
  }

  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" />
        Saving
      </span>
    );
  }

  // The confirmation, and the two silences that share its box: unsaved-but-
  // scheduled, and a note nothing has happened to yet. Rendered rather than
  // omitted so the row cannot move — invisible, and hidden from assistive
  // technology, so the silence is real and not merely quiet.
  const showing = status === 'clean' && savedAt !== null && !faded;
  return (
    <span
      aria-hidden={!showing}
      className={cn(
        'inline-flex items-center gap-1.5 text-muted-foreground transition-opacity duration-500 motion-reduce:transition-none',
        showing ? 'opacity-100' : 'opacity-0',
      )}
    >
      <Check aria-hidden className="size-3.5" />
      Saved
    </span>
  );
}
