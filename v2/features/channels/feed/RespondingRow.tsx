'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { Eye, EyeOff, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { RespondingTurn } from '../lawexa/turns';

/**
 * RespondingRow — "Lawexa is responding", plus the optional live glance.
 * Phase-5 W3; a redesign of v1's `LawexaRespondingRow` onto the v2 feed
 * (study A9: KEEP the affordance, FIX the matching, REDESIGN the glance onto
 * the v2 engine). Sources: plan W3 items 5–6, api-digest §B/§F.6/§F.7 —
 * 2026-08-04.
 *
 * WHERE IT SITS. Anchored directly under the message that summoned Lawexa
 * whenever the event named it, so two people asking at once each watch their
 * OWN question think. When the event omits `message_uuid` (the §F.7
 * contradiction), the feed renders the same row at the foot of the transcript
 * instead — a designed fallback, not a broken anchor.
 *
 * IT IS PART OF THE MESSAGE ABOVE IT, AND THE GEOMETRY SAYS SO. The left
 * indent is the feed's content column exactly ({@link CONTENT_INDENT}: the
 * article's `px-1` + a `size-8` avatar + the `gap-3` gutter), so the row's text
 * starts on the same vertical line as the message it belongs to; and an
 * ANCHORED row cancels most of the transcript's 16px item gap so it reads as
 * attached rather than as a block of its own. A FLOATING row keeps the full
 * gap — it belongs to the channel, not to whatever message happens to be last.
 *
 * WHAT IT PROMISES. Only that something is happening, and only for as long as
 * that is true. It is not a progress bar (there is no progress to report), it
 * takes no vertical room it doesn't need, and it NEVER moves the viewport — a
 * row appearing under a message the reader is looking at must not push the
 * conversation around them.
 *
 * NO LIVE REGION HERE (audit L7). The row already renders INSIDE the feed's
 * `role="log"`, which IS a polite live region: assistive tech announces
 * additions to it on its own. Nesting a `role="status"` inside would either
 * double-announce or compete with the log for the same text — and this row's
 * text never changes once it is up, so a second region has nothing to add.
 *
 * THE GLANCE IS OPT-IN AND LAZY. Watching loads the whole streaming engine, so
 * the panel is a `dynamic()` import with `ssr: false` — a channel that nobody
 * watches never pays for it. Reading the turn live is a nice-to-have: the
 * authoritative reply still arrives as an ordinary message either way, which is
 * exactly why the panel is allowed to be best-effort and disposable.
 */

// Only pulled in when a reader actually clicks Watch (v1's rule, kept — this
// is the single heaviest thing the channel screen can mount).
const LawexaGlancePanel = dynamic(
  () => import('./LawexaGlancePanel').then((module) => module.LawexaGlancePanel),
  { ssr: false },
);

/** The feed's content column: `MessageGroupRow`'s `px-1` article padding (4px)
 *  + a `size-8` avatar (32px) + its `gap-3` gutter (12px) = 48px. Named once so
 *  the two geometries cannot drift apart silently. */
const CONTENT_INDENT = 'pl-12';

export function RespondingRow({
  turn,
  watching,
  attached = false,
  onToggleWatch,
}: {
  turn: RespondingTurn;
  watching: boolean;
  /** True when the row sits directly under its summoning message. */
  attached?: boolean;
  onToggleWatch: (executionId: string) => void;
}) {
  const ToggleIcon = watching ? EyeOff : Eye;
  const toggleRef = useRef<HTMLButtonElement>(null);

  /** Closing from the PANEL's own X would otherwise drop focus onto `<body>`
   *  and lose the reader's place in the transcript. The control that opened the
   *  panel is the right place to land, and it is still on screen (audit M4). */
  const stopWatching = () => {
    onToggleWatch(turn.executionId);
    toggleRef.current?.focus();
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        CONTENT_INDENT,
        // Attached: swallow most of the transcript's `gap-4` so the row hangs
        // off the message above instead of floating between two of them.
        attached && '-mt-3',
        // Symmetric, ≤200ms, motion-reduce honoured (house rule): the row
        // fades and rises a hair instead of snapping into the transcript.
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200',
      )}
    >
      <div className="flex min-h-6 items-center gap-2 text-xs">
        <Sparkles
          aria-hidden
          className="size-3.5 shrink-0 text-primary motion-safe:animate-pulse"
        />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          Lawexa is responding to{' '}
          <span className="font-medium text-foreground">{turn.summoner.name}</span>
          &hellip;
        </span>
        <button
          ref={toggleRef}
          type="button"
          onClick={() => onToggleWatch(turn.executionId)}
          aria-expanded={watching}
          className={cn(
            'v2-interactive inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full border px-2',
            'text-[11px] font-medium transition-colors duration-150 motion-reduce:transition-none',
            watching
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <ToggleIcon aria-hidden className="size-3" />
          {watching ? 'Hide' : 'Watch'}
        </button>
      </div>

      {watching && (
        <LawexaGlancePanel
          key={turn.executionId}
          executionId={turn.executionId}
          summonerName={turn.summoner.name}
          onClose={stopWatching}
        />
      )}
    </div>
  );
}
