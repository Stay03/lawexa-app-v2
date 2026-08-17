'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { FieldMessage, describedBy } from '../SettingsForm';
import type { ProfileTextFieldSpec } from './text-fields';

/**
 * FieldPanel: one field, on its own, over the list it came from.
 *
 * ── WHY EDITING LEFT THE PAGE ──────────────────────────────────────────────
 * The owner, 16 August 2026, on the phone build: "when I click on a text field
 * to edit on mobile I see it wants me to edit it on the page. I prefer it pops
 * up something with the input field and save. I think it's cleaner on mobile
 * that way." Both apps he sent do exactly that, and so does every phone
 * settings screen worth copying. It is not only taste: a caret dropped into a
 * 15px line halfway down a twenty-row form puts the keyboard over the rows
 * either side of it, and the reader edits a value they can no longer see in
 * context.
 *
 * So the row states the value and this states the question. `ResponsiveOverlay`
 * gives the shape for nothing: a full screen on a phone, the familiar centred
 * card from `md:`, hardware Back and the edge swipe already closing it, and a
 * footer that rides above the on-screen keyboard on both platforms. It is the
 * same element the country and expertise pickers on this screen already open,
 * so a typed field and a chosen one now arrive the same way.
 *
 * ── ITS BUTTON SAYS "DONE", AND THAT IS THE WHOLE POINT ────────────────────
 * Nothing here writes to the server. The panel hands its value back to the
 * form, the row redraws, and the screen's own Save still sends ONE diff of
 * everything that changed. That keeps a single definition of saved: the
 * sticky bar at the foot of the screen, disabled until the record would
 * actually change, saying "Unsaved changes" until it does.
 *
 * A second button labelled Save that does not save would be the confusion this
 * shape was meant to remove, so it is labelled the way the expertise picker
 * next door is already labelled. It is disabled until the box holds something
 * different from the row, for the same reason the screen's Save is.
 *
 * ── ONE PANEL SERVES SIXTEEN ROWS ──────────────────────────────────────────
 * `ResponsiveOverlay` must stay mounted while closed or it cannot play its
 * exit, so there is one instance and the caller says which field it is holding.
 * The draft is therefore cleared as the panel CLOSES, in the event rather than
 * in an effect, which is the same trick `OptionPicker` uses on its search box:
 * a `null` draft means "not touched since this opened", so the next open reads
 * the row's own value with nothing to re-seed and no effect to run.
 *
 * The caller keeps the field name across the close for the same reason. A panel
 * whose title emptied the moment it was dismissed would spend its exit
 * animation as a blank screen.
 *
 * ── NOTHING IS FOCUSED ON A PHONE, DELIBERATELY ────────────────────────────
 * That is `ResponsiveOverlay`'s rule, not this file's, and it is not worked
 * around here: a form screen that grabs focus on a phone announces the way out
 * before the thing itself. The reader taps the one control on the screen. From
 * `md:` up Radix's own behaviour stands and the control is focused on open,
 * because it is the first focusable element in the card.
 */
export function FieldPanel({
  open,
  onOpenChange,
  spec,
  value,
  error,
  validate,
  onCommit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How the field is presented. `null` only before anything has been opened. */
  spec: ProfileTextFieldSpec | null;
  /** What the row holds now, which is what the panel opens on. */
  value: string;
  /** Whatever the screen is currently saying about this field, usually a 422. */
  error?: string;
  /** The form's own rules, run on the candidate. The message, or nothing. */
  validate: (candidate: string) => string | undefined;
  /** Hand the value back to the form. Never a write. */
  onCommit: (next: string) => void;
}) {
  const uid = useId();
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;

  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState<string>();

  const current = draft ?? value;
  const touched = draft !== null;
  const changed = touched && draft !== value;

  /**
   * What the panel says under the control. The screen's message is shown until
   * the reader touches the field, because after that it is about a value that
   * no longer exists; from then on the only message is this panel's own.
   */
  const message = refused ?? (touched ? undefined : error);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDraft(null);
      setRefused(undefined);
    }
    onOpenChange(next);
  };

  const handleChange = (next: string) => {
    setDraft(spec?.transform ? spec.transform(next) : next);
    setRefused(undefined);
  };

  const handleDone = () => {
    if (!changed) return;
    const refusal = validate(current);
    if (refusal) {
      setRefused(refusal);
      return;
    }
    onCommit(current);
    handleOpenChange(false);
  };

  const control = spec ? (
    spec.multiline ? (
      <Textarea
        id={uid}
        value={current}
        onChange={(event) => handleChange(event.target.value)}
        aria-label={spec.label}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy(errorId, hintId, message, spec.hint)}
        placeholder={spec.placeholder}
        maxLength={spec.maxLength}
        className="min-h-32"
      />
    ) : (
      <div className="relative">
        {spec.prefix ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted-foreground md:text-sm"
          >
            {spec.prefix}
          </span>
        ) : null}
        <Input
          id={uid}
          type={spec.type ?? 'text'}
          value={current}
          onChange={(event) => handleChange(event.target.value)}
          /* Enter is the way a keyboard finishes a one-line field. The form it
             belongs to is elsewhere in the React tree but not in this DOM (the
             overlay is portalled), so no native submit is being intercepted
             here: without this, Enter would do nothing at all. `isComposing`
             keeps it clear of the Enter that closes an input method's own
             candidate list. */
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            handleDone();
          }}
          aria-label={spec.label}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy(errorId, hintId, message, spec.hint)}
          placeholder={spec.placeholder}
          maxLength={spec.maxLength}
          inputMode={spec.inputMode}
          autoComplete={spec.autoComplete}
          spellCheck={spec.spellCheck}
          /* 44px on a phone, the house floor for something a thumb lands on,
             and back to the input's own height where a pointer is. */
          className={cn('h-11 md:h-9', spec.prefix && 'pl-7')}
        />
      </div>
    )
  ) : null;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={spec?.label ?? ''}
      footer={
        <Button type="button" onClick={handleDone} disabled={!changed}>
          Done
        </Button>
      }
    >
      <div className="space-y-2">
        {control}
        <FieldMessage
          errorId={errorId}
          hintId={hintId}
          error={message}
          hint={spec?.hint}
        />
      </div>
    </ResponsiveOverlay>
  );
}
