'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { SettingsChoiceRow, type SettingsChoice } from './SettingsForm';

/**
 * settings/ChoicePanel: a handful of answers, offered in a sheet the row opens.
 *
 * The owner, 19 September 2026: "the account type should be like the samsung
 * screenshot its shows the setting then when you touch it, it then shows the
 * modal with the option like in the screenshot and thats how it gets saved
 * instead of selection one from the page and clicking save changes at the
 * bottom".
 *
 * ── THE TAP CHOOSES, THE BUTTON KEEPS ──────────────────────────────────────
 * It was built the other way first, with a tap writing straight away, and that
 * was wrong for two reasons that only showed up when they were measured.
 *
 * His reference has a button. The Samsung sheet in the picture he sent is a
 * radio list, a helper line, and an OK centred under them. Tapping a row there
 * chooses; OK keeps. The sentence he wrote, "instead of selection one from the
 * page and clicking save changes at the bottom", is about the PAGE'S button at
 * the bottom of the screen, which is what the row replaces. It was never about
 * the button inside the sheet.
 *
 * And a pick here is destructive. Changing an account type clears the answers
 * the new type does not ask for, which for a lawyer moving to law student is
 * five of them, including a call number the app cannot get back. Until tonight
 * the page's Save button was the step at which somebody could decline that.
 * Writing on the tap would have removed the only such step, and the sheet would
 * already be closed by the time the loss was visible.
 *
 * ── THE PAIR IS THE ONE HE PICKED, NOT A LONE OK ───────────────────────────
 * Samsung draws a single centred OK. This draws the Cancel and Done he chose
 * from filmed options two hours before this sheet existed, at the same sizes
 * and the same weights, because a second footer shape one screen later undoes
 * that choice. OK and Done say the same thing, and Cancel earns its place here
 * more than it does on a text field: it is the way back after you have tapped a
 * row and seen what it would cost.
 *
 * ── THE ROWS ARE THE PAGE'S ROWS ───────────────────────────────────────────
 * `SettingsChoiceRow` is shared with `SettingsChoiceGroup`, which drew these
 * same answers down the page until tonight. Its selected treatment was filmed
 * on the owner's phone and tuned twice, so the sheet inherits it rather than
 * restating it in slightly different utilities.
 */
export function ChoicePanel<T extends string>({
  open,
  onOpenChange,
  title,
  description,
  name,
  value,
  options,
  onChoose,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The radio group's form name. Must be unique on the screen. */
  name: string;
  value: T | '';
  options: readonly SettingsChoice<T>[];
  /** The answer, once, when Done is pressed. The caller writes it. */
  onChoose: (value: T) => void;
  /** A write is in flight, so Done must not start a second one. */
  busy?: boolean;
}) {
  const legendId = useId();

  /* `null` is UNTOUCHED rather than "nothing chosen", exactly as `FieldPanel`
     holds its draft: the sheet shows the stored answer until a row is tapped,
     and the draft is dropped in the close handler rather than in an effect. */
  const [draft, setDraft] = useState<T | null>(null);
  const current = draft ?? value;
  const changed = draft !== null && draft !== value;

  const handleOpenChange = (next: boolean) => {
    if (!next) setDraft(null);
    onOpenChange(next);
  };

  const handleDone = () => {
    if (!changed || draft === null) return;
    onChoose(draft);
    handleOpenChange(false);
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      size="content"
      footer={
        /* The same two buttons, in the same order, at the same widths as the
           pair on `FieldPanel`. `flex-1` splits a phone's width evenly and
           `md:flex-none` lets the desktop footer right-align them at their
           natural size. */
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
            Done
          </Button>
        </div>
      }
    >
      {/* A REAL GROUP, even though the dialog title already names the sheet.
          The radios need one to get arrow-key navigation and a single tab stop
          from the browser, and the legend is the group's name in the
          accessibility tree rather than a second heading on screen, so it is
          hidden and the visible title carries the same words.

          Pulled out to the sheet's own edges against the body padding, so a
          row's tint and hover reach the sides the way they do inside a settings
          block. Each row keeps its own `px-4`, so the text stays inset. */}
      <fieldset className="-mx-4 md:-mx-6" aria-labelledby={legendId}>
        <legend id={legendId} className="sr-only">
          {title}
        </legend>
        {options.map((option) => (
          <SettingsChoiceRow
            key={option.value}
            name={name}
            option={option}
            selected={current === option.value}
            onChange={setDraft}
          />
        ))}
      </fieldset>
    </ResponsiveOverlay>
  );
}
