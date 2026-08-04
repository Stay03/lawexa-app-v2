'use client';

import { useCallback, useRef, useState } from 'react';

import { isOverContentLimit, type NoteDraft } from './autosave-machine';

/**
 * use-autosave-pause — the ONE condition under which the editor stops trying to
 * save: a body past the backend's 5MB character cap.
 *
 * ── WHY IT IS ITS OWN HOOK ──────────────────────────────────────────────────
 * The measurement runs on every keystroke, but the ANSWER changes at most twice
 * in a session (over, then back under). Keeping the last answer in a ref and
 * calling `setState` only on the transition is what stops a 5,000,000-character
 * note from re-rendering the whole editor once per character — and it is the
 * only reason this is a hook rather than a line in the screen.
 *
 * ── WHY PAUSE RATHER THAN LET IT FAIL ───────────────────────────────────────
 * A save that cannot succeed is not worth sending: it costs a round trip, it
 * burns one of the 60 saves a minute, and it turns a knowable limit into a
 * generic error. Pausing states the real rule up front, keeps the reader
 * editing (the device mirror still records everything), and resumes on the very
 * next change once the body fits — because the machine kept receiving edits the
 * whole time and its next deadline carries the current text.
 *
 * NEVER A CHARACTER COUNTER. v1 showed "12,043/65,535" in a corner from a limit
 * that no longer exists. A limit nobody is near is noise; this speaks only when
 * it is actually reached.
 */
export interface AutosavePause {
  /** `true` while the body is past the cap — passed to `useNoteAutosave`. */
  overLimit: boolean;
  /** Feed every draft through; cheap, and re-renders only on the threshold. */
  measure: (draft: NoteDraft) => void;
}

export function useAutosavePause(): AutosavePause {
  const [overLimit, setOverLimit] = useState(false);
  const lastRef = useRef(false);

  const measure = useCallback((draft: NoteDraft) => {
    const next = isOverContentLimit(draft);
    if (next === lastRef.current) return;
    lastRef.current = next;
    setOverLimit(next);
  }, []);

  return { overLimit, measure };
}
