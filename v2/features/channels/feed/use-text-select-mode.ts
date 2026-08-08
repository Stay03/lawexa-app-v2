'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * use-text-select-mode — the OTHER half of the touch-and-hold trade (@arthur,
 * 2026-08-07: on a phone he could copy a whole message and never part of one).
 *
 * `.v2-touch-hold` buys the actions sheet by taking finger-selection away from
 * every message row, and `MessageActionsSheet` hands the whole message back as
 * "Copy text". This hands back the PART: "Select text" puts exactly one row into
 * a selectable state, highlights its words, and stands the hold gesture down so
 * the reader's own touch-and-hold reaches the platform instead of us.
 *
 * ── WHAT A SCRIPTED SELECTION CAN AND CANNOT DO (read from the engines) ────
 * It CANNOT raise the drag handles. That is settled in the browsers, not in our
 * code. Blink routes every Selection API call through
 * `DomSelection::UpdateFrameSelection`, which never sets `ShouldShowHandle`, and
 * `FrameSelection::SetSelectionDeprecated` then writes `is_handle_visible_ =
 * false`; the flag is raised only by the touch gesture handlers in
 * `selection_controller.cc`. On iOS the handles belong to UIKit's
 * `UITextSelectionDisplayInteraction`, which WebKit activates from
 * first-responder and gesture paths that script has no way into. No amount of
 * doing it "inside the gesture" changes either: there is no user-activation gate
 * to satisfy, only a gesture the engine must itself have recognised. Telegram
 * Web is the one open-source client shipping this exact feature and it does not
 * try — it flips the CSS and leaves the long press to the reader.
 *
 * ── SO: THE SELECTION IS THE MODE'S VISIBLE STATE; THE HANDLES ARE EARNED ──
 * Flipping `user-select` and stopping there would be a trap. The row would LOOK
 * unchanged, so the reader's next move is the move that got them here — a long
 * press — and before today that re-opened the actions sheet. Hold → Select text
 * → hold → sheet, forever.
 *
 * Both halves answer it. The scripted selection paints the whole message the
 * moment the sheet leaves, so "something happened, and it happened to THIS
 * message" needs no words; and `use-long-press` stands down for as long as that
 * selection lives, so the instinct to press and hold is finally rewarded with
 * what it asks for — the platform's own word selection, its handles, and (thanks
 * to the callout coming back in `shell.css`) its own Copy bar. The sheet's row
 * carries the one sentence that closes the gap between the two.
 *
 * The scripted selection is also safe to place: neither engine reveals or
 * scrolls to a selection it did not make itself (WebKit adds `RevealSelection`
 * only for `UserTriggered::Yes`), so the transcript does not jump.
 *
 * ── THE MODE IS A DOM STAMP, NOT REACT STATE ───────────────────────────────
 * `data-selecting` goes straight onto the row, exactly as the feed stamps
 * `data-flash` for a deep-link wash and `use-long-press` stamps `data-holding`
 * for an armed hold. Rows are `memo`'d on their message object and grouped under
 * a `memo`'d run, so a `useState` here would re-render the run — and every run
 * between it and the feed — twice per selection, to change one row's CSS. The
 * matching rule lives beside `.v2-touch-hold` in `shell.css`, because Tailwind
 * emits no `-webkit-touch-callout` utility and that property is load-bearing on
 * iOS (see the docblock there).
 *
 * THE ORDER — CSS FIRST, SELECTION SECOND — IS MEASURED, not assumed (Chromium
 * 141, 2026-08-08): with `user-select: none` still in force, `selectAllChildren`
 * produces a range — `rangeCount` 1, not collapsed — whose `toString()` comes
 * back EMPTY, and nothing paints. Blink's clipboard read skips unselectable
 * content by design, so a selection made in the wrong order is a highlight the
 * reader cannot see and a copy that yields nothing. One tick is enough between
 * the two: the Selection API updates style and layout inside its own call, so no
 * forced reflow is needed and none is written here.
 *
 * ── ENTERING HAPPENS INSIDE THE TAP, WHILE THE SHEET IS STILL OPEN ─────────
 * The sheet's "Select text" calls {@link TextSelectMode.enter} and only THEN
 * closes, which keeps the whole thing in one straight line instead of a timer
 * chasing a 200ms exit animation. Measured in the same session: a selection made
 * under Radix's modal environment (`pointer-events: none` on the body,
 * `aria-hidden` on everything outside the portal) survives the teardown intact.
 *
 * WHAT DOES DESTROY IT IS A FOCUS MOVE, so the sheet suppresses its own — see
 * `MessageActionsSheet`'s `onCloseAutoFocus`. Landing focus in the composer on
 * the way out would hand the selection to a textarea and, on iOS, raise the
 * keyboard over the message the reader was about to read.
 *
 * ── LEAVING IS THE PLATFORM'S OWN GESTURE, WATCHED NOT GUESSED ─────────────
 * There is no "done" chrome to dismiss, because the selection IS the mode's
 * visible state: when the highlight goes, the mode goes, and long-press opens
 * the actions sheet again. Two watchers say when that happened:
 *
 *  - `selectionchange`, the truthful one — the mode holds only while a
 *    non-collapsed selection still has an end inside the row. A tap anywhere
 *    collapses it, which is exactly how a reader ends a selection on a phone;
 *  - `pointerdown` on the document, in CAPTURE, the safety net — a touch that
 *    lands outside the row ends it even on an engine that under-fires the
 *    first. Dragging a selection HANDLE is invisible here (the handles are UA
 *    chrome and emit no page events), so this can never cut a drag short.
 *
 * NEITHER JUDGES A SELECTION WITH A FINGER STILL ON IT, which is what the third
 * listener — a bare `pointerup` — is for. The gesture this mode
 * exists to permit — touch and hold, to trade our whole-message highlight for
 * the platform's word and its handles — is the engine REPLACING one selection
 * with another, and an engine that passes through a collapsed caret on the way
 * (Blink's long-press falls back to `SetCaretAtHitTestResult` when the hit test
 * finds no word) would trip the first watcher in the middle of the very gesture
 * being served. So a press that lands inside the row suspends the verdict until
 * the finger comes up, and it is taken then. A pointer the engine swallows and
 * never releases just leaves the suspension standing — harmless, because the
 * `pointerdown` watcher is the robust exit and the next touch outside the row
 * still ends the mode, and because `use-long-press` reads the SELECTION rather
 * than this flag when it decides whether to stand down.
 *
 * SCROLL IS DELIBERATELY NOT AN EXIT. It is the obvious third candidate and it
 * is wrong: both platforms auto-scroll the container when a handle is dragged
 * toward the edge of the viewport, so a scroll exit would cancel the mode in the
 * middle of the one gesture it exists for. A scroll STARTED somewhere else is
 * already covered — its `pointerdown` landed outside the row.
 *
 * ── AND IT CANNOT STRAND THE ROW ───────────────────────────────────────────
 * If every watcher somehow missed, the stamp alone can never keep the sheet
 * shut: `use-long-press` stands down for a selecting row only while
 * {@link selectionHoldsRow} is still true of it, so a stamp with no selection
 * behind it is simply ignored, the sheet opens, and the feed's `onOpenActions`
 * clears the mode on the way through.
 */

/** Marks the row currently in select mode. Read by `shell.css`'s
 *  `.v2-touch-hold[data-selecting]` and by `use-long-press`, never by React. */
export const SELECTING_ATTRIBUTE = 'data-selecting';

/** Marks the element holding a message's own words, inside the row. The row is
 *  the wrong target: it also carries the pin marker, the reply quote, the
 *  "(edited)" note and the reaction chips, and a selection that opened with all
 *  of those in it would be one the reader has to undo before they can use it. */
export const MESSAGE_BODY_ATTRIBUTE = 'data-message-body';

/**
 * Is a live selection still held by this row? True only while the selection is
 * a real range — not a collapsed caret — with at least one end inside the row.
 *
 * EITHER END, not both. The row-scoped CSS already fences a drag in (everything
 * around it is still `user-select: none`), but an engine that let a handle creep
 * one node past the edge should not be answered by yanking the mode out from
 * under a selection the reader is still holding.
 */
export function selectionHoldsRow(row: HTMLElement): boolean {
  const selection = window.getSelection();
  if (selection === null || selection.isCollapsed) return false;
  const { anchorNode, focusNode } = selection;
  return (
    (anchorNode !== null && row.contains(anchorNode)) ||
    (focusNode !== null && row.contains(focusNode))
  );
}

export interface TextSelectMode {
  /** Put one message into select mode and select its words. A message with no
   *  words, or one not currently rendered, is a no-op — the sheet already
   *  withholds the verb from the first, and the second cannot happen from it. */
  enter: (messageUuid: string) => void;
  /** Hand the row back to the hold gesture. Idempotent; safe when nothing is
   *  selecting. */
  exit: () => void;
}

/**
 * @param rootRef The feed's own root — the same element `flashMessage` searches,
 *   so "one message at a time" is scoped to one feed rather than the document.
 */
export function useTextSelectMode(
  rootRef: React.RefObject<HTMLElement | null>,
): TextSelectMode {
  /** The row in select mode, or `null`. */
  const rowRef = useRef<HTMLElement | null>(null);
  /** Is a finger (or a mouse button) currently down on the selecting row? While
   *  it is, the selection under it is mid-gesture and not to be judged. */
  const heldRef = useRef(false);
  /** The exit watchers, held so they can be detached by identity. Attached only
   *  while a row is selecting — nothing listens the rest of the time. */
  const watchersRef = useRef<{
    selection: () => void;
    press: (event: PointerEvent) => void;
    release: () => void;
  } | null>(null);

  const exit = useCallback(() => {
    const row = rowRef.current;
    const watchers = watchersRef.current;
    rowRef.current = null;
    watchersRef.current = null;
    heldRef.current = false;
    // The stamp is removed and the SELECTION IS LEFT ALONE. Every exit path is
    // driven by the selection having already gone or moved, so there is nothing
    // of the reader's left to clear — and on the one path where a live selection
    // has crept out of the row, clearing it would destroy the very thing they
    // were reaching for.
    row?.removeAttribute(SELECTING_ATTRIBUTE);
    if (watchers === null) return;
    document.removeEventListener('selectionchange', watchers.selection);
    document.removeEventListener('pointerdown', watchers.press, true);
    document.removeEventListener('pointerup', watchers.release, true);
  }, []);

  const enter = useCallback(
    (messageUuid: string) => {
      const row =
        rootRef.current?.querySelector<HTMLElement>(
          `[data-message-uuid="${CSS.escape(messageUuid)}"]`,
        ) ?? null;
      const body =
        row?.querySelector<HTMLElement>(`[${MESSAGE_BODY_ATTRIBUTE}]`) ?? null;
      const selection = window.getSelection();
      if (row === null || body === null || selection === null) return;

      // ONE ROW AT A TIME, structurally: whatever was selecting is handed back
      // before this one is taken, so the stamp can never be on two rows.
      exit();

      rowRef.current = row;
      row.setAttribute(SELECTING_ATTRIBUTE, '');
      selection.selectAllChildren(body);

      // Attached AFTER the selection, and they read the same predicate the mode
      // holds on — so the `selectionchange` this very call queues finds the
      // selection inside the row and correctly decides to stay.
      const verdict = () => {
        const current = rowRef.current;
        if (current !== null && !selectionHoldsRow(current)) exit();
      };
      const watchers = {
        selection: () => {
          if (heldRef.current) return;
          verdict();
        },
        press: (event: PointerEvent) => {
          const current = rowRef.current;
          if (current === null) return;
          const target = event.target;
          // Inside the row: a gesture on the words themselves. Hold the verdict
          // until it finishes — see the docblock.
          if (target instanceof Node && current.contains(target)) {
            heldRef.current = true;
            return;
          }
          exit();
        },
        // `pointerup` ONLY, never `pointercancel`. A cancel here is not the end
        // of anything: it is the browser announcing that it has TAKEN the
        // gesture — which is precisely what a long press that becomes a native
        // selection looks like — so treating it as a release would restore the
        // verdict in the middle of the gesture it was suspended for. A pointer
        // that is cancelled and never released simply leaves the suspension
        // standing, and the next press re-decides it.
        release: () => {
          if (!heldRef.current) return;
          heldRef.current = false;
          verdict();
        },
      };
      watchersRef.current = watchers;
      document.addEventListener('selectionchange', watchers.selection);
      document.addEventListener('pointerdown', watchers.press, true);
      document.addEventListener('pointerup', watchers.release, true);
    },
    [exit, rootRef],
  );

  // Leaving the channel leaves the mode — the row is going with it, but the
  // document listeners are not.
  useEffect(() => exit, [exit]);

  return useMemo(() => ({ enter, exit }), [enter, exit]);
}
