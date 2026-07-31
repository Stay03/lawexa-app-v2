'use client';

import { useId, useMemo, useState } from 'react';
import { Check, MapPin, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * TimezonePicker — the schedule's timezone control, rebuilt on the researched
 * time-zone-selector rules (NN/g + Smart Interface Design Patterns):
 *
 *  - the FULL IANA list (`Intl.supportedValuesOf('timeZone')`, ~420 zones),
 *    alphabetical. v1 silently rendered only the first 50 matches — a zone
 *    past the cap simply could not be chosen without a lucky search;
 *  - search matches the zone NAME (with `_`/`/` treated as spaces, so
 *    "sao paulo" and "america sao" both hit America/Sao_Paulo) AND the
 *    current GMT OFFSET — offset queries are normalized by stripping leading
 *    zeros after the sign, so "gmt+1", "gmt+01", "+1" and "+01" all match
 *    the "GMT+1" label `shortOffset` produces;
 *  - every row shows its current offset, computed per zone once and cached
 *    module-wide (an `Intl.DateTimeFormat` per zone is the only way to ask,
 *    and asking twice would be waste);
 *  - the DEVICE'S zone is pinned at the top as a one-click suggestion when it
 *    is not already selected.
 *
 * KEYBOARD: the real combobox contract (APG). Focus STAYS in the search
 * input; ArrowUp/ArrowDown move the ACTIVE option (`aria-activedescendant`,
 * wrapping, first match active by default so search-then-Enter needs no
 * arrows), Enter selects the active option, Escape closes (Radix). Option
 * rows are `tabIndex={-1}` — one Tab stop for the whole widget.
 *
 * The confirmation lives OUTSIDE this control: the schedule fieldset's
 * current-time line re-renders the moment a zone is picked, which is the
 * "show me the consequence" check the research asks for.
 */

/** zone → "GMT+1" (as of first ask this session; DST drift within a session
 *  is cosmetic here). Module-level so 420 formatters are built once. */
const offsetCache = new Map<string, string>();

function offsetLabel(zone: string, now: number): string {
  const cached = offsetCache.get(zone);
  if (cached !== undefined) return cached;
  let label = '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date(now));
    label = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    label = '';
  }
  offsetCache.set(zone, label);
  return label;
}

function displayName(zone: string): string {
  return zone.replace(/_/g, ' ');
}

function searchableText(zone: string, offset: string): string {
  return `${zone.replace(/[_/]/g, ' ').toLowerCase()} ${offset.toLowerCase()}`;
}

/** "gmt+01" / "+01" → "gmt+1" / "+1", so zero-padded offset queries match
 *  the unpadded labels `shortOffset` yields. */
function normalizeOffsetQuery(needle: string): string {
  return needle.replace(/([+-])0(?=\d)/g, '$1');
}

export function TimezonePicker({
  value,
  onChange,
  triggerLabel = 'Change',
}: {
  /** The selected IANA zone. */
  value: string;
  onChange: (zone: string) => void;
  triggerLabel?: string;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // The combobox's active-option index over the FILTERED list. Reset with
  // every search edit and every open, clamped when the list shrinks.
  const [active, setActive] = useState(0);

  // Client-only values behind lazy initializers (React Compiler lint): the
  // zone list and the "as of" clock for offsets are frozen per mount.
  const [zones] = useState<readonly string[]>(() =>
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [],
  );
  const [now] = useState(() => Date.now());
  const [deviceZone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  const filtered = useMemo(() => {
    const needle = normalizeOffsetQuery(search.trim().toLowerCase());
    if (!needle) return zones;
    return zones.filter((zone) =>
      searchableText(zone, offsetLabel(zone, now)).includes(needle),
    );
  }, [zones, search, now]);

  const activeIndex =
    filtered.length === 0 ? -1 : Math.min(active, filtered.length - 1);
  const optionId = (index: number) => `${listboxId}-opt-${index}`;

  const select = (zone: string) => {
    onChange(zone);
    setOpen(false);
    setSearch('');
    setActive(0);
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
        if (activeIndex >= 0) select(filtered[activeIndex]);
        break;
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setSearch('');
        setActive(0);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="v2-interactive rounded-md font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Change timezone (currently ${displayName(value)})`}
        >
          {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[21rem] p-2">
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
              aria-label="Search timezones by name or offset"
              placeholder="Search city, region, or GMT offset…"
              autoFocus
              autoComplete="off"
              className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {/* The device zone, one click away, when it isn't already chosen.
              A shortcut OUTSIDE the combobox flow — its own Tab stop. */}
          {deviceZone && deviceZone !== value ? (
            <div className="border-b pb-1">
              <button
                type="button"
                onClick={() => select(deviceZone)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <MapPin
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">Use device timezone</span>
                  <span className="text-muted-foreground">
                    {' '}
                    — {displayName(deviceZone)}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {offsetLabel(deviceZone, now)}
                </span>
              </button>
            </div>
          ) : null}

          <div
            id={listboxId}
            role="listbox"
            aria-label="Timezones"
            className="max-h-64 overflow-y-auto overscroll-contain pt-1"
          >
            {filtered.map((zone, index) => {
              const selected = zone === value;
              const isActive = index === activeIndex;
              return (
                <button
                  key={zone}
                  id={optionId(index)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onClick={() => select(zone)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground',
                    selected && !isActive && 'bg-accent/60 text-accent-foreground',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {displayName(zone)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {offsetLabel(zone, now)}
                  </span>
                  {selected ? (
                    <Check
                      aria-hidden
                      className="size-4 shrink-0 text-primary"
                    />
                  ) : null}
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                No timezones match.
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
