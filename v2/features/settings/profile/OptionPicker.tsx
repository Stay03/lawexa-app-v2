'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';

/**
 * OptionPicker: the searchable list behind a `SettingsPickerField`.
 *
 * Two rows on this form open one: the country (about 250 answers, fetched) and
 * the areas of expertise (about 100, and you may hold several). Neither fits in
 * a select, and v1 put both in a combobox that types over its own value: the
 * country field showed the chosen country until you focused it, then blanked
 * itself, then restored the old value on blur if you did not choose. On a phone
 * that is a text field you cannot read.
 *
 * A full-screen list with a search box at the top is what a phone does instead,
 * and `ResponsiveOverlay` already gives it for free: full screen below `md:`,
 * the familiar centred card above it, hardware Back closes it, and the keyboard
 * never covers the footer.
 *
 * ── ONE COMPONENT, TWO MODES ───────────────────────────────────────────────
 * `multiple` decides everything that differs. Single: picking closes the list,
 * because the question is answered. Multiple: picking toggles and the list
 * stays, because it is not, and the footer carries the way out.
 */

export interface PickerOption {
  /** Stable identity AND the value that is stored. */
  id: string;
  label: string;
}

export function OptionPicker({
  open,
  onOpenChange,
  title,
  description,
  searchLabel,
  searchPlaceholder,
  options,
  isLoading = false,
  selected,
  multiple = false,
  emptyMessage,
  onChange,
  onClear,
  onSearchChange,
  allowCustomValue = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The search box's accessible name. Never drawn. */
  searchLabel: string;
  searchPlaceholder: string;
  options: readonly PickerOption[];
  isLoading?: boolean;
  selected: readonly string[];
  multiple?: boolean;
  emptyMessage: string;
  /** The full next selection. Single mode always sends exactly one id. */
  onChange: (ids: string[]) => void;
  /** Offered as a footer control when something is chosen. Single mode only. */
  onClear?: () => void;
  /**
   * The list is filtered BY THE SERVER, so what arrives in `options` is already
   * the answer and must not be filtered again here.
   *
   * A country list is 250 rows and lives in memory, so it filters itself. A
   * list of the world's universities does not: the caller asks the server as
   * the reader types. Without this the picker would narrow the server's answer
   * a second time against the same word, which is harmless until the server
   * matches on something the label does not show — an abbreviation, an old name
   * — and the row it found is then hidden by us.
   */
  onSearchChange?: (query: string) => void;
  /**
   * Offer whatever was typed as a choice of its own.
   *
   * For lists that cannot be complete. A reader whose university is missing
   * from ours must still be able to say where they study, and the alternative
   * is telling them their own institution does not exist. Onboarding already
   * has this escape; a settings screen that lacked it would be a downgrade for
   * the same person.
   */
  allowCustomValue?: boolean;
}) {
  const [search, setSearch] = useState('');

  // Cleared as the list CLOSES, in the event rather than in an effect. The
  // alternative is a list that reopens still filtered by a word the reader
  // typed some time ago and has no reason to remember.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch('');
      onSearchChange?.('');
    }
    onOpenChange(next);
  };

  const handleSearch = (next: string) => {
    setSearch(next);
    onSearchChange?.(next);
  };

  const typed = search.trim();
  const needle = typed.toLowerCase();
  const filtered = useMemo(
    () =>
      // Server-filtered lists arrive as the answer; see `onSearchChange`.
      needle && !onSearchChange
        ? options.filter((option) => option.label.toLowerCase().includes(needle))
        : options,
    [options, needle, onSearchChange],
  );

  /** Only when what they typed is not already on the list, so the escape never
   *  sits above the very row it duplicates. */
  const custom =
    allowCustomValue &&
    typed.length > 0 &&
    !filtered.some((option) => option.label.toLowerCase() === needle)
      ? typed
      : null;

  const chosen = new Set(selected);

  const handlePick = (id: string) => {
    if (!multiple) {
      onChange([id]);
      handleOpenChange(false);
      return;
    }
    onChange(
      chosen.has(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  };

  const footer =
    multiple || (onClear && selected.length > 0) ? (
      <>
        {onClear && selected.length > 0 ? (
          <Button
            variant="outline"
            onClick={() => {
              onClear();
              handleOpenChange(false);
            }}
          >
            Clear
          </Button>
        ) : null}
        {multiple ? (
          <Button onClick={() => handleOpenChange(false)}>Done</Button>
        ) : null}
      </>
    ) : undefined;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={footer}
    >
      <div className="space-y-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div aria-hidden className="flex flex-col gap-1 pt-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-11 w-full rounded-xl"
                style={{ opacity: Math.max(0.25, 1 - index * 0.14) }}
              />
            ))}
          </div>
        ) : filtered.length === 0 && !custom ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <ul className="flex flex-col">
            {/* ABOVE the results, not below them. Somebody types their own
                institution precisely because ours does not have it, so the
                answer they want must not be at the bottom of a list of
                near-misses they have to scroll past first. */}
            {custom ? (
              <li>
                <button
                  type="button"
                  onClick={() => handlePick(custom)}
                  className={cn(
                    'v2-interactive flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm',
                    'transition-colors duration-150 hover:bg-secondary motion-reduce:transition-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <Plus aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    Use &ldquo;{custom}&rdquo;
                  </span>
                </button>
              </li>
            ) : null}
            {filtered.map((option) => {
              const isChosen = chosen.has(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(option.id)}
                    aria-pressed={multiple ? isChosen : undefined}
                    className={cn(
                      'v2-interactive flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm',
                      'transition-colors duration-150 hover:bg-secondary motion-reduce:transition-none',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isChosen && 'text-foreground',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    <Check
                      aria-hidden
                      className={cn(
                        'size-4 shrink-0 text-primary transition-opacity duration-150 motion-reduce:transition-none',
                        isChosen ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ResponsiveOverlay>
  );
}
