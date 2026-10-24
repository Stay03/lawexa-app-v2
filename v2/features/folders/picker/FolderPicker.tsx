'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ContentSpaceStub } from '@/types/collab';
import { getErrorMessage } from '@/v2/runtime/query';
import {
  isAlreadyInFolder,
  MoveHalfDoneError,
  useAddItemToFolder,
  useMoveFolderItem,
  useRemoveFolderItem,
  type FolderItemTarget,
} from '../item-mutations';
import { filedContentId } from '../filed-content';
import { useCreateFolderAndAdd } from './create-and-add';
import { PickerBody } from './PickerBody';
import { createDebounce, SEARCH_DEBOUNCE_MS } from './picker-search';
import {
  folderItemNoun,
  pickerDescription,
  type PickerCrumb,
  type PickerFolder,
} from './picker-model';
import { usePickerBreakpoint } from './use-picker-breakpoint';

/**
 * FolderPicker — "Add to folder", the gesture the whole folders wave exists for.
 *
 * ── ONE COMPONENT, TWO SKINS, EXACTLY ONE MOUNTED ──────────────────────────
 * A centred Radix Dialog at ≥40rem, a bottom sheet (the same Radix Dialog, from
 * `components/ui/sheet`) below it. The choice is a JS media-query value, not a
 * CSS breakpoint, because these are two dialogs: CSS-hiding one would leave two
 * focus traps, two listboxes and two live regions on one page. `PickerBody` is
 * the single screen inside both; the skins own nothing but their frame.
 *
 * ── WHAT THE OPENING LIST IS ───────────────────────────────────────────────
 * The viewer's ROOT folders, most recently RENAMED OR CREATED first. Not
 * "recently used": filing an item into a folder does not touch its
 * `updated_at` (probed), so the server's ordering cannot mean what a
 * "recent destinations" list would promise, and nothing here says it does.
 *
 * ── STATE LIVES HERE, ABOVE THE SKINS ──────────────────────────────────────
 * The trail, the field and everything the server has told us live on this
 * component, which stays mounted for the life of the action row. So dragging a
 * window across 40rem mid-pick swaps the frame without losing where you were —
 * and the mutations survive the picker CLOSING, which is what lets the
 * confirmation toast still offer a working Undo after the dialog is gone.
 *
 * ── WHAT THE PICKER MAY AND MAY NOT CLAIM ──────────────────────────────────
 * There is no reverse lookup on the wire — nothing can be asked "which folders
 * hold this case?" (the ask is filed). So the picker starts by claiming
 * NOTHING: no row says "already here" until the server has said so, which it
 * does by answering a duplicate add with a 422. That answer is knowledge, so it
 * is kept (the row flips, politely announced) — and it is the honest signal the
 * plan asked for, not an error.
 *
 * ── THE VERB IS "ADD", NEVER "MOVE", UNLESS `from` NAMES WHAT IT LEAVES ────
 * One case can sit in a matter folder, a topic folder and a reading list at
 * once. Nothing here removes it from anywhere, except in a move between
 * folders (Stay, 22 October 2026: "Moving a file between folders should
 * work too"): with `from`, the chosen folder gets the item first and `from`
 * then lets go of it (`useMoveFolderItem`), the toast says "Moved to", and
 * its Undo is the same move back. The folder being left is marked as holding
 * the item from the start, and pressing it moves nothing: taking the item
 * out of its only folder would file it nowhere.
 *
 * ── A SPACE'S FILE IS FILED AMONG THE SPACE'S FOLDERS ──────────────────────
 * With `space` the picker browses that space's folders (`PickerBody`), and
 * its create row makes a space folder (`create-and-add.ts`). Stay, 22 October
 * 2026: the files at a space's top level get "Move to folder", like the
 * Folders page's loose files.
 */

/** One stable reference for "we have been told nothing yet". */
const EMPTY_HELD: ReadonlySet<string> = new Set<string>();

/** What the picker knows before asking: in a move, the folder being left holds the item. */
function heldAtStart(from: { uuid: string } | undefined): ReadonlySet<string> {
  return from ? new Set([from.uuid]) : EMPTY_HELD;
}

/**
 * Why a move did not finish, with the folders named. Half done: the new
 * folder holds it and the old one still does, which the row behind the
 * picker shows.
 */
function moveRefusal(error: unknown, to: { name: string }, from: { name: string }): string {
  if (error instanceof MoveHalfDoneError) {
    return `It’s in “${to.name}” now, but couldn’t be taken out of “${from.name}”. ${getErrorMessage(error.reason)}`;
  }
  return getErrorMessage(error);
}

export function FolderPicker({
  target,
  title = 'Add to folder',
  space,
  from,
  open,
  onOpenChange,
}: {
  /** WHAT is being filed — the content type and that content's own id. */
  target: FolderItemTarget;
  /** The heading. A loose file on the Folders page is "Move to folder" (build
   *  6): filing it takes it off that list. */
  title?: string;
  /** Browse and create in this space's folders, not the viewer's own. */
  space?: ContentSpaceStub;
  /** The folder the item LEAVES: a move between folders, not an add. The
   *  chosen folder gets it first, then this one lets go of it. */
  from?: { uuid: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wide = usePickerBreakpoint();

  const [trail, setTrail] = useState<readonly PickerCrumb[]>([]);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [knownHeld, setKnownHeld] = useState<ReadonlySet<string>>(() => heldAtStart(from));
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The wait between the last key and the search (`picker-search.ts`). Made
  // once: `setQuery` never changes, so neither does the debounce.
  const [debounce] = useState(() => createDebounce(setQuery, SEARCH_DEBOUNCE_MS));
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Cancel a pending debounce on unmount. No state is set here, so this stays
  // clear of `react-hooks/set-state-in-effect`.
  useEffect(() => () => debounce.cancel(), [debounce]);

  const noun = folderItemNoun(target.type);

  // The add the picker performs. SILENT: the picker is on screen when it runs,
  // so every outcome — including the duplicate, which is not a failure — is
  // rendered here rather than thrown at the corner of the page.
  const add = useAddItemToFolder(target, { silentError: true });
  // The undo behind the confirmation toast — the SAME removal the folder page
  // performs, so undoing an add answers "Removed from this folder → Undo",
  // which is a redo. Two true sentences about two things that really happened,
  // rather than an option flag whose only job was to silence one of them.
  const undoAdd = useRemoveFolderItem(target);
  const create = useCreateFolderAndAdd(target, { space, from });
  // The move between folders (`from`): silent, the picker words it. Its undo
  // is the same move back, and NOT silent: an undo that quietly failed would
  // leave the reader believing the file is back (the removal's rule).
  const move = useMoveFolderItem(target, { silentError: true });
  const undoMove = useMoveFolderItem(target);

  const changeOpen = (next: boolean) => {
    if (!next) {
      // Reopening starts clean — at the root, with an empty field and NO
      // remembered "already in that folder" marks. Those marks are true only
      // for as long as nobody has unfiled the item since; the folder page (or
      // another tab) can do exactly that between two openings, and a picker
      // that kept the claim would refuse to say a folder is available when it
      // is. The 422 is cheap and always current — ask again.
      debounce.cancel();
      setTrail([]);
      setInput('');
      setQuery('');
      setInlineError(null);
      setNotice(null);
      setKnownHeld(heldAtStart(from));
    }
    onOpenChange(next);
  };

  const changeInput = (value: string) => {
    setInput(value);
    setNotice(null);
    setInlineError(null);
    debounce.push(value);
  };

  const clearInput = () => {
    debounce.cancel();
    setInput('');
    setQuery('');
    setNotice(null);
  };

  /**
   * Run the debounce NOW. Enter presses this when the rendered list is still
   * answering the previous search — so the first Enter catches the list up with
   * the field, and only the next one, on a list that provably answers what is
   * typed, files anything.
   */
  const commitSearch = () => debounce.flush(input);

  const navigate = (next: readonly PickerCrumb[]) => {
    // Moving levels always empties the field. A search that found a folder is
    // the wrong filter for its contents, and carrying it in would show a folder
    // the reader just opened as almost empty.
    clearInput();
    setTrail(next);
    setInlineError(null);
  };

  /** The one move that keeps the field: widen a level search to the whole tree. */
  const searchEverywhere = () => {
    setTrail([]);
    setInlineError(null);
    setNotice(null);
  };

  // Undo removes what the add FILED, named by its 201: in a space folder a
  // note is filed as the space's copy, whose id is not the pressed note's
  // (`filed-content.ts`). Elsewhere the two ids are the same.
  const confirmAdded = (folder: PickerFolder, filedId: number) => {
    toast.success(`Added to “${folder.name}”`, {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () =>
          undoAdd.mutate({
            type: target.type,
            contentId: filedId,
            folderUuid: folder.uuid,
            label: null,
          }),
      },
    });
  };

  /** The move's word, with its way back: the same move from the new folder to the old. */
  const confirmMoved = (folder: PickerFolder, left: { uuid: string; name: string }) => {
    toast.success(`Moved to “${folder.name}”`, {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => undoMove.mutate({ ...target, folderUuid: folder.uuid, toFolderUuid: left.uuid }),
      },
    });
  };

  /** One destination at a time: a second press while a write is on the wire is
   *  a double-tap, not a second intention. */
  const writing = add.isPending || create.isPending || move.isPending;

  const choose = (folder: PickerFolder) => {
    if (writing) return;
    setInlineError(null);
    setNotice(null);
    if (from) {
      // The folder it is leaving is nowhere to move to, and letting it go
      // from its only folder would file it nowhere.
      if (folder.uuid === from.uuid) {
        setNotice(`Already in ${folder.name}`);
        return;
      }
      move.mutate(
        { ...target, folderUuid: from.uuid, toFolderUuid: folder.uuid },
        {
          onSuccess: () => {
            changeOpen(false);
            confirmMoved(folder, from);
          },
          onError: (error) => setInlineError(moveRefusal(error, folder, from)),
        },
      );
      return;
    }
    add.mutate(
      { folderUuid: folder.uuid },
      {
        onSuccess: (response) => {
          changeOpen(false);
          confirmAdded(folder, filedContentId(response, target.contentId));
        },
        onError: (error) => {
          if (isAlreadyInFolder(error)) {
            // Not a failure — the answer to the question the press asked.
            setKnownHeld((held) => new Set(held).add(folder.uuid));
            setNotice(`Already in ${folder.name}`);
            return;
          }
          setInlineError(getErrorMessage(error));
        },
      },
    );
  };

  const createHere = (name: string) => {
    if (writing) return;
    setInlineError(null);
    setNotice(null);
    const here = trail[trail.length - 1];
    create.mutate(
      { name, parentUuid: here?.uuid ?? null },
      {
        onSuccess: (result) => {
          if (result.status === 'added') {
            changeOpen(false);
            if (from) confirmMoved(result.folder, from);
            else confirmAdded(result.folder, result.contentId);
            return;
          }
          if (result.status === 'added-not-moved') {
            // The new folder holds it and the old one still does: said as
            // that, from the corner, since the picker's own job is done.
            changeOpen(false);
            toast.error(
              `Added to “${result.folder.name}”, but it couldn’t be taken out of “${result.from.name}”. ${result.message}`,
            );
            return;
          }
          // Half a success, said as half a success — and the field is emptied
          // so the create row reverts to "New folder". Leaving the name in it
          // would make the obvious retry MINT A SECOND FOLDER of the same name
          // (the server accepts duplicates); the folder that already exists is
          // in the list behind this message, and pressing it finishes the job.
          clearInput();
          setInlineError(
            `“${result.folder.name}” was created, but the ${noun} could not be added to it — press it in the list to finish. (${result.message})`,
          );
        },
        onError: (error) => setInlineError(getErrorMessage(error)),
      },
    );
  };

  const escape = (event: KeyboardEvent) => {
    // Escape clears the field before it closes the picker — the standard
    // combobox contract, and it means a mistyped search never costs the trail.
    if (input) {
      event.preventDefault();
      clearInput();
    }
  };

  const renderBody = (surface: 'dialog' | 'sheet') => (
    <PickerBody
      surface={surface}
      space={space}
      trail={trail}
      onNavigate={navigate}
      onSearchEverywhere={searchEverywhere}
      input={input}
      query={query}
      onInputChange={changeInput}
      onClearInput={clearInput}
      onCommitSearch={commitSearch}
      knownHeld={knownHeld}
      onChoose={choose}
      onCreate={createHere}
      pendingFolderUuid={
        add.isPending
          ? (add.variables?.folderUuid ?? null)
          : move.isPending
            ? (move.variables?.toFolderUuid ?? null)
            : null
      }
      creating={create.isPending}
      inlineError={inlineError}
      notice={notice}
    />
  );

  const description = pickerDescription(noun, { space, from });

  // Unknown viewport (server render, or no `matchMedia`): draw neither surface
  // rather than guess which one. The picker only ever opens from a press, long
  // after hydration, so nothing is ever missing when it matters.
  if (wide === null) return null;

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="gap-4 sm:max-w-lg" onEscapeKeyDown={escape}>
          <DialogHeader className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {renderBody('dialog')}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent
        ref={sheetRef}
        side="bottom"
        onEscapeKeyDown={escape}
        // THE `tabIndex` IS LOAD-BEARING, not decoration. Radix's dialog
        // content is a plain div with no tabindex of its own, so `focus()` on
        // it is a silent no-op: focus would stay on the pill BEHIND the scrim,
        // Radix's focus guards would never engage, Tab would walk the page
        // underneath and a screen reader would never be moved into the picker.
        // With `-1` the container is focusable and the trap is real.
        tabIndex={-1}
        // NO AUTOFOCUS ON THE PHONE (standards §4). Radix would otherwise focus
        // the field, the keyboard would rise over the list, and the reader
        // would have to dismiss it to see a single destination. Tapping the
        // field is what asks for the keyboard.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          sheetRef.current?.focus();
        }}
        // PLACED FROM THE VISIBLE RECTANGLE the keyboard hook publishes
        // (`--visual-top`, `--visual-height`, use-keyboard-inset.ts), as the
        // chat's draft sheet is (ChatSidePanel.tsx). Its top is put at the
        // visible bottom and pulled up by its own height, so it stays sized to
        // its rows and sits whole above the keyboard, and the cap keeps a
        // 2.5rem strip above it. It used to stand on `--keyboard-inset` from
        // the page's bottom, which iOS leaves behind the keyboard while it
        // pans, so the sheet jumped between mid-screen and the top as the
        // keyboard came and went (Arthur's iPhone recording, 24 October 2026).
        className="top-[calc(var(--visual-top,0px)+var(--visual-height,100dvh))] max-h-[calc(var(--visual-height,100dvh)-2.5rem)] -translate-y-full gap-0 rounded-t-2xl border-border/60 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        // The sheet's own `bottom-0` would stretch it to the page's bottom.
        style={{ bottom: 'auto' }}
        // ONE DIM LAYER. Opened from the chat's draft sheet, which has its own
        // backdrop and marks the page with `data-v2-side-panel`, a second dim
        // layer turned the draft behind the picker nearly black (Arthur's
        // iPhone recording, 24 October 2026). There the picker's overlay stays
        // clear: it still takes the tap outside that closes the picker.
        overlayClassName="[[data-v2-side-panel]_&]:bg-transparent [[data-v2-side-panel]_&]:backdrop-blur-none"
      >
        <SheetHeader className="gap-1 p-0 pb-3 pr-10">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {renderBody('sheet')}
      </SheetContent>
    </Sheet>
  );
}
