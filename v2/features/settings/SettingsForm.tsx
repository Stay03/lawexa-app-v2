'use client';

import { useId, type ReactNode } from 'react';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SETTINGS_BLOCK } from './SettingsList';

/**
 * settings/SettingsForm: the row grammar of a settings screen you can CHANGE
 * something on, and the only place it is written.
 *
 * ── IT IS THE SAME BLOCK, WITH THE VALUE MADE TYPEABLE ─────────────────────
 * The settings index (`SettingsList.tsx`) draws filled rounded blocks whose
 * rows are an icon, a label, and a quiet value under the label. A row here is
 * exactly that block and exactly that geometry; the only difference is that the
 * quiet line is a control rather than a fact. So the index and the screens
 * behind it read as one surface, and the block itself comes from one constant
 * (`SETTINGS_BLOCK`) rather than a second copy of four utilities.
 *
 * The label and the value swap WEIGHT, and only weight. On the index the label
 * is the thing you are choosing between, so it is the 15px line and the value
 * is quiet under it. In a form the value is the thing you are working on, so
 * the label becomes the quiet 13px line and the control takes the 15px. Nothing
 * else moves: same 56px floor, same 14px gutters, same hairline.
 *
 * ── THE CONTROLS HAVE NO CHROME OF THEIR OWN ───────────────────────────────
 * `components/ui/input` is a bordered pill on a tinted ground, which inside a
 * filled block would draw a box inside a box, twenty times over. So the
 * controls here are bare: no border, no background, no padding of their own.
 * The ROW is the control's box, and it is the row that lights up.
 *
 * That makes the focus indicator this file's problem rather than the input's,
 * and it is solved the way the index solved it: an INSET ring. The block clips
 * to its rounded corners (`overflow-hidden`), so an offset ring on a first or
 * last row would be clipped away, and a focus ring you cannot see is worse than
 * a slightly different one.
 *
 * ── GROUP HEADINGS ARE VISIBLE HERE, AND THEY ARE NOT ON THE INDEX ─────────
 * The index deliberately shows none: nine rows in four blocks, where the gap
 * does the grouping and a heading would only repeat what the rows already say.
 * A form is a different problem. It carries six blocks and up to twenty rows,
 * several of which mean nothing without their group ("Level", "Address"), and
 * the reference the owner sent draws exactly this: ChatGPT's profile screen
 * puts a small quiet heading over each block ("My ChatGPT", "Account"). So the
 * heading is drawn, at 13px, in the muted colour, outside the block.
 */

/** The row box. `has-[:focus-visible]` lights the whole row from whichever
 *  control inside it took focus, which is what makes a bare input legible. */
const FIELD_ROW =
  'flex min-h-14 items-start gap-3.5 px-4 py-2.5 transition-colors duration-150 motion-reduce:transition-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-inset';

const FIELD_ICON = 'mt-[0.6875rem] size-5 shrink-0 text-muted-foreground';

const FIELD_LABEL =
  'block text-[13px] leading-snug font-medium text-muted-foreground';

/**
 * The gutter a message has to clear to sit under the value rather than under
 * the icon: the row's 16px padding, the 20px icon, and the 14px gap.
 */
const MESSAGE_INSET = 'pl-[3.125rem]';

/**
 * A control with no chrome: the row is its box. `min-h-6` keeps an empty field
 * the same height as a filled one, so a block does not change shape as it is
 * filled in.
 */
const BARE_CONTROL =
  'w-full min-w-0 min-h-6 border-0 bg-transparent p-0 text-[15px] leading-snug text-foreground outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * A block of form rows, under its own visible heading.
 *
 * The heading is a real `h2`, tied to the block with `aria-labelledby`, so
 * moving by headings walks the form's structure and a screen reader announces
 * which group a row belongs to.
 */
export function SettingsFormGroup({
  id,
  label,
  description,
  children,
}: {
  /** Stable key, used for the heading's id. Must contain no whitespace. */
  id: string;
  label: string;
  /** One quiet sentence under the heading, where the group needs explaining. */
  description?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `settings-form-${id}`;
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="px-1 text-[13px] leading-snug font-medium text-muted-foreground"
      >
        {label}
      </h2>
      {description ? (
        <p className="px-1 pt-1 text-[13px] leading-snug text-muted-foreground/80">
          {description}
        </p>
      ) : null}
      <ul className={cn(SETTINGS_BLOCK, 'mt-2')}>{children}</ul>
    </section>
  );
}

/** The message under a control: the error when there is one, otherwise the
 *  hint. Never both, because the error is what the reader has to act on. */
function FieldMessage({
  errorId,
  hintId,
  error,
  hint,
}: {
  errorId: string;
  hintId: string;
  error?: string;
  hint?: ReactNode;
}) {
  if (error) {
    return (
      <p
        id={errorId}
        role="alert"
        className="text-[13px] leading-snug text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        {error}
      </p>
    );
  }
  if (!hint) return null;
  return (
    <p id={hintId} className="text-[12px] leading-snug text-muted-foreground">
      {hint}
    </p>
  );
}

/** The id a control should point `aria-describedby` at, or nothing. */
function describedBy(
  errorId: string,
  hintId: string,
  error?: string,
  hint?: ReactNode,
): string | undefined {
  if (error) return errorId;
  return hint ? hintId : undefined;
}

interface FieldBase {
  /** Decorative. The label is the accessible name. */
  icon: LucideIcon;
  label: string;
  error?: string;
  hint?: ReactNode;
}

/**
 * A typed field, one line.
 *
 * `value` is always a string and `onChange` always receives one, so no caller
 * touches an event. A field that holds a number (the call-to-bar year) is still
 * a string here and is parsed at the payload boundary, which is what lets a
 * half-typed year exist without anything crashing.
 */
export function SettingsTextField({
  icon: Icon,
  label,
  value,
  onChange,
  error,
  hint,
  prefix,
  ...input
}: FieldBase & {
  value: string;
  onChange: (value: string) => void;
  /** A fixed glyph before the value, sharing its baseline (the handle's `@`). */
  prefix?: string;
} & Pick<
    React.InputHTMLAttributes<HTMLInputElement>,
    | 'type'
    | 'inputMode'
    | 'placeholder'
    | 'maxLength'
    | 'autoComplete'
    | 'spellCheck'
    | 'min'
    | 'max'
  >) {
  const uid = useId();
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;

  return (
    <li>
      <div className={FIELD_ROW}>
        <Icon aria-hidden className={FIELD_ICON} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <label htmlFor={uid} className={FIELD_LABEL}>
            {label}
          </label>
          <div className="flex min-w-0 items-baseline gap-0.5">
            {prefix ? (
              <span
                aria-hidden
                className="text-[15px] leading-snug text-muted-foreground"
              >
                {prefix}
              </span>
            ) : null}
            <input
              id={uid}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(errorId, hintId, error, hint)}
              className={BARE_CONTROL}
              {...input}
            />
          </div>
          <FieldMessage
            errorId={errorId}
            hintId={hintId}
            error={error}
            hint={hint}
          />
        </div>
      </div>
    </li>
  );
}

/** A typed field that runs to several lines. Never auto-growing: a settings
 *  block that changes height as somebody types is a block that moves the rows
 *  under their own finger. */
export function SettingsTextAreaField({
  icon: Icon,
  label,
  value,
  onChange,
  error,
  hint,
  rows = 3,
  placeholder,
  maxLength,
}: FieldBase & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  const uid = useId();
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;

  return (
    <li>
      <div className={FIELD_ROW}>
        <Icon aria-hidden className={FIELD_ICON} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <label htmlFor={uid} className={FIELD_LABEL}>
            {label}
          </label>
          <textarea
            id={uid}
            rows={rows}
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(errorId, hintId, error, hint)}
            className={cn(BARE_CONTROL, 'resize-none')}
          />
          <FieldMessage
            errorId={errorId}
            hintId={hintId}
            error={error}
            hint={hint}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * A field with a short, fixed set of answers. The trigger is stripped back to
 * the bare control so it sits on the row exactly where a typed value would, and
 * it keeps the select's own chevron because that glyph is what says "this opens
 * a list", which is a different promise from the row's.
 */
export function SettingsSelectField({
  icon: Icon,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  hint,
}: FieldBase & {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder: string;
}) {
  const uid = useId();
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;

  return (
    <li>
      <div className={FIELD_ROW}>
        <Icon aria-hidden className={FIELD_ICON} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <label htmlFor={uid} className={FIELD_LABEL}>
            {label}
          </label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger
              id={uid}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(errorId, hintId, error, hint)}
              className={cn(
                BARE_CONTROL,
                // The row already owns the focus ring, so the trigger's own
                // 3px halo would be a second indicator on the same event.
                'h-auto gap-1.5 rounded-none py-0 text-[15px] focus-visible:ring-0 data-[size=default]:h-auto',
              )}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldMessage
            errorId={errorId}
            hintId={hintId}
            error={error}
            hint={hint}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * A row that OPENS something: a list too long to sit in a select, or a choice
 * that is really several choices (the countries of the world, the areas of law
 * this person practises).
 *
 * IT IS THE ONE ROW SHAPE THAT CARRIES A CHEVRON, and that is deliberate. The
 * index has none because a glyph repeated on every row of a list of links says
 * nothing. Here it says something real: among a screen of rows you type into,
 * these are the ones you tap.
 *
 * The message sits OUTSIDE the button, indented to the value's gutter. A button
 * may only contain phrasing content, so a paragraph inside one is invalid HTML,
 * and a `role="alert"` inside the control that caused the alert is a poor place
 * to put it anyway.
 */
export function SettingsPickerField({
  icon: Icon,
  label,
  value,
  placeholder,
  onOpen,
  error,
  hint,
  disabled,
}: FieldBase & {
  /** What is chosen today, or `null` for nothing yet. */
  value: ReactNode | null;
  placeholder: string;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const uid = useId();
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;

  return (
    <li className="has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-inset">
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-describedby={describedBy(errorId, hintId, error, hint)}
        className={cn(
          'v2-interactive flex min-h-14 w-full items-start gap-3.5 px-4 py-2.5 text-left',
          'transition-colors duration-150 hover:bg-foreground/[0.04] motion-reduce:transition-none',
          'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <Icon aria-hidden className={FIELD_ICON} />
        <span className="min-w-0 flex-1">
          <span className={FIELD_LABEL}>{label}</span>
          {/* Clamped: a picker that holds many answers (fifteen areas of law)
              would otherwise grow the row into a paragraph. */}
          <span
            className={cn(
              'mt-0.5 line-clamp-2 block text-[15px] leading-snug',
              value == null ? 'text-muted-foreground/60' : 'text-foreground',
            )}
          >
            {value ?? placeholder}
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className="mt-[0.6875rem] size-4 shrink-0 text-muted-foreground"
        />
      </button>
      {error || hint ? (
        <div className={cn('pb-2.5 pr-4', MESSAGE_INSET)}>
          <FieldMessage
            errorId={errorId}
            hintId={hintId}
            error={error}
            hint={hint}
          />
        </div>
      ) : null}
    </li>
  );
}

export interface SettingsChoice<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon: LucideIcon;
}

/**
 * A whole BLOCK that is one choice between a handful of things, each of which
 * needs a sentence.
 *
 * ── WHY IT OWNS THE BLOCK INSTEAD OF BEING A ROW ───────────────────────────
 * Radios have to be grouped, and the two honest ways to group them are a
 * `fieldset` with a `legend` or a container carrying `role="radiogroup"`. A
 * `ul` cannot be either without either invalid markup (a `div` child of a list)
 * or list items sitting inside a radiogroup, which is a list with no list. So
 * the choice draws its own block, with the legend where every other block puts
 * its heading. It reads identically and it is correct.
 *
 * They are REAL RADIO INPUTS, visually hidden inside their rows. That is not a
 * detail: a group of radios gets arrow-key navigation, a single tab stop and
 * its group name announced, all from the browser, where a set of buttons
 * wearing `role="radio"` would need every one of those written by hand and
 * would be subtly wrong until it was.
 */
export function SettingsChoiceGroup<T extends string>({
  name,
  legend,
  description,
  value,
  options,
  onChange,
}: {
  /** The radio group's form name. Must be unique on the screen. */
  name: string;
  legend: string;
  description?: ReactNode;
  value: T | '';
  options: readonly SettingsChoice<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="px-1 text-[13px] leading-snug font-medium text-muted-foreground">
        {legend}
      </legend>
      {description ? (
        <p className="px-1 pt-1 text-[13px] leading-snug text-muted-foreground/80">
          {description}
        </p>
      ) : null}
      <div className={cn(SETTINGS_BLOCK, 'mt-2')}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                'v2-interactive flex min-h-14 cursor-pointer items-start gap-3.5 px-4 py-2.5',
                'transition-colors duration-150 hover:bg-foreground/[0.04] motion-reduce:transition-none',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-inset',
                selected && 'bg-foreground/[0.03]',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <option.icon
                aria-hidden
                className={cn(
                  'mt-0.5 size-5 shrink-0 transition-colors duration-150 motion-reduce:transition-none',
                  selected ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug font-medium text-foreground">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="block text-[13px] leading-snug text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </span>
              <Check
                aria-hidden
                className={cn(
                  'mt-0.5 size-4 shrink-0 text-primary transition-opacity duration-150 motion-reduce:transition-none',
                  selected ? 'opacity-100' : 'opacity-0',
                )}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
