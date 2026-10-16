'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { ThreadStatusPerson } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { channelsQueries } from '../queries';

/** The server's limit on a status note. */
const NOTE_MAX = 140;

/**
 * NeedsActionStep — the second step of choosing Needs Action (Arthur, 16
 * October 2026): who needs to act, optionally, and a short note, optionally,
 * then Save. The other statuses save on a tap; this one asks first, inside
 * the same menu or sheet.
 *
 * ── THE PEOPLE ARE THE PARENT CHANNEL'S ACTIVE MEMBERS ─────────────────────
 * `GET /channels/{parent}/members` (backend, 16 October 2026: exactly the
 * people who may be named, since a person who cannot post in the thread is a
 * 422 on `errors.needs_action_from`). It is the SAME cache entry the parent's
 * own screen, its members sheet and its composer's mention picker read, so a
 * reader who came from the parent pays no request for it.
 *
 * ── KEYS STAY HERE ─────────────────────────────────────────────────────────
 * Inside the desktop menu, Radix's content handler eats Tab and turns letters
 * into typeahead, which would make the search box and the note unusable. So
 * every key but Escape stops at this step's root; Escape still closes the
 * surface.
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

  const roster = useQuery({
    ...channelsQueries.members(parentUuid ?? '', { viewerId }),
    enabled: parentUuid !== null,
  });
  const people = useMemo(() => {
    const rows = roster.data?.data ?? [];
    const query = search.trim().toLowerCase();
    return rows
      .filter((member) => member.is_active)
      .map((member) => ({ uuid: member.user.uuid, name: member.user.name }))
      .filter((entry) => !query || entry.name.toLowerCase().includes(query));
  }, [roster.data, search]);

  const keepKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') event.stopPropagation();
  };

  return (
    <div onKeyDown={keepKeys} className="flex flex-col gap-2 px-1 pb-1">
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
        <>
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members"
            aria-label="Search members"
            className="h-8"
          />
          <div
            role="radiogroup"
            aria-labelledby="v2-needs-action-title"
            className="v2-quiet-scroll flex max-h-44 flex-col overflow-y-auto"
          >
            {roster.isPending ? (
              <div aria-hidden className="space-y-2 p-2">
                <Skeleton className="h-3.5 w-2/3 rounded" />
                <Skeleton className="h-3.5 w-1/2 rounded" />
              </div>
            ) : roster.isError ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Couldn’t load the members. You can still save without a name.
              </p>
            ) : people.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No member matches that name.
              </p>
            ) : (
              people.map((entry) => {
                const selected = person?.uuid === entry.uuid;
                return (
                  <button
                    key={entry.uuid}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    // A second tap on the chosen person un-chooses them: the
                    // person is optional.
                    onClick={() => setPerson(selected ? null : entry)}
                    className={cn(
                      'v2-interactive flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      selected ? 'bg-secondary' : 'hover:bg-secondary/60',
                      FOCUS_RING,
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    {selected && (
                      <Check aria-hidden className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

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
