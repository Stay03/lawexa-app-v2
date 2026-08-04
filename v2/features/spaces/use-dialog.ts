'use client';

import { useCallback, useState } from 'react';

/**
 * useDialog — open/close state for a form dialog that must play BOTH of its
 * transitions and still open with fresh fields.
 *
 * ── THE TWO REQUIREMENTS PULL IN OPPOSITE DIRECTIONS ───────────────────────
 * 1. A dialog rendered as `{open ? <Dialog open …/> : null}` is UNMOUNTED the
 *    instant it closes, so Radix Presence never gets to run its exit — Cancel
 *    is a hard cut, which the house motion rule forbids (every show/hide gets
 *    a deliberate transition in BOTH directions).
 * 2. A dialog mounted unconditionally keeps its `useState` initialisers from
 *    the FIRST mount forever — so an edit dialog reopened after a save would
 *    show the values it was born with, not the ones now on screen.
 *
 * ── THE RESOLUTION: REMOUNT ON OPEN, NEVER ON CLOSE ────────────────────────
 * The dialog stays mounted for its whole life (so closing animates), and
 * {@link DialogState.openKey} increments on every OPEN. Spread it as the
 * component's `key` and each opening is a fresh mount — fields re-derived from
 * current props — while each closing is the same instance fading out. The
 * remount lands in the same commit as `open: true`, so the entrance animation
 * runs normally from `data-state="open"`.
 *
 * Shared by the spaces and organizations dialogs so the pattern exists once.
 * Phase-5 W4 fix round, 2026-08-04.
 */
export interface DialogState {
  open: boolean;
  /** Increments per opening — spread as the dialog component's `key`. */
  openKey: number;
  /** Open it, remounting the body so its fields are re-derived. */
  show: () => void;
  /** The dialog's `onOpenChange`. Closing never remounts, so the exit plays. */
  setOpen: (open: boolean) => void;
}

export function useDialog(): DialogState {
  const [open, setOpenState] = useState(false);
  const [openKey, setOpenKey] = useState(0);

  const show = useCallback(() => {
    setOpenKey((previous) => previous + 1);
    setOpenState(true);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
  }, []);

  return { open, openKey, show, setOpen };
}
