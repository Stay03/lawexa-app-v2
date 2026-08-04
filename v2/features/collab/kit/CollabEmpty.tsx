import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * CollabEmpty — the half of the old one-size `CollabMessage` that means
 * "nothing here YET". It is the half that must teach and act (DIRECTION 13,
 * NN/g): say what this surface is for, show one primary way to fill it, and
 * never read as a failure.
 *
 * ── WHY THE SPLIT ──────────────────────────────────────────────────────────
 * `CollabMessage` rendered "you have no spaces yet" and "the network died" as
 * the same centred panel with the same geometry, so the two states the reader
 * must tell apart fastest looked identical. Emptiness is a beginning and gets
 * the room; failure is an interruption and gets a strip
 * ({@link import('./CollabFailure').CollabFailure}). `CollabMessage` stays in
 * service for the access doors and refusals, which are neither.
 *
 * ── THE GHOST ──────────────────────────────────────────────────────────────
 * `ghost` renders a quiet, non-interactive impression of the POPULATED surface
 * above the copy, fading out into it. An empty state that only describes the
 * thing asks the reader to imagine it; one that shows the shape they are about
 * to make answers "what will this look like" before the question is asked. It
 * is `aria-hidden` and `inert`: it is a picture of data, not data, and nothing
 * inside it may take focus or be announced as real content.
 *
 * ── MOTION ─────────────────────────────────────────────────────────────────
 * A 150ms fade, inside DIRECTION 11's ≤200ms band. Like `CollabFailure` this
 * is a STATE PANEL in a three-state region: it is replaced by content rather
 * than hidden, so there is no "hide" direction for the entrance to mirror.
 */

/** The fade that dissolves the ghost into the copy beneath it. Written as a
 *  style rather than a utility because both the standard and the WebKit
 *  property have to be set, and only one of them has a Tailwind class. */
const GHOST_FADE: CSSProperties = {
  maskImage: 'linear-gradient(to bottom, rgb(0 0 0) 0%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, rgb(0 0 0) 0%, transparent 100%)',
};

const TONE_TILE = {
  neutral: 'bg-secondary text-muted-foreground',
  accent: 'bg-primary/10 text-primary',
} as const;

type CollabEmptyTone = keyof typeof TONE_TILE;

export function CollabEmpty({
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  ghost,
  action,
  footnote,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: CollabEmptyTone;
  /** A silent impression of the populated surface — rows, lanes, a card. */
  ghost?: ReactNode;
  /** The way forward. Every empty state that can offer one, does. */
  action?: ReactNode;
  /** A quieter second line under the action. A NODE, not a string: a footnote
   *  that names a control must be able to BE that control, or it points at
   *  something the reader cannot reach. */
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center px-6 pb-12 text-center',
        ghost ? 'pt-2' : 'pt-10',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150',
        className,
      )}
    >
      {ghost ? (
        <div
          aria-hidden
          inert
          style={GHOST_FADE}
          className="pointer-events-none mb-2 w-full max-w-md select-none opacity-50"
        >
          {ghost}
        </div>
      ) : null}

      <span
        aria-hidden
        className={cn(
          'flex size-12 items-center justify-center rounded-2xl',
          TONE_TILE[tone],
        )}
      >
        <Icon className="size-6" />
      </span>

      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {action ? <div className="mt-4">{action}</div> : null}
      {footnote ? (
        <div className="mt-3 max-w-sm text-xs text-muted-foreground">{footnote}</div>
      ) : null}
    </div>
  );
}
