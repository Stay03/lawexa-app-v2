'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useV2Session } from '@/v2/runtime/session-context';
import { foldersQueries } from '../queries';
import type { FolderRecord } from '../types';
import {
  CreateOption,
  CreateRow,
  FolderOption,
  FolderRow,
  PickerNotice,
  PickerRowsSkeleton,
  type CreateRowView,
  type FolderRowView,
} from './PickerRows';
import { createDestinationLabel, type PickerCrumb } from './picker-model';
import {
  CREATE_ACTIVE,
  enterAction,
  moveActive,
  pickerOptionRing,
  resolveActive,
  type PickerActive,
} from './picker-keys';

/**
 * PickerBody — one search field, one trail, one list of destinations, in the
 * interaction model its surface can actually be driven with.
 *
 * ── DIALOG: A COMBOBOX OVER A LISTBOX ──────────────────────────────────────
 * The field is the combobox (`aria-expanded`, `aria-controls`,
 * `aria-activedescendant`, `aria-autocomplete="list"`); the rows are its
 * listbox. Focus never leaves the field, so typing, arrowing and choosing are
 * one continuous gesture and no row is a tab stop.
 *
 *   ↓ / ↑        move the highlight (wraps)
 *   Enter        commits what was typed while the list is still answering the
 *                previous search; otherwise chooses the highlighted option
 *   →            open the highlighted folder, with the caret at the END of the
 *                field, where Right Arrow would otherwise do nothing
 *   ←            go up one level, with the caret at the START
 *   Esc          clears the field first, closes the picker second (owned by the
 *                surface's `onEscapeKeyDown` so it is deterministic)
 *
 * ── SHEET: PLAIN BUTTONS ───────────────────────────────────────────────────
 * A phone has no arrow keys, so a combobox there is ceremony with a hole in it:
 * the way into a subfolder would exist only on a key that cannot be pressed.
 * The sheet renders an ordinary list of buttons instead — see `PickerRows`.
 *
 * ── NOTHING COMMITS ON BLUR, AND NOTHING COMMITS BLIND ─────────────────────
 * The only activations are a click and Enter. A click always lands on a row the
 * reader can read; Enter cannot, so Enter is gated on the rendered list
 * genuinely answering the words in the field ({@link enterAction}) — inside the
 * debounce window it commits the search instead of filing into whatever
 * happened to sit at the top of the previous one.
 *
 * ── SEARCH IS EXACTLY AS WIDE AS THE SERVER MAKES IT, AND SAYS SO ──────────
 * Probed: `my-folders?search=` with NO `parent_id` matches folders at EVERY
 * depth and returns each `slug_path`; with a `parent_id` it matches that
 * folder's DIRECT CHILDREN only. So the field searches the level you are
 * standing in — the whole account at the root, one folder's children once you
 * have drilled — and the placeholder and the empty state say which of those two
 * it just did. When a drilled search comes up empty, the way out is offered
 * rather than described.
 *
 * ── SKELETON-FIRST, NEVER PLACEHOLDER TEXT ─────────────────────────────────
 * A cold level draws four rows of exact final geometry; a level already in
 * cache paints instantly and refetches behind the pulsing field icon.
 */

export interface PickerBodyProps {
  /** Which interaction model this surface can be driven with. */
  surface: 'dialog' | 'sheet';
  /** The drilled path, root-first. Empty = the viewer's top level. */
  trail: readonly PickerCrumb[];
  /**
   * Move to another level. ALWAYS clears the field: a search carried into a
   * folder you just opened would filter it by the words that found it, and the
   * reader who opened it wants to see what is inside.
   */
  onNavigate: (trail: readonly PickerCrumb[]) => void;
  /** The one navigation that KEEPS the field: widening a level search to everything. */
  onSearchEverywhere: () => void;
  /** The field's live text. */
  input: string;
  /** The debounced text the rendered list was actually fetched with. */
  query: string;
  onInputChange: (value: string) => void;
  onClearInput: () => void;
  /** Run the debounce NOW, so the list catches up with the field. */
  onCommitSearch: () => void;
  /** Folder uuids the server has told us already hold this item (422s). */
  knownHeld: ReadonlySet<string>;
  onChoose: (folder: FolderRecord) => void;
  onCreate: (name: string) => void;
  /** The folder a write is currently on the wire for. */
  pendingFolderUuid: string | null;
  creating: boolean;
  /** A failure the picker must show in place (never a toast — it is on screen). */
  inlineError: string | null;
  /** Overrides the polite count announcement for one beat (e.g. a duplicate). */
  notice: string | null;
}

export function PickerBody({
  surface,
  trail,
  onNavigate,
  onSearchEverywhere,
  input,
  query,
  onInputChange,
  onClearInput,
  onCommitSearch,
  knownHeld,
  onChoose,
  onCreate,
  pendingFolderUuid,
  creating,
  inlineError,
  notice,
}: PickerBodyProps) {
  const { userId: viewerId } = useV2Session();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const here = trail.length > 0 ? trail[trail.length - 1] : null;
  const parentUuid = here?.uuid ?? null;
  const search = query.trim();
  const typedName = input.trim();
  const isDialog = surface === 'dialog';

  const level = useInfiniteQuery(
    foldersQueries.level({
      parentUuid,
      search: search || undefined,
      viewerId,
    }),
  );

  const folders = useMemo(
    () => level.data?.pages.flatMap((page) => page.data) ?? [],
    [level.data],
  );

  // The option ring is addressed by IDENTITY, never by index: the list grows
  // under the reader (the sentinel fetches the next page while they arrow), and
  // an index would silently re-point at a folder they have never seen.
  const ring = useMemo(
    () => pickerOptionRing(folders.map((folder) => folder.uuid)),
    [folders],
  );

  // Reset the highlight when the LIST ITSELF changes — the sanctioned
  // "adjust state during render" reset (an effect here would trip
  // `react-hooks/set-state-in-effect`, which runs as an error in this repo).
  const signature = `${parentUuid ?? ''}|${search}`;
  const [seenSignature, setSeenSignature] = useState(signature);
  const [held, setHeld] = useState<PickerActive | null>(null);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setHeld(null);
  }
  const active = resolveActive(ring, held);

  const optionId = (option: PickerActive) =>
    option.kind === 'create' ? `${listId}-create` : `${listId}-folder-${option.uuid}`;
  const activeId = optionId(active);
  // The listbox only exists once the level has resolved, so the combobox only
  // claims it then — an `aria-controls` pointing at nothing is a lie a screen
  // reader repeats. It is also the gate Enter is allowed to act behind.
  const listReady = !level.isPending && !level.isError;

  // Keep the highlight in view. No state is written, so this is lint-clean.
  useEffect(() => {
    document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const sentinelRef = useInfiniteScrollSentinel<HTMLLIElement, HTMLDivElement>({
    hasNextPage: level.hasNextPage,
    isFetchingNextPage: level.isFetchingNextPage,
    fetchNextPage: level.fetchNextPage,
    rootRef: scrollRef,
    rootMargin: '160px',
  });

  /**
   * Move levels and put the cursor back in the field. A trail step is a real
   * button, so pressing it takes focus out of the combobox — and a picker that
   * stopped answering the arrow keys after one press back would be a picker you
   * have to reach for the mouse to finish.
   */
  const goTo = (next: readonly PickerCrumb[]) => {
    onNavigate(next);
    if (isDialog) inputRef.current?.focus();
  };

  const drill = (folder: FolderRecord) => {
    goTo([...trail, { uuid: folder.uuid, name: folder.name }]);
  };

  const createRow: CreateRowView = {
    name: typedName,
    destination: createDestinationLabel(trail),
    busy: creating,
  };

  /** The create row with nothing typed: not a no-op and not a lie — it says
   *  what it needs and puts the cursor there. */
  const activateCreate = () => {
    if (typedName) onCreate(typedName);
    else inputRef.current?.focus();
  };

  const rowView = (folder: FolderRecord): FolderRowView => ({
    folder,
    busy: pendingFolderUuid === folder.uuid,
    alreadyHolds: knownHeld.has(folder.uuid),
    // Only a ROOT search leaves the level, so only a root search has to say
    // where each row came from.
    showAddress: search.length > 0 && trail.length === 0,
  });

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    const caretAtStart = field.selectionStart === 0 && field.selectionEnd === 0;
    const caretAtEnd =
      field.selectionStart === field.value.length &&
      field.selectionEnd === field.value.length;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHeld(moveActive(ring, active, 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHeld(moveActive(ring, active, -1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const action = enterAction({
        listReady,
        input,
        committedSearch: query,
        active,
      });
      if (action.kind === 'commit-search') {
        onCommitSearch();
        return;
      }
      if (action.kind === 'choose') {
        const folder = folders.find((entry) => entry.uuid === action.uuid);
        if (folder) onChoose(folder);
        return;
      }
      if (action.kind === 'create') {
        onCreate(action.name);
        return;
      }
      if (action.kind === 'focus-field') inputRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowRight' && caretAtEnd) {
      if (active.kind === 'folder') {
        const folder = folders.find((entry) => entry.uuid === active.uuid);
        if (folder && folder.children_count > 0) {
          event.preventDefault();
          drill(folder);
        }
      }
      return;
    }
    if (event.key === 'ArrowLeft' && caretAtStart && trail.length > 0) {
      event.preventDefault();
      goTo(trail.slice(0, -1));
    }
  };

  const countAnnouncement = level.isPending
    ? 'Loading your folders'
    : level.isError
      ? 'Your folders could not be loaded'
      : `${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}${
          search ? ` matching ${search}` : ''
        }`;

  const fieldLabel = here ? `Search in ${here.name}` : 'Search your folders';

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Where you are, and one press back to anywhere you came through. Drawn
          only once there is somewhere to go back TO. It is a WALK, not an
          ancestry: drilling out of a root search result starts partway down the
          tree, and this never pretends to know steps it did not take. */}
      {trail.length > 0 ? (
        <nav
          aria-label="Where you are"
          className="-mx-1 flex items-center gap-0.5 overflow-x-auto px-1 pb-0.5 text-xs"
        >
          <TrailStep label="Your folders" onClick={() => goTo([])} />
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <span key={crumb.uuid} className="flex shrink-0 items-center gap-0.5">
                <ChevronRight
                  aria-hidden
                  className="size-3 shrink-0 text-muted-foreground/50"
                />
                {last ? (
                  <span
                    aria-current="location"
                    className="max-w-40 truncate px-2 py-1 font-medium text-foreground"
                  >
                    {crumb.name}
                  </span>
                ) : (
                  <TrailStep
                    label={crumb.name}
                    onClick={() => goTo(trail.slice(0, index + 1))}
                  />
                )}
              </span>
            );
          })}
        </nav>
      ) : null}

      {/* The field. Not `SearchField`: the dialog's is a combobox and needs the
          ARIA wiring that component does not expose. Same 44px geometry, same
          16px base font (no iOS focus-zoom), same clear affordance. */}
      <div className="relative">
        <Search
          aria-hidden
          className={cn(
            'pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-opacity',
            level.isFetching && !level.isPending && 'motion-safe:animate-pulse',
          )}
        />
        <Input
          ref={inputRef}
          type="text"
          inputMode="search"
          {...(isDialog
            ? {
                role: 'combobox',
                'aria-expanded': listReady,
                'aria-controls': listReady ? listId : undefined,
                'aria-activedescendant': listReady ? activeId : undefined,
                'aria-autocomplete': 'list' as const,
              }
            : {})}
          aria-label={fieldLabel}
          placeholder={fieldLabel}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          // The server refuses a name over 255 characters; the field that
          // doubles as the name field simply cannot type one.
          maxLength={255}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={isDialog ? onKeyDown : undefined}
          className="h-11 w-full rounded-4xl pl-10 pr-12"
        />
        {input ? (
          <button
            type="button"
            onClick={onClearInput}
            aria-label="Clear search"
            className={cn(
              'v2-interactive absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="-mx-1 max-h-[min(24rem,45dvh)] min-h-0 overflow-y-auto overscroll-contain px-1"
      >
        {level.isPending ? (
          <PickerRowsSkeleton />
        ) : level.isError ? (
          <PickerNotice
            title="Your folders could not be loaded."
            detail="The connection may have dropped."
            action={{ label: 'Try again', onClick: () => void level.refetch() }}
          />
        ) : (
          <>
            {folders.length === 0 ? (
              <EmptyLevel
                here={here}
                search={search}
                // Its button vanishes with the empty state it lives in, so the
                // cursor is handed back to the field rather than dropped.
                onSearchEverywhere={() => {
                  onSearchEverywhere();
                  if (isDialog) inputRef.current?.focus();
                }}
              />
            ) : null}

            {isDialog ? (
              /* The listbox holds the destinations AND the create row, so the
                 keyboard never leaves one container. A mousedown inside it is
                 swallowed so the field keeps focus — `aria-activedescendant`
                 only means anything while it does. */
              <ul
                id={listId}
                role="listbox"
                aria-label="Folders"
                aria-busy={level.isFetching}
                onMouseDown={(event) => event.preventDefault()}
                className="flex flex-col gap-0.5"
              >
                {folders.map((folder) => (
                  <FolderOption
                    key={folder.uuid}
                    view={rowView(folder)}
                    optionId={optionId({ kind: 'folder', uuid: folder.uuid })}
                    active={active.kind === 'folder' && active.uuid === folder.uuid}
                    onChoose={() => onChoose(folder)}
                    onDrill={() => drill(folder)}
                    onHover={() => setHeld({ kind: 'folder', uuid: folder.uuid })}
                  />
                ))}
                {level.hasNextPage ? (
                  <li ref={sentinelRef} aria-hidden className="h-4 shrink-0" />
                ) : null}
                <CreateOption
                  view={createRow}
                  optionId={optionId(CREATE_ACTIVE)}
                  active={active.kind === 'create'}
                  onActivate={activateCreate}
                  onHover={() => setHeld(CREATE_ACTIVE)}
                />
              </ul>
            ) : (
              <ul aria-busy={level.isFetching} className="flex flex-col gap-0.5">
                {folders.map((folder) => (
                  <FolderRow
                    key={folder.uuid}
                    view={rowView(folder)}
                    onChoose={() => onChoose(folder)}
                    onDrill={() => drill(folder)}
                  />
                ))}
                {level.hasNextPage ? (
                  <li ref={sentinelRef} aria-hidden className="h-4 shrink-0" />
                ) : null}
                <CreateRow view={createRow} onActivate={activateCreate} />
              </ul>
            )}
          </>
        )}
      </div>

      {inlineError ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {inlineError}
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {notice ?? countAnnouncement}
      </p>
    </div>
  );
}

function TrailStep({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'v2-interactive max-w-40 shrink-0 truncate rounded-full px-2 py-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {label}
    </button>
  );
}

/**
 * The three empty answers, each naming exactly what was looked at — a picker
 * that said "no folders" after searching one level would send a reader off to
 * re-create a folder they already own.
 */
function EmptyLevel({
  here,
  search,
  onSearchEverywhere,
}: {
  here: PickerCrumb | null;
  search: string;
  onSearchEverywhere: () => void;
}) {
  if (search && here) {
    return (
      <PickerNotice
        title={`Nothing in “${here.name}” matches “${search}”.`}
        detail="Searching inside a folder looks at what it holds directly."
        action={{ label: 'Search all your folders', onClick: onSearchEverywhere }}
      />
    );
  }
  if (search) {
    return <PickerNotice title={`No folder matches “${search}”.`} />;
  }
  if (here) {
    return <PickerNotice title={`“${here.name}” has no folders inside it.`} />;
  }
  return (
    <PickerNotice
      title="You have no folders yet."
      detail="Group the cases, statutes and notes for one matter in one place."
    />
  );
}
