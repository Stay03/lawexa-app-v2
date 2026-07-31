'use client';

import { useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Globe, Plus, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { jurisdictionsQueries } from '@/v2/features/jurisdictions/queries';
import type { Jurisdiction } from '@/types/jurisdiction';
import { RADAR_LIMITS } from './form-model';

/**
 * JurisdictionsField — the radar form's multi-select jurisdiction chips.
 *
 * The picker is the composer `JurisdictionField`'s proven popover grammar
 * (search over the real jurisdiction list, self-hosted flags, listbox rows),
 * adapted to MULTI-select: rows TOGGLE and the popover stays open, so adding
 * three countries is three toggles rather than three open-search-click
 * cycles. The chips outside mirror `ChipsField`'s removal affordance (whole
 * chip = remove button) so the form's two chip rows behave identically.
 *
 * KEYBOARD: the combobox contract, same as `TimezonePicker` — focus stays in
 * the search input, ArrowUp/ArrowDown move the active option
 * (`aria-activedescendant`, wrapping, first match active), Enter TOGGLES the
 * active option (the popover stays open for the next one), Escape closes.
 * Option rows are `tabIndex={-1}` — one Tab stop for the whole picker.
 */

/** v1's flag rule: 2-letter ISO codes render; UK subdivisions borrow GB. */
function flagCode(jurisdiction: Jurisdiction): string | undefined {
  if (jurisdiction.code.length === 2) return jurisdiction.code.toUpperCase();
  if (jurisdiction.parent?.slug === 'united-kingdom') return 'GB';
  return undefined;
}

function Flag({ code }: { code: string | undefined }) {
  if (!code) {
    return <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <FlagIcon code={code} className="shrink-0" />;
}

export function JurisdictionsField({
  value,
  onChange,
  signedIn,
  describedBy,
  invalid = false,
}: {
  /** Selected jurisdiction slugs. */
  value: string[];
  onChange: (value: string[]) => void;
  /** The jurisdiction list needs a token — gate the fetch. */
  signedIn: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [announcement, setAnnouncement] = useState('');
  // The combobox's active-option index over the FILTERED list — reset on
  // every search edit and every open, clamped when the list shrinks.
  const [active, setActive] = useState(0);

  const jurisdictionsQuery = useQuery({
    ...jurisdictionsQueries.list(),
    enabled: signedIn,
  });
  const jurisdictions = jurisdictionsQuery.data;
  const atCapacity = value.length >= RADAR_LIMITS.jurisdictions;

  const bySlug = useMemo(() => {
    const map = new Map<string, Jurisdiction>();
    for (const jurisdiction of jurisdictions ?? []) {
      map.set(jurisdiction.slug, jurisdiction);
    }
    return map;
  }, [jurisdictions]);

  const sorted = useMemo(
    () =>
      [...(jurisdictions ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [jurisdictions],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(
      (jurisdiction) =>
        jurisdiction.name.toLowerCase().includes(needle) ||
        jurisdiction.code.toLowerCase().includes(needle) ||
        (jurisdiction.parent?.name.toLowerCase().includes(needle) ?? false),
    );
  }, [sorted, search]);

  const nameFor = (slug: string) => bySlug.get(slug)?.name ?? slug;

  const activeIndex =
    filtered.length === 0 ? -1 : Math.min(active, filtered.length - 1);
  const optionId = (index: number) => `${listboxId}-opt-${index}`;

  const toggle = (slug: string) => {
    if (value.includes(slug)) {
      onChange(value.filter((existing) => existing !== slug));
      setAnnouncement(`Removed ${nameFor(slug)}`);
    } else if (!atCapacity) {
      onChange([...value, slug]);
      setAnnouncement(`Added ${nameFor(slug)}`);
    }
  };

  const remove = (slug: string) => {
    onChange(value.filter((existing) => existing !== slug));
    setAnnouncement(`Removed ${nameFor(slug)}`);
  };

  const moveActive = (next: number) => {
    if (filtered.length === 0) return;
    const wrapped = (next + filtered.length) % filtered.length;
    setActive(wrapped);
    const id = optionId(wrapped);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
    });
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(activeIndex - 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (activeIndex >= 0) toggle(filtered[activeIndex].slug);
        break;
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-11 w-full flex-wrap content-center items-center gap-1.5 rounded-xl border bg-input/30 px-2.5 py-2 transition-colors',
        invalid ? 'border-destructive/60' : 'border-input',
      )}
    >
      {value.map((slug) => {
        const jurisdiction = bySlug.get(slug);
        return (
          <button
            key={slug}
            type="button"
            onClick={() => remove(slug)}
            aria-label={`Remove ${nameFor(slug)}`}
            className={cn(
              'v2-interactive inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-full bg-secondary px-2.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
              FOCUS_RING,
            )}
          >
            {jurisdiction ? <Flag code={flagCode(jurisdiction)} /> : null}
            <span className="truncate">{nameFor(slug)}</span>
            <X aria-hidden className="size-3 shrink-0" />
          </button>
        );
      })}

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setSearch('');
          setActive(0);
        }}
      >
        <PopoverTrigger asChild>
          {/* `aria-invalid` is not valid on a button role — the error is
              announced through `aria-describedby`; `data-invalid` is the
              form's focus-first-error hook. */}
          <button
            type="button"
            disabled={atCapacity}
            aria-describedby={describedBy}
            data-invalid={invalid || undefined}
            className={cn(
              'v2-interactive inline-flex min-h-6 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
              FOCUS_RING,
            )}
          >
            <Plus aria-hidden className="size-3" />
            Add country
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-80 p-2">
          <div className="flex flex-col gap-1">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-activedescendant={
                  activeIndex >= 0 ? optionId(activeIndex) : undefined
                }
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKeyDown}
                aria-label="Search countries"
                placeholder="Search countries…"
                autoFocus
                autoComplete="off"
                className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div
              id={listboxId}
              role="listbox"
              aria-label="Countries"
              aria-multiselectable="true"
              className="max-h-56 overflow-y-auto overscroll-contain pt-1"
            >
              {jurisdictionsQuery.isPending && signedIn ? (
                <ul className="flex flex-col gap-1" aria-hidden>
                  {[0.9, 0.7, 0.5, 0.3].map((opacity, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2.5 px-2 py-1.5"
                      style={{ opacity }}
                    >
                      <Skeleton className="size-4 shrink-0 rounded-sm" />
                      <Skeleton className="h-3.5 w-32 rounded" />
                    </li>
                  ))}
                </ul>
              ) : jurisdictionsQuery.isError ? (
                <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    Couldn&apos;t load countries.
                  </p>
                  <button
                    type="button"
                    onClick={() => void jurisdictionsQuery.refetch()}
                    className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  {filtered.map((jurisdiction, index) => {
                    const selected = value.includes(jurisdiction.slug);
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={jurisdiction.slug}
                        id={optionId(index)}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        tabIndex={-1}
                        disabled={!selected && atCapacity}
                        onClick={() => toggle(jurisdiction.slug)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50',
                          isActive && 'bg-accent text-accent-foreground',
                          selected && !isActive && 'bg-accent/60 text-accent-foreground',
                        )}
                      >
                        <Flag code={flagCode(jurisdiction)} />
                        <span className="truncate font-medium">
                          {jurisdiction.name}
                        </span>
                        {jurisdiction.parent ? (
                          <span className="truncate text-xs text-muted-foreground">
                            ({jurisdiction.parent.name})
                          </span>
                        ) : null}
                        {selected ? (
                          <Check
                            aria-hidden
                            className="ml-auto size-4 shrink-0 text-primary"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      No countries match.
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {atCapacity ? (
              <p className="border-t px-2 pt-2 text-xs text-muted-foreground">
                Limit of {RADAR_LIMITS.jurisdictions} reached — remove one to
                add another.
              </p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
