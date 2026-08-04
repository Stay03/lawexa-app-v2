'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { NoteRecord } from '../types';
import { isBlankDraft, type NoteDraft } from './autosave-machine';
import {
  deleteDraftMirror,
  writeDraftMirror,
  type DraftMirrorLookup,
  type NoteDraftMirror,
} from './draft-mirror';

/**
 * use-draft-mirror — the WRITE half of the device mirror, plus the pure rule
 * that decides whether a restore is worth offering.
 *
 * The write is debounced on its own short timer rather than riding the
 * autosave deadline, and that is the point: the mirror exists precisely to hold
 * what autosave has NOT sent yet, so it has to be ahead of it. Half a second is
 * short enough to survive a crash mid-sentence and long enough that a fast
 * typist is not writing to IndexedDB on every keystroke.
 *
 * Every write is fire-and-forget. The store degrades to a no-op when IndexedDB
 * is unavailable (`draft-mirror.ts`), so nothing here needs a failure path — the
 * server copy is the real one and the editor never waits on this.
 */

/** Quiet period before the working copy is written to the device. */
const MIRROR_DEBOUNCE_MS = 500;

/**
 * How far the device's clock may run BEHIND the server's before the newer-than
 * test stops trusting itself.
 *
 * The mirror's timestamp comes from the browser; the note's comes from the API.
 * They are different clocks, and a laptop a few minutes slow is ordinary. A
 * strict comparison reads genuinely unsaved work as older than the server copy
 * and never offers it — which loses it silently.
 *
 * THE ASYMMETRY IS DELIBERATE. The offer is a CHOICE, not an overwrite:
 * nothing is applied until the author presses Restore. So erring toward showing
 * it costs one dismissal, and erring away from it costs the author's work. The
 * content-equality test above already removes the common false positive (a
 * mirror that merely post-dates its own save), so this tolerance only ever
 * widens a window where the two copies genuinely differ.
 */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export interface DraftMirrorTarget {
  /** `note:{id}` once the note exists, `draft:{uuid}` before that. */
  key: string;
  noteId: number | null;
  /** Signed-out sessions never write: there is no owner to stamp. */
  viewerId: number | null;
}

export interface DraftMirrorWriter {
  /** Record the working copy (debounced). Safe to call on every keystroke. */
  write: (draft: NoteDraft) => void;
  /** Drop a row — the reader discarded it, or its note was deleted. */
  forget: (key: string) => void;
}

export function useDraftMirrorWriter(target: DraftMirrorTarget): DraftMirrorWriter {
  // The target MOVES mid-session: the moment a create succeeds, the same editor
  // starts writing under `note:{id}`. A ref keeps `write` referentially stable
  // across that change, so the editor's update subscription never re-binds.
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<NoteDraft | null>(null);

  const flush = useCallback(() => {
    const draft = draftRef.current;
    const { key, noteId, viewerId } = targetRef.current;
    if (draft === null || viewerId === null) return;
    void writeDraftMirror({
      key,
      note_id: noteId,
      title: draft.title,
      content: draft.content,
      updated_at: new Date().toISOString(),
      owner_user_id: viewerId,
    });
  }, []);

  const write = useCallback(
    (draft: NoteDraft) => {
      draftRef.current = draft;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flush();
      }, MIRROR_DEBOUNCE_MS);
    },
    [flush],
  );

  const forget = useCallback((key: string) => {
    // Cancel the pending write ONLY when it would land on the row being
    // dropped. Discarding a restore offer names a DIFFERENT key (the abandoned
    // draft's), and tearing down this session's timer there would silently stop
    // mirroring the note the author is still typing.
    if (key === targetRef.current.key) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      draftRef.current = null;
    }
    void deleteDraftMirror(key);
  }, []);

  // Leaving the editor is the moment the mirror matters most, so the pending
  // write is COMMITTED rather than cancelled. Listeners only — no state is
  // written here.
  //
  // BEST-EFFORT, HONESTLY. `flush()` starts an ASYNCHRONOUS IndexedDB write and
  // returns immediately; nothing can make it complete before a page that is
  // being torn down goes away. `visibilitychange` → hidden is the signal that
  // reliably arrives while the page is still alive and able to finish it (Page
  // Lifecycle API), and it fires before `pagehide` on every real backgrounding
  // and tab close — so in practice the hidden write is the one that lands, and
  // `pagehide`/unmount are the belt and braces behind it.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  return { write, forget };
}

/**
 * Is there a device copy worth OFFERING to restore?
 *
 * Three conditions, all necessary:
 *
 *  1. There is a row, and it holds something (a blank draft is not a loss).
 *  2. It DIFFERS from what the server returned. A mirror that merely
 *     post-dates the save — which is the normal case, because the mirror writes
 *     500ms after a change and the save lands later — describes the same text
 *     and must never raise a prompt.
 *  3. It is NEWER than the server's copy, within a clock-skew allowance. If the
 *     server's is clearly newer, the note was edited somewhere else since, and
 *     offering a stale local copy as "unsaved changes" would invite someone to
 *     overwrite the newer work. The allowance exists because the two timestamps
 *     come from two different clocks — see {@link CLOCK_SKEW_TOLERANCE_MS}.
 *
 * On the create route there is no server copy at all, so an abandoned
 * never-created draft qualifies on (1) alone — that draft has no other home.
 */
export function pickRestoreCandidate(
  lookup: DraftMirrorLookup | undefined,
  record: NoteRecord | null,
): NoteDraftMirror | null {
  if (!lookup) return null;

  if (record === null) {
    const orphan = lookup.orphan;
    if (!orphan) return null;
    return isBlankDraft({ title: orphan.title, content: orphan.content })
      ? null
      : orphan;
  }

  const mirror = lookup.mirror;
  if (!mirror) return null;
  if (isBlankDraft({ title: mirror.title, content: mirror.content })) return null;
  if (mirror.title === record.title && mirror.content === (record.content ?? '')) {
    return null;
  }

  const mirrorAt = Date.parse(mirror.updated_at);
  // Editor records are detail payloads, which do carry `updated_at`; the type
  // keeps it optional for the list shape, so fall back to the created stamp
  // rather than asserting.
  const recordAt = Date.parse(record.updated_at ?? record.created_at);
  if (Number.isNaN(mirrorAt) || Number.isNaN(recordAt)) return null;
  // Two different clocks — see CLOCK_SKEW_TOLERANCE_MS for why the comparison
  // leans toward offering rather than toward silence.
  return mirrorAt > recordAt - CLOCK_SKEW_TOLERANCE_MS ? mirror : null;
}
