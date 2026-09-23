'use client';

import { useId, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { SettingsChoiceRow } from '../SettingsForm';

/**
 * OptionPicker: the searchable list behind the Country, University and Areas
 * of expertise rows. Too many answers for a `ChoicePanel`, so it adds a search
 * box, and otherwise it IS a `ChoicePanel`.
 *
 * ── WHY IT LOOKS LIKE THE ACCOUNT TYPE SHEET NOW ───────────────────────────
 * The owner, 22 September 2026, with a screenshot of the old one: "country has
 * a check list and clear button at the bottom which is weird. Examine them
 * criticize them and do better especially with the context of how I wanted my
 * account type modal."
 *
 * The old picker was a full-screen page, and it differed from the sheets
 * beside it in five ways, each of which he could see:
 *   - the current answer was invisible. The list opened at Afghanistan and
 *     the tick was on one row of 199, somewhere below;
 *   - its only button was Clear, in the place every other sheet has Done, so
 *     the rarest action had the main spot and one tap erased the answer;
 *   - the rows had no mark, so they read as a menu rather than a choice;
 *   - a tap saved and closed at once, where the sheet above it on the same
 *     page chooses on a tap and keeps on Done;
 *   - on Areas of expertise nothing said how many were picked.
 *
 * So: the same bottom sheet, the same `SettingsChoiceRow` (round mark for one
 * answer, square for several), the same Cancel and Done pair, the current
 * answer pinned first, no Clear, and a count on Done when several are allowed.
 *
 * ── IT SAVES ON DONE, AND UNTIL THEN IT HOLDS A DRAFT ──────────────────────
 * The caller writes the answer in `onChange`, once, when Done is pressed.
 * Cancel, Back and a tap outside all drop the draft. Before this change the
 * three callers passed `set()`, which only changes the screen: after the Save
 * bar was removed on 21 September, nothing sent these answers to the server.
 * Measured on 22 September: choosing Ghana changed the row and sent no request.
 */

export interface PickerOption {
  /** Stable identity AND the value that is stored. */
  id: string;
  label: string;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
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
  onSearchChange,
  allowCustomValue = false,
  busy = false,
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
  /** The SAVED answer. The sheet's draft starts from it on every open. */
  selected: readonly string[];
  multiple?: boolean;
  emptyMessage: string;
  /** The full next selection, once, when Done is pressed. The caller saves it. */
  onChange: (ids: string[]) => void;
  /**
   * The list is filtered BY THE SERVER, so what arrives in `options` is already
   * the answer and must not be filtered again here.
   *
   * A country list is 199 rows and lives in memory, so it filters itself. A
   * list of the world's universities does not: the caller asks the server as
   * the reader types. Without this the picker would narrow the server's answer
   * a second time against the same word, which is harmless until the server
   * matches on something the label does not show (an abbreviation, an old
   * name) and the row it found is then hidden by us.
   */
  onSearchChange?: (query: string) => void;
  /**
   * Offer whatever was typed as a choice of its own.
   *
   * For lists that cannot be complete. A reader whose university is missing
   * from ours must still be able to say where they study, and the alternative
   * is telling them their own institution does not exist.
   */
  allowCustomValue?: boolean;
  /** A write is in flight, so Done must not start a second one. */
  busy?: boolean;
}) {
  const name = useId();
  const legendId = useId();
  const [search, setSearch] = useState('');

  /* `null` is UNTOUCHED, exactly as in `ChoicePanel`: the sheet shows the saved
     answer until a row is tapped, and the draft is dropped in the close handler
     rather than in an effect. */
  const [draft, setDraft] = useState<string[] | null>(null);
  const current = draft ?? selected;
  const changed = draft !== null && !sameSet(draft, selected);

  // Search and draft are both cleared as the sheet CLOSES, in the event rather
  // than in an effect, so it never reopens filtered by an old word or holding
  // an answer the reader walked away from.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch('');
      onSearchChange?.('');
      setDraft(null);
    }
    onOpenChange(next);
  };

  const handleSearch = (next: string) => {
    setSearch(next);
    onSearchChange?.(next);
  };

  const handlePick = (id: string) => {
    if (!multiple) {
      setDraft([id]);
      return;
    }
    setDraft(
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const handleDone = () => {
    if (!changed || draft === null) return;
    onChange(draft);
    handleOpenChange(false);
  };

  const typed = search.trim();
  const needle = typed.toLowerCase();
  // Server-filtered lists arrive as the answer; see `onSearchChange`. Not
  // wrapped in `useMemo`: the React Compiler memoizes this component, and a
  // manual memo over `options` blocks it because `options` is read again below.
  const filtered =
    needle && !onSearchChange
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;

  /* THE SAVED ANSWER GOES FIRST, and only while nothing is typed. It is taken
     from `selected`, not from the draft, so a row does not jump to the top
     under the finger that just tapped it. An answer the list does not carry (a
     university somebody typed in) is pinned under its own name. */
  const pinned: PickerOption[] = typed
    ? []
    : selected.map(
        (id) => options.find((option) => option.id === id) ?? { id, label: id },
      );
  const rest = typed
    ? filtered
    : filtered.filter((option) => !selected.includes(option.id));

  /** Only when what they typed is not already on the list, so the escape never
   *  sits above the very row it duplicates. */
  const custom =
    allowCustomValue &&
    typed.length > 0 &&
    !filtered.some((option) => option.label.toLowerCase() === needle)
      ? typed
      : null;

  const renderRow = (option: PickerOption, icon?: typeof Plus) => (
    <SettingsChoiceRow
      key={option.id}
      name={name}
      control={multiple ? 'checkbox' : 'radio'}
      option={{ value: option.id, label: option.label, icon }}
      selected={current.includes(option.id)}
      onChange={handlePick}
    />
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      size="content"
      /* ONE HEIGHT, WHATEVER THE LIST HOLDS AND WHETHER THE KEYBOARD IS UP.

         The owner, 23 September 2026: "the country modal is very jumpy
         especially when the phone keyboard popsup". A `content` sheet is as
         tall as what is in it, and this one's content is a list that a search
         shrinks from 199 rows to 1. Measured on lawexa.com, the search box
         dropped 115px between typing "g" and "gh"; with a keyboard up the cap
         hid that, and the cap lifted again the moment the keyboard closed.

         So the sheet takes the cap as its height. Its top edge never moves;
         the keyboard only raises its bottom edge, and a short result list
         leaves empty sheet under it rather than a shorter sheet. The desktop
         card gets a fixed height for the same reason. */
      className="h-[calc(100dvh-var(--keyboard-inset,0px)-3rem)] md:h-[min(40rem,calc(100dvh-4rem-var(--keyboard-inset,0px)))]"
      footer={
        /* The pair from `ChoicePanel`, at the same widths, so the three kinds
           of sheet on this page end the same way. */
        <div className="flex gap-2.5">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="flex-1 md:w-auto md:flex-none">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleDone}
            disabled={!changed || busy}
            className="flex-1 md:w-auto md:flex-none"
          >
            {multiple && current.length > 0 ? `Done (${current.length})` : 'Done'}
          </Button>
        </div>
      }
    >
      <div>
        {/* Pinned to the top of the scrolling body, over the rows, so the box
            is still there after scrolling 199 countries. Pulled out to the
            body's edges and given the sheet's own colour so rows pass under
            it rather than showing through.

            `-top-4`, NOT `top-0`, on a phone: Chrome measures a sticky offset
            from inside the scroll body's 16px top padding, so `top-0` held the
            box 16px below where it sits and it covered the top of the first
            row (measured: search box bottom 235, first row top 219). The
            negative offset cancels the padding the `-mt-4` already pulls the
            box over. The desktop body has no top padding, so `top-0` there.

            THE HAIRLINE UNDER IT is where rows go when they scroll. Without
            it a row cut in half by the box read as broken (the owner's
            screenshot, 23 September 2026: "Lawyer" half-hidden). */}
        <div className="sticky -top-4 z-10 -mx-4 -mt-4 border-b border-border bg-popover px-4 pt-4 pb-3 md:top-0 md:-mx-6 md:mt-0 md:px-6 md:pt-1">
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
        </div>

        {/* Skeletons whenever the list is loading, even with an answer to pin:
            a pinned area of expertise is an id until its list arrives, and
            a row reading "14" is worse than a moment of placeholder. */}
        {isLoading ? (
          <div aria-hidden className="flex flex-col gap-1 pt-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-12 w-full rounded-xl"
                style={{ opacity: Math.max(0.25, 1 - index * 0.14) }}
              />
            ))}
          </div>
        ) : pinned.length === 0 && rest.length === 0 && !custom ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          /* A REAL GROUP, for the reason `ChoicePanel` gives: the browser only
             gives radios one tab stop and arrow keys inside one. */
          <fieldset className="-mx-4 md:-mx-6" aria-labelledby={legendId}>
            <legend id={legendId} className="sr-only">
              {title}
            </legend>
            {/* ABOVE the results, not below them. Somebody types their own
                institution precisely because ours does not have it, so the
                answer they want must not sit under near-misses. */}
            {/* "ADD", the owner's own word (23 September 2026: "if it's not
                there then show add"). It adds to this person's answer only;
                the shared list does not change. */}
            {custom ? renderRow({ id: custom, label: `Add “${custom}”` }, Plus) : null}
            {pinned.map((option) => renderRow(option))}
            {pinned.length > 0 && rest.length > 0 ? (
              <div aria-hidden className="mx-4 my-1 h-px bg-border md:mx-6" />
            ) : null}
            {rest.map((option) => renderRow(option))}
          </fieldset>
        )}
      </div>
    </ResponsiveOverlay>
  );
}
