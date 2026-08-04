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
import { getErrorMessage } from '@/v2/runtime/query';
import {
  isAlreadyInFolder,
  useAddItemToFolder,
  useRemoveFolderItem,
  type FolderItemTarget,
} from '../item-mutations';
import type { FolderRecord } from '../types';
import { useCreateFolderAndAdd } from './create-and-add';
import { PickerBody } from './PickerBody';
import { folderItemNoun, type PickerCrumb } from './picker-model';
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
 * ── THE VERB IS "ADD", NEVER "MOVE" ────────────────────────────────────────
 * One case can sit in a matter folder, a topic folder and a reading list at
 * once. Nothing here removes it from anywhere.
 */

/** How long the field waits before the level query re-runs on what was typed. */
const SEARCH_DEBOUNCE_MS = 250;

/** One stable reference for "we have been told nothing yet". */
const EMPTY_HELD: ReadonlySet<string> = new Set<string>();

export function FolderPicker({
  target,
  open,
  onOpenChange,
}: {
  /** WHAT is being filed — the content type and that content's own id. */
  target: FolderItemTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wide = usePickerBreakpoint();

  const [trail, setTrail] = useState<readonly PickerCrumb[]>([]);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [knownHeld, setKnownHeld] = useState<ReadonlySet<string>>(EMPTY_HELD);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Cancel a pending debounce on unmount. No state is set here, so this stays
  // clear of `react-hooks/set-state-in-effect`.
  useEffect(
    () => () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    },
    [],
  );

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
  const create = useCreateFolderAndAdd(target);

  const stopDebounce = () => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  };

  const changeOpen = (next: boolean) => {
    if (!next) {
      // Reopening starts clean — at the root, with an empty field and NO
      // remembered "already in that folder" marks. Those marks are true only
      // for as long as nobody has unfiled the item since; the folder page (or
      // another tab) can do exactly that between two openings, and a picker
      // that kept the claim would refuse to say a folder is available when it
      // is. The 422 is cheap and always current — ask again.
      stopDebounce();
      setTrail([]);
      setInput('');
      setQuery('');
      setInlineError(null);
      setNotice(null);
      setKnownHeld(EMPTY_HELD);
    }
    onOpenChange(next);
  };

  const changeInput = (value: string) => {
    setInput(value);
    setNotice(null);
    setInlineError(null);
    stopDebounce();
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      setQuery(value);
    }, SEARCH_DEBOUNCE_MS);
  };

  const clearInput = () => {
    stopDebounce();
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
  const commitSearch = () => {
    stopDebounce();
    setQuery(input);
  };

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

  const confirmAdded = (folder: FolderRecord) => {
    toast.success(`Added to “${folder.name}”`, {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () =>
          undoAdd.mutate({
            type: target.type,
            contentId: target.contentId,
            folderUuid: folder.uuid,
            label: null,
          }),
      },
    });
  };

  /** One destination at a time: a second press while a write is on the wire is
   *  a double-tap, not a second intention. */
  const writing = add.isPending || create.isPending;

  const choose = (folder: FolderRecord) => {
    if (writing) return;
    setInlineError(null);
    setNotice(null);
    add.mutate(
      { folderUuid: folder.uuid },
      {
        onSuccess: () => {
          changeOpen(false);
          confirmAdded(folder);
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
            confirmAdded(result.folder);
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
      pendingFolderUuid={add.isPending ? (add.variables?.folderUuid ?? null) : null}
      creating={create.isPending}
      inlineError={inlineError}
      notice={notice}
    />
  );

  const description = `Pick a folder for this ${noun}. It can sit in more than one.`;

  // Unknown viewport (server render, or no `matchMedia`): draw neither surface
  // rather than guess which one. The picker only ever opens from a press, long
  // after hydration, so nothing is ever missing when it matters.
  if (wide === null) return null;

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="gap-4 sm:max-w-lg" onEscapeKeyDown={escape}>
          <DialogHeader className="pr-8">
            <DialogTitle>Add to folder</DialogTitle>
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
        className="max-h-[88dvh] gap-0 rounded-t-2xl border-border/60 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        // Rides the keyboard when the browser overlays it instead of resizing
        // the layout viewport (iOS Safari) — the shell publishes the inset.
        style={{ bottom: 'var(--keyboard-inset, 0px)' }}
      >
        <SheetHeader className="gap-1 p-0 pb-3 pr-10">
          <SheetTitle>Add to folder</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {renderBody('sheet')}
      </SheetContent>
    </Sheet>
  );
}
