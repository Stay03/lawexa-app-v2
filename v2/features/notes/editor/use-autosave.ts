'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { NoteRecord } from '../types';
import { useSaveNote } from '../mutations';
import {
  initialAutosaveState,
  reduceAutosave,
  type AutosaveEvent,
  type AutosaveFailure,
  type AutosaveState,
  type AutosaveStatus,
  type NoteDraft,
  type SaveRequest,
} from './autosave-machine';
import { classifySaveFailure } from './save-failure';

/**
 * use-autosave — the DRIVER for `autosave-machine.ts`: the clock, the wire, and
 * the page-lifecycle listeners. Every decision still belongs to the machine;
 * this hook only supplies the three things a pure function cannot have.
 *
 * ── WHY THE MACHINE STATE IS NOT REACT STATE ────────────────────────────────
 * `change()` fires on every keystroke. Putting the whole machine in `useState`
 * would re-render the screen once per character — the toolbar, the header, the
 * status line — for a state change nothing on screen can see (`working` and the
 * debounce anchors are internal). So the machine lives in a ref and React holds
 * only the VIEW: the five values the UI actually renders. A burst of typing
 * inside one `pending` window therefore causes ZERO re-renders, and the screen
 * repaints exactly when the save state visibly changes.
 *
 * ── THE TIMER IS RECONCILED, NOT DECLARED ───────────────────────────────────
 * For the same reason, the debounce cannot be a `useEffect` keyed on `wakeAt`:
 * `wakeAt` is not React state. After every transition the driver reconciles its
 * ONE `setTimeout` against the machine's `wakeAt` — clear it, and re-arm only if
 * the deadline moved. That is precisely what a debounce is, spelled out.
 *
 * ── LEAVING THE PAGE ────────────────────────────────────────────────────────
 * Three exits, all flushing through the machine (which refuses if a save is
 * already in flight or a rate-limit hold is open):
 *
 *   `visibilitychange` → hidden   the reliable mobile signal (Page Lifecycle
 *                                 API); a backgrounded tab may never get
 *                                 anything else.
 *   `pagehide`                    the bfcache-safe teardown signal.
 *   unmount                       an in-app navigation away from the editor.
 *
 * `beforeunload` is deliberately absent: it disqualifies the page from the
 * back/forward cache, does not fire at all on mobile Safari, and Chrome is
 * retiring the family it belongs to.
 *
 * ONLY THE FIRST OF THE THREE IS RELIABLE, AND THE DESIGN SAYS SO. A flush
 * issues an ordinary axios request; there is no `keepalive` on that path, so a
 * request started while the page is being destroyed may simply never leave.
 * `visibilitychange` → hidden is the signal that arrives while the page is
 * still fully alive — it fires on every real backgrounding and tab close,
 * before `pagehide` — which is why it is the one the design leans on;
 * `pagehide` and unmount are best-effort behind it. The device mirror
 * (`draft-mirror.ts`) is what actually covers the case where none of the three
 * completes, and it is why losing that race costs nothing.
 */

/** The part of the machine the screen renders. Compared by value, not identity. */
export interface AutosaveView {
  status: AutosaveStatus;
  /** When the last save landed — the transient "Saved" flash reads this. */
  savedAt: number | null;
  /** The last failure, for the inline chip's copy. */
  failure: AutosaveFailure | null;
  /** `true` when a retry is already scheduled (so the chip says so, honestly). */
  retryScheduled: boolean;
  /** The server id, once the note exists. */
  noteId: number | null;
}

export interface NoteAutosave extends AutosaveView {
  /** Report the full working draft. Cheap: no render unless the view changes. */
  change: (draft: NoteDraft) => void;
  /** Save now if there is anything to save (respects in-flight and holds). */
  flush: () => void;
  /** The reader pressed the retry chip. Clears the backoff ladder. */
  retry: () => void;
}

function viewOf(state: AutosaveState): AutosaveView {
  return {
    status: state.status,
    savedAt: state.savedAt,
    failure: state.failure,
    retryScheduled: state.wakeAt !== null && state.status === 'error',
    noteId: state.noteId,
  };
}

function sameView(a: AutosaveView, b: AutosaveView): boolean {
  return (
    a.status === b.status &&
    a.savedAt === b.savedAt &&
    a.failure === b.failure &&
    a.retryScheduled === b.retryScheduled &&
    a.noteId === b.noteId
  );
}

export interface UseNoteAutosaveOptions {
  /**
   * Serialises this editing session's saves. The note id once one exists, the
   * client draft id before that — see `useSaveNote`.
   */
  scopeId: string;
  /**
   * The note this editor opened on, or `null` on `/notes/create`. Read ONCE at
   * mount: after that the editor is the source of truth and a changed prop must
   * not silently replace what the reader is writing.
   */
  initial: { id: number; draft: NoteDraft } | null;
  /**
   * The server's record after every successful save (slug, timestamps, id).
   * May be async — the editor's handler awaits an IndexedDB re-key on the first
   * save — and its promise is deliberately not awaited here: nothing about the
   * save machine's next step depends on it.
   */
  onSaved?: (record: NoteRecord) => void | Promise<void>;
  /**
   * Suspend scheduling without losing the working copy — used when the body is
   * past the backend's character limit, where a save could only be refused.
   * Edits keep flowing into the machine, so the moment it is lifted the very
   * next deadline carries the current text.
   */
  paused?: boolean;
}

export function useNoteAutosave({
  scopeId,
  initial,
  onSaved,
  paused = false,
}: UseNoteAutosaveOptions): NoteAutosave {
  const { mutate } = useSaveNote(scopeId);

  // The machine. A ref, not state — see the header. Seeded through a LAZY
  // `useState` initializer so `initialAutosaveState` runs exactly once (a
  // `useRef` argument is evaluated on every render and thrown away).
  const [initialState] = useState<AutosaveState>(() => initialAutosaveState(initial));
  const stateRef = useRef(initialState);

  const [view, setView] = useState<AutosaveView>(() => viewOf(initialState));
  const viewRef = useRef(view);

  const timerRef = useRef<{ id: ReturnType<typeof setTimeout>; at: number } | null>(
    null,
  );
  const pausedRef = useRef(paused);
  const mountedRef = useRef(true);
  const onSavedRef = useRef<UseNoteAutosaveOptions['onSaved']>(onSaved);
  const dispatchRef = useRef<(event: AutosaveEvent) => void>(() => {});
  const runSaveRef = useRef<(request: SaveRequest) => void>(() => {});

  // Keep the latest callback reachable from the stable closures below without
  // making them change identity (which would re-arm listeners on every render).
  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current.id);
      timerRef.current = null;
    }
  }, []);

  /** Bring the single timer in line with the machine's `wakeAt`. */
  const reconcileTimer = useCallback(() => {
    const wakeAt = pausedRef.current ? null : stateRef.current.wakeAt;
    if (wakeAt === null) {
      clearTimer();
      return;
    }
    if (timerRef.current?.at === wakeAt) return; // already armed for this deadline
    clearTimer();
    const id = setTimeout(
      () => {
        timerRef.current = null;
        dispatchRef.current({ type: 'wake', at: Date.now() });
      },
      Math.max(0, wakeAt - Date.now()),
    );
    timerRef.current = { id, at: wakeAt };
  }, [clearTimer]);

  const runSave = useCallback(
    (request: SaveRequest) => {
      mutate(request, {
        onSuccess: (envelope) => {
          // A save started by the unmount flush still reaches the server, but
          // its callbacks must not touch a screen that no longer exists.
          if (!mountedRef.current) return;
          const record = envelope.data;
          // `confirmed` is what we SENT, never what came back. If the server
          // normalised the body, adopting its echo would leave `working` and
          // `confirmed` permanently unequal — an autosave loop that never
          // settles. Only the id (which we may not have had) is taken from the
          // response.
          dispatchRef.current({
            type: 'saved',
            noteId: record.id,
            draft: request.draft,
            at: Date.now(),
          });
          void onSavedRef.current?.(record);
        },
        onError: (error) => {
          if (!mountedRef.current) return;
          dispatchRef.current({
            type: 'failed',
            failure: classifySaveFailure(error, request.mode, Date.now()),
            at: Date.now(),
          });
        },
      });
    },
    [mutate],
  );

  const dispatch = useCallback(
    (event: AutosaveEvent) => {
      const { state: next, save } = reduceAutosave(stateRef.current, event);
      stateRef.current = next;

      const nextView = viewOf(next);
      if (!sameView(viewRef.current, nextView)) {
        viewRef.current = nextView;
        setView(nextView);
      }

      reconcileTimer();
      if (save !== null) runSaveRef.current(save);
    },
    [reconcileTimer],
  );

  // The two indirections that break the dispatch ⇄ runSave cycle. Written in an
  // effect (never during render) so React's rules about refs hold.
  useEffect(() => {
    dispatchRef.current = dispatch;
    runSaveRef.current = runSave;
  }, [dispatch, runSave]);

  // A pause change can arm or disarm the timer without any machine event.
  useEffect(() => {
    pausedRef.current = paused;
    reconcileTimer();
  }, [paused, reconcileTimer]);

  const change = useCallback(
    (draft: NoteDraft) => dispatch({ type: 'edit', draft, at: Date.now() }),
    [dispatch],
  );

  const flush = useCallback(() => {
    if (pausedRef.current) return;
    dispatch({ type: 'flush', at: Date.now() });
  }, [dispatch]);

  const retry = useCallback(
    () => dispatch({ type: 'retry', at: Date.now() }),
    [dispatch],
  );

  // Page-lifecycle flushes. Listeners + cleanup only — no state is written here,
  // so the React Compiler lint is satisfied.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  // Unmount: the in-app navigation case. The request goes out but no state is
  // written — the component is already gone, and `mountedRef` keeps its
  // callbacks from firing into a dead screen.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      if (pausedRef.current) return;
      const { save } = reduceAutosave(stateRef.current, {
        type: 'flush',
        at: Date.now(),
      });
      if (save !== null) runSaveRef.current(save);
    };
  }, [clearTimer]);

  return { ...view, change, flush, retry };
}
