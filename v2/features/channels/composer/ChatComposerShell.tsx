'use client';

import { type ReactNode } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

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
 */

export function ChatComposerShell({
  typing,
  tray,
  children,
}: {
  /** The typing whisper. `label` must be HELD through `visible: false`. */
  typing?: { label: string; visible: boolean };
  /** Staging rows above the surface — reply quote, notices, uploads. */
  tray?: ReactNode;
  /** The inner row: attach · mention · emoji · textarea · send. */
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

          <div className="flex items-end gap-1 p-1.5">{children}</div>
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
 * A tray notice — one sentence, one optional way forward, one dismissal. Used
 * by the Lawexa-blocked reason (private to the summoner, §F.12 — an inline
 * line, never a toast, never a feed row) and by the attachment outcome.
 *
 * THE TINT NEVER TOUCHES THE SENTENCE, the same rule `CollabFailure` states:
 * the tone colours the glyph and the border, the words stay on
 * `text-foreground`, because muted-red body text does not clear 4.5:1.
 */
export function ComposerNotice({
  tone,
  text,
  action,
  onDismiss,
}: {
  tone: 'failure' | 'done';
  text: ReactNode;
  /** A single trailing control — "Files" after an upload lands, say. */
  action?: ReactNode;
  onDismiss: () => void;
}) {
  const failed = tone === 'failure';
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border bg-background px-3 py-2 text-xs',
        failed ? 'border-destructive/30' : 'border-border',
      )}
    >
      {failed ? (
        <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      ) : (
        <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
      )}
      <p className="min-w-0 flex-1 text-foreground">{text}</p>
      {action}
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

