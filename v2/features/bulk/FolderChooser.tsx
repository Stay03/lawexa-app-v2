'use client';

import { useEffect, useRef, useState } from 'react';
import { CornerLeftUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getErrorMessage } from '@/v2/runtime/query';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useCreateFolder } from '@/v2/features/folders/folder-mutations';
import { PickerBody } from '@/v2/features/folders/picker/PickerBody';
import type { PickerCrumb } from '@/v2/features/folders/picker/picker-model';
import { usePickerBreakpoint } from '@/v2/features/folders/picker/use-picker-breakpoint';
import type { FolderRecord } from '@/v2/features/folders/types';

const SEARCH_DEBOUNCE_MS = 250;
const NOTHING_HELD: ReadonlySet<string> = new Set<string>();

/**
 * Pick a folder for the ticked items (bulk select): the folder picker's own
 * body (browse, search, a new folder), but it ACTS on nothing itself, it hands
 * the folder back. The screen then sends one bulk request for every ticked
 * item. With `topLevel`, a "Top level" choice comes first, for moving folders
 * out of their parent.
 *
 * `excluded`: folders that cannot be a destination (the ticked folders
 * themselves, when moving them), refused in place.
 */
export function FolderChooser({
  open,
  onOpenChange,
  title,
  description,
  topLevel = false,
  excluded,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  topLevel?: boolean;
  excluded?: ReadonlySet<string>;
  /** The chosen folder, or `null` for the top level. */
  onChoose: (folder: { uuid: string; name: string } | null) => void;
}) {
  const wide = usePickerBreakpoint();
  const [trail, setTrail] = useState<readonly PickerCrumb[]>([]);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const create = useCreateFolder();

  useEffect(
    () => () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    },
    [],
  );

  const stopDebounce = () => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  };
  const changeOpen = (next: boolean) => {
    if (!next) {
      stopDebounce();
      setTrail([]);
      setInput('');
      setQuery('');
      setInlineError(null);
    }
    onOpenChange(next);
  };
  const changeInput = (value: string) => {
    setInput(value);
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
  };
  const choose = (folder: { uuid: string; name: string } | null) => {
    if (folder && excluded?.has(folder.uuid)) {
      setInlineError(`“${folder.name}” is one of the folders being moved.`);
      return;
    }
    changeOpen(false);
    onChoose(folder);
  };
  const createHere = (name: string) => {
    if (create.isPending) return;
    setInlineError(null);
    const here = trail[trail.length - 1];
    create.mutate(
      { name, is_private: true, ...(here?.uuid ? { parent_id: here.uuid } : {}) },
      {
        onSuccess: (response) => choose({ uuid: response.data.uuid, name: response.data.name }),
        onError: (error) => setInlineError(getErrorMessage(error)),
      },
    );
  };
  const escape = (event: KeyboardEvent) => {
    if (input) {
      event.preventDefault();
      clearInput();
    }
  };

  const body = (surface: 'dialog' | 'sheet') => (
    <div className="flex min-h-0 flex-col gap-2">
      {topLevel && trail.length === 0 && !query ? (
        <button
          type="button"
          onClick={() => choose(null)}
          className={cn(
            'v2-interactive flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-left text-sm font-medium transition-colors hover:bg-secondary',
            FOCUS_RING,
          )}
        >
          <CornerLeftUp aria-hidden className="size-4 text-muted-foreground" />
          Top level (not in a folder)
        </button>
      ) : null}
      <PickerBody
        surface={surface}
        trail={trail}
        onNavigate={(next) => {
          clearInput();
          setTrail(next);
          setInlineError(null);
        }}
        onSearchEverywhere={() => {
          setTrail([]);
          setInlineError(null);
        }}
        input={input}
        query={query}
        onInputChange={changeInput}
        onClearInput={clearInput}
        onCommitSearch={() => {
          stopDebounce();
          setQuery(input);
        }}
        knownHeld={NOTHING_HELD}
        onChoose={(folder: FolderRecord) => choose({ uuid: folder.uuid, name: folder.name })}
        onCreate={createHere}
        pendingFolderUuid={null}
        creating={create.isPending}
        inlineError={inlineError}
        notice={null}
      />
    </div>
  );

  if (wide === null) return null;
  if (wide) {
    return (
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="gap-4 sm:max-w-lg" onEscapeKeyDown={escape}>
          <DialogHeader className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body('dialog')}
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
        // Focusable, and no autofocus on a phone: the folder picker's own rules (FolderPicker.tsx).
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          sheetRef.current?.focus();
        }}
        className="max-h-[88dvh] gap-0 rounded-t-2xl border-border/60 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        style={{ bottom: 'var(--keyboard-inset, 0px)' }}
      >
        <SheetHeader className="gap-1 p-0 pb-3 pr-10">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {body('sheet')}
      </SheetContent>
    </Sheet>
  );
}
