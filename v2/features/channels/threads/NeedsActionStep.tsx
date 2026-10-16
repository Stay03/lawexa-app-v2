'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { Member, ThreadStatusPerson } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { channelsQueries } from '../queries';
import { moveRadioFocus } from './radio-focus';

/** The server's limit on a status note. */
const NOTE_MAX = 140;

/** How long typing settles before the member search asks the server. */
const SEARCH_DEBOUNCE_MS = 250;

/** The picker's first option, and its default: nobody named. */
const NO_ONE = 'No one in particular';

/**
 * NeedsActionStep — the second step of choosing Needs Action (Arthur, 16
 * October 2026): who needs to act, optionally, and a short note, optionally,
 * then Save. The other statuses save on a tap; this one asks first, inside the
 * same popover or sheet.
 *
 * ── THE PEOPLE ARE THE PARENT CHANNEL'S ACTIVE MEMBERS ─────────────────────
 * `GET /channels/{parent}/members` (backend, 16 October 2026: exactly the
 * people who may be named, since a person who cannot post in the thread is a
 * 422 on `errors.needs_action_from`). With nothing typed it is the SAME cache
 * entry the parent's own screen, its members sheet and its composer's mention
 * picker read. Typed text goes to the server as `?search=` (name or username,
 * backend 16 October 2026) after a 250ms pause, so a channel past one page is
 * searchable whole; while that request is out, the first page is filtered here
 * by name so the list answers the keystroke at once.
 *
 * ── A REAL RADIO GROUP ─────────────────────────────────────────────────────
 * "No one in particular" comes first and is the default, so a tap never
 * un-chooses anybody. One tab stop (the chosen option, or the first when the
 * chosen person is filtered out), arrows move focus, a click, Enter or Space
 * chooses (checker, 16 October 2026).
 *
 * ── FOCUS ARRIVES WITH THE STEP ────────────────────────────────────────────
 * The step replaces the list it was opened from, so the option that held
 * focus is gone. A stable callback ref puts focus in the search box, or on
 * Save when there is no parent to search; stable, so typing in the note never
 * pulls focus back.
 */
export function NeedsActionStep({
  parentUuid,
  viewerId,
  initialPerson,
  initialNote,
  pending,
  error,
  onBack,
  onSave,
}: {
  parentUuid: string | null;
  viewerId: number | null;
  initialPerson: ThreadStatusPerson | null;
  initialNote: string | null;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onSave: (person: ThreadStatusPerson | null, note: string | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState<ThreadStatusPerson | null>(initialPerson);
  const [note, setNote] = useState(initialNote ?? '');
  const typed = search.trim();
  /* The text the server is asked about, settled SEARCH_DEBOUNCE_MS after the
     last keystroke. The timer is set in the change handler, never in an
     effect, and cleared when the step leaves. */
  const [debounced, setDebounced] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    },
    [],
  );
  const onSearchChange = (next: string) => {
    setSearch(next);
    if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      setDebounced(next.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  const roster = useQuery({
    ...channelsQueries.members(parentUuid ?? '', { viewerId }),
    enabled: parentUuid !== null,
  });
  const searched = useQuery({
    ...channelsQueries.members(parentUuid ?? '', { viewerId, search: debounced }),
    enabled: parentUuid !== null && debounced !== '',
  });

  const people = useMemo(() => {
    const active = (rows: readonly Member[]) =>
      rows
        .filter((member) => member.is_active)
        .map((member) => ({ uuid: member.user.uuid, name: member.user.name }));
    // The server's answer for exactly what is typed, when it has one.
    if (typed !== '' && debounced === typed && searched.data) {
      return active(searched.data.data);
    }
    // Otherwise the first page, filtered here while the request is out.
    const needle = typed.toLowerCase();
    return active(roster.data?.data ?? []).filter(
      (entry) => !needle || entry.name.toLowerCase().includes(needle),
    );
  }, [typed, debounced, searched.data, roster.data]);

  const focusOnArrive = useCallback((node: HTMLElement | null) => {
    node?.focus();
  }, []);

  const chosen = person?.uuid ?? null;
  const chosenVisible = chosen !== null && people.some((entry) => entry.uuid === chosen);
  const options: readonly { uuid: string | null; name: string }[] = [
    { uuid: null, name: NO_ONE },
    ...people,
  ];

  return (
    <div className="flex flex-col gap-2 px-1 pb-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the statuses"
          className={cn(
            'v2-interactive flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground',
            'transition-colors duration-150 hover:bg-secondary/60 hover:text-foreground motion-reduce:transition-none',
            FOCUS_RING,
          )}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <p id="v2-needs-action-title" className="text-sm font-medium text-foreground">
          Who needs to act?{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
      </div>

      {parentUuid !== null && (
        <Input
          ref={focusOnArrive}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search members"
          aria-label="Search members"
          className="h-8"
        />
      )}

      <div
        role="radiogroup"
        aria-labelledby="v2-needs-action-title"
        onKeyDown={moveRadioFocus}
        className="v2-quiet-scroll flex max-h-44 flex-col overflow-y-auto"
      >
        {options.map((entry, index) => {
          const selected = entry.uuid === chosen;
          const tabStop = chosenVisible ? selected : index === 0;
          return (
            <button
              key={entry.uuid ?? 'no-one'}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={tabStop ? 0 : -1}
              onClick={() =>
                setPerson(entry.uuid === null ? null : { uuid: entry.uuid, name: entry.name })
              }
              className={cn(
                'v2-interactive flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm',
                'transition-colors duration-150 motion-reduce:transition-none',
                selected ? 'bg-secondary' : 'hover:bg-secondary/60',
                entry.uuid === null && 'text-muted-foreground',
                FOCUS_RING,
              )}
            >
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              {selected && <Check aria-hidden className="size-4 shrink-0 text-primary" />}
            </button>
          );
        })}
        {parentUuid !== null &&
          (roster.isPending ? (
            <div aria-hidden className="space-y-2 p-2">
              <Skeleton className="h-3.5 w-2/3 rounded" />
              <Skeleton className="h-3.5 w-1/2 rounded" />
            </div>
          ) : roster.isError ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Couldn’t load the members. You can still save without a name.
            </p>
          ) : people.length === 0 && typed !== '' ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No member matches that name.
            </p>
          ) : null)}
      </div>

      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={NOTE_MAX}
        placeholder="Add a short note (optional)"
        aria-label="Note (optional)"
        className="h-8"
      />

      {error && (
        <p role="alert" className="px-1 text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        ref={parentUuid === null ? focusOnArrive : undefined}
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => onSave(person, note.trim() || null)}
        className="self-end"
      >
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Save
      </Button>
    </div>
  );
}
