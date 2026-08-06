'use client';

import { type ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * ChatComposerShell — the surface a message is written on, at the width of the
 * transcript it joins. Phase-5 redesign wave, W2 (2026-08-05).
 *
 * ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 * The shipped composer was `max-w-xs` / `sm:max-w-md` — 320px, then 448px —
 * floating under a 768px transcript: literally the AI-chat pill rescaled, down
 * to the round accent `AtSign` on the left and the round `ArrowUp` on the
 * right. It read as a widget the channel was hosting rather than the channel's
 * own composer, it had no attachment affordance at all despite a whole Files
 * section, and the typing whisper sat centred under the MIDDLE of the page,
 * lined up with nothing.
 *
 * ── THE COLUMN IS THE CONTRACT ─────────────────────────────────────────────
 * Same `max-w-3xl`, same `px-4` as the transcript, so the composer sits on the
 * conversation's axis. It floats (the feed positions this in its bottom
 * overlay and reserves clearance via a measured `--v2-chan-dock-h`), so the
 * surface keeps its own edge, blur and shadow — it is ON the transcript, not
 * a bar under it.
 *
 * ── THE TYPING LINE IS A LEGEND ON THE TOP EDGE ────────────────────────────
 * Not a row above the shell (which would either cost permanent height or shift
 * the composer as people start and stop typing) and not centred under the page
 * (which is what it was). It is absolutely positioned across the shell's top
 * border, left-aligned to the column, and it fades. It therefore costs ZERO
 * height, can never move the composer, and is unmistakably about this box.
 * Its label is HELD by the caller through the fade-out, so it never empties
 * mid-transition. No live region: typing is presence noise, and announcing
 * every change would spam a screen reader (W2 audit L12).
 *
 * ── ONE COLLAPSE IDIOM FOR THE WHOLE TRAY ──────────────────────────────────
 * {@link ComposerTrayRow} is `EnablePushNudge`'s symmetric grid-rows reveal,
 * reused rather than re-invented (the protect list's instruction), so the reply
 * quote, the Lawexa-blocked notice and the upload notice all open and close the
 * same way and all occupy exactly zero height — inert and `aria-hidden` — when
 * they have nothing to say.
 *
 * ── THE INPUT ROW HAS TWO ARRANGEMENTS (owner, 2026-08-06) ─────────────────
 * One line is one row, exactly as it always was: `[attach @ emoji] [input]
 * [send]`, compact. Past that, the buttons were holding two tall empty columns
 * either side of a message squeezed into half the phone's width — the longer
 * the message, the narrower the column it was written in, which is backwards.
 * So once the text passes about two lines the input takes the FULL width and
 * the buttons drop to a slim row beneath it, Send on the right.
 *
 * IT IS ONE SET OF NODES IN ONE CONTAINER, RE-FLOWED — never two arrangements
 * rendered conditionally. Moving a control between two parents remounts it, and
 * remounting these particular controls closes the emoji popover mid-pick and
 * drops focus off whatever the reader was on. Here the input simply takes a
 * `basis-full` first line and the rest of the row wraps under it, so React
 * re-renders nothing at all when the arrangement changes.
 *
 * WHICH IS WHY THE SWITCH IS DRIVEN BY A `data-expanded` ATTRIBUTE the composer
 * WRITES, not by state. The composer already measures this input in a DOM
 * effect to auto-grow it; the arrangement is the second answer that measurement
 * produces, and routing it through React state would cost a render of the whole
 * composer on a threshold the reader crosses while typing. The attribute is
 * rendered once as `false` and never named again in JSX, so React has nothing
 * to patch and the composer's write stands.
 *
 * AND IT IS INSTANT ON PURPOSE. A wrap is not a tweenable property — no
 * interpolation exists between "beside" and "under" — so the only honest
 * options were a fake (cross-fading a duplicate set of controls) or nothing.
 * The house rule settles it: a half-animated reflow is worse than an instant
 * one. It also matches what the change MEANS, since it happens in the same beat
 * as the box growing a line: the box made room.
 *
 * ── THE DOM ORDER IS THE INPUT FIRST, AND `order` MOVES THE COMPACT ROW ────
 * It was the other way round — `[actions, input, trailing]` in the DOM, with the
 * input pulled to the front by `order-first` when expanded — and that costs
 * something after all, which the paragraph above used to deny. Expanded, the
 * three quiet verbs sit visually BELOW the input while coming BEFORE it in the
 * DOM, so Tab from the message dropped down a row to attach · mention · emoji
 * and then climbed back up: focus order out of step with the visual order, WCAG
 * 2.4.3.
 *
 * So the DOM is `[input, actions, trailing]` — write the message, decorate it,
 * send it — which is a meaningful sequence in BOTH arrangements, and the one the
 * expanded layout also draws top to bottom. The compact row is the one that gets
 * an `order`: the verbs move to the left of the input, where a chat composer
 * puts them, while Tab still reaches the input first. That is the only ordering
 * either arrangement can be given without moving a node between parents, which
 * would remount the emoji popover mid-pick.
 *
 * ── THE ROW HAS ONE INSET, AND NO ROW GAP (owner, 2026-08-06) ──────────────
 * "The long text in that text area is not done well." The arrangement worked;
 * the block it drew was ragged down the left and loose down the middle, and both
 * were measurable rather than matters of taste.
 *
 * THE INSET IS `p-1.5` PLUS THE GLYPH'S OWN 8px, WHICH IS 14. Every icon on this
 * surface is a `size-4` glyph centred in a `size-8` control, so it lands 14px
 * from the edge — on the left (paperclip) and on the right (Send) alike. The
 * input's `px-1` put the WORDS at 10px, four pixels adrift of the verbs directly
 * beneath them. It is the input that moved (`px-2`, in `ChannelComposer`),
 * because 14 was already this surface's inset everywhere else; changing the row's
 * padding to meet 10 would have made the compact row taller, which is the height
 * this whole change exists to give back.
 *
 * AND THE ROW GAP IS ZERO BECAUSE THE CONTROLS BRING THEIR OWN. A `size-8`
 * control carries 8px of air around its glyph on every side. Adding 6px of
 * `gap-y` on top of the input's own 6px of `py` opened a 12px band between the
 * last line of text and the top of a box whose ink starts 8px lower still — a
 * gap half again as big as the 14px under the verbs, which is exactly the dead
 * band that read as unfinished. At zero the two bands are both 14px and the
 * expanded surface loses 6px of height on a phone with the keyboard up.
 */

export function ChatComposerShell({
  typing,
  tray,
  actions,
  trailing,
  rowRef,
  children,
}: {
  /** The typing whisper. `label` must be HELD through `visible: false`. */
  typing?: { label: string; visible: boolean };
  /** Staging rows above the surface — reply quote, notices, uploads. */
  tray?: ReactNode;
  /** The quiet verbs: attach · mention · emoji. Beside the input on one line,
   *  under it once it grows. */
  actions: ReactNode;
  /** The emphasised end: the remaining-characters counter and Send. */
  trailing: ReactNode;
  /** The measured row — the composer writes `data-expanded` on this node. */
  rowRef: React.Ref<HTMLDivElement>;
  /** The input itself. Sized by its wrapper, so it wants `w-full`, not `flex-1`. */
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-3">
      <div className="relative">
        {tray}

        <div className="relative rounded-2xl border bg-background/95 shadow-lg backdrop-blur">
          {typing && (
            <span
              className={cn(
                'pointer-events-none absolute -top-2 left-3 max-w-[calc(100%-1.5rem)] truncate',
                'rounded bg-background px-1.5 text-[11px] leading-4 text-muted-foreground',
                'transition-opacity duration-200 motion-reduce:transition-none',
                typing.visible ? 'opacity-100' : 'opacity-0',
              )}
            >
              {typing.label}
            </span>
          )}

          <div
            ref={rowRef}
            data-expanded="false"
            className={cn(
              'group/composer flex items-end gap-1 p-1.5',
              'data-[expanded=true]:flex-wrap data-[expanded=true]:gap-y-0',
            )}
          >
            {/* First in the DOM, and first in the tab order, in both
                arrangements. `basis-full` is what makes it take the whole line
                when expanded; the rest of the row then wraps beneath it. */}
            <div
              className={cn(
                'min-w-0 flex-1',
                'group-data-[expanded=true]/composer:basis-full',
              )}
            >
              {children}
            </div>

            {/* Visually to the LEFT of the input while the row is one line —
                the only thing `order` is used for, and only here. */}
            <div
              className={cn(
                'flex shrink-0 items-center gap-1',
                'group-data-[expanded=false]/composer:order-first',
              )}
            >
              {actions}
            </div>

            <div
              className={cn(
                'flex shrink-0 items-center gap-1',
                'group-data-[expanded=true]/composer:ml-auto',
              )}
            >
              {trailing}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One staging row: zero height and out of the a11y tree when closed. */
export function ComposerTrayRow({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out',
        'motion-reduce:transition-none',
        open ? 'mb-2 grid-rows-[1fr] opacity-100' : 'mb-0 grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * A tray notice — one sentence and one dismissal. Used by the Lawexa-blocked
 * reason (private to the summoner, §F.12 — an inline line, never a toast,
 * never a feed row) and by a REFUSED send: an unsupported file, one over the
 * cap, an upload that failed, or Enter pressed while bytes are still moving.
 *
 * IT ONLY EVER REPORTS A REFUSAL. It used to take a `tone`, with a second
 * `done` face that confirmed an upload had landed in the Files section. Since
 * attachments actually attach (2026-08-05) a successful upload is a CHIP in the
 * staging tray, and the tray's own line carries the Files link — so nothing has
 * called for the confirming face since, and a branch no caller can reach is a
 * second design nobody is maintaining. There is one face, and it is the one
 * that says no.
 *
 * THE TINT NEVER TOUCHES THE SENTENCE, the same rule `CollabFailure` states:
 * the alarm colours the glyph and the border, the words stay on
 * `text-foreground`, because muted-red body text does not clear 4.5:1.
 */
export function ComposerNotice({
  text,
  onDismiss,
}: {
  text: ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-background px-3 py-2 text-xs">
      <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      <p className="min-w-0 flex-1 text-foreground">{text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={cn(
          'shrink-0 rounded text-muted-foreground hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * One control in the composer's inner row.
 *
 * NOT ROUND, AND NOT ACCENTED. The round gold pill was the AI composer's
 * signature borrowed wholesale; here the verbs are quiet squares of equal
 * weight so the only emphasised thing on the surface is Send.
 */
export const COMPOSER_ACTION = cn(
  'v2-interactive flex size-8 shrink-0 items-center justify-center rounded-lg',
  'text-muted-foreground transition-colors duration-150 motion-reduce:transition-none',
  'hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary',
  'data-[state=open]:text-foreground',
  FOCUS_RING,
);

export function ComposerAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={COMPOSER_ACTION}
    >
      {children}
    </button>
  );
}

