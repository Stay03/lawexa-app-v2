import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * FeedDivider — the transcript's non-message lines, WITH A HIERARCHY. Phase-5
 * redesign wave, W2 (2026-08-05); replaces `separators.tsx`.
 *
 * ── THE DEFECT THIS FIXES ──────────────────────────────────────────────────
 * The shipped day separator and unread divider were the SAME object: a
 * bordered pill on a full-width rule, differing only in a word and a hue. So
 * the single most important line in a channel — "everything below this you
 * have not read" — was drawn as a sibling of "Tuesday", and readers scrolling
 * a busy day met four identical pills and had to read each one to find the one
 * that mattered.
 *
 * ── SO ONE RECEDES AND ONE ARRIVES ─────────────────────────────────────────
 *  - `day` is a quiet uppercase label and nothing else: no pill, no rule, no
 *    border. It is a signpost you consult, not an event.
 *  - `unread` keeps the whole width: a gold hairline running the column with
 *    "New" at the head of it and the way to clear it at the tail. It is the
 *    only line in the transcript that spans edge to edge, which is what makes
 *    it findable at a glance instead of by reading.
 *
 * GOLD STILL MEANS UNREAD AND NOTHING ELSE. The day label is `text-muted-
 * foreground`; the Lawexa session boundary draws nothing at all (it is dropped
 * in `feed-model.ts` precisely because its old gold pill was mistaken for this
 * line). One accent, one meaning.
 *
 * ── "MARK AS READ" IS A DISMISSAL, WHICH `Esc` IS NOT ──────────────────────
 * Until now the only way to clear unread here was the `Esc` key, undiscoverable
 * and unmentioned. `Esc` advances the read pointer and deliberately LEAVES the
 * line standing (§5: the line persists for the view session, because a reader
 * may be using it as a bookmark). This button is the explicit version of the
 * intent: it advances the pointer AND takes the line away, because a control
 * that says "mark as read" and leaves a "New" line on screen has not done what
 * it said.
 *
 * ── WHICH IS WHY THE UNREAD LINE IS NOT A `separator` ──────────────────────
 * `role="separator"` without a tabindex is in ARIA's presentational-children
 * list: the accessibility tree keeps the separator and DISCARDS everything
 * inside it. That was harmless while both lines were pure decoration with an
 * `aria-label`, and it silently deletes a button. So the unread line is a
 * `role="group"` — not on the list — which keeps its own name AND exposes the
 * control inside it. `DayDivider`, which has no interactive child, stays a
 * separator: it IS one, and its `aria-label` survives the stripping intact.
 *
 * Presentational — the feed owns placement, keys and the read pointer.
 * `data-unread-divider` is the feed's land-at-line anchor and must not move.
 */

/** A day's signpost. Recessive by design — see the docblock. */
export function DayDivider({ label }: { label: string }) {
  return (
    <div role="separator" aria-label={label} className="flex justify-center py-1">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

/** The unread line. `onMarkRead` is omitted where there is no pointer to move. */
export function UnreadDivider({ onMarkRead }: { onMarkRead?: () => void }) {
  return (
    <div
      data-unread-divider
      role="group"
      aria-label="New messages"
      className="flex items-center gap-2 py-1"
    >
      {/* `aria-hidden` because the group's own name already says it — without
          that the line would announce "New messages, group. New." */}
      <span
        aria-hidden
        className="shrink-0 text-[11px] font-semibold tracking-wide text-primary uppercase"
      >
        New
      </span>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-primary/60" />
      {onMarkRead && (
        <button
          type="button"
          onClick={onMarkRead}
          className={cn(
            'v2-interactive shrink-0 rounded px-1 text-[11px] font-medium text-muted-foreground',
            'transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
            FOCUS_RING,
          )}
        >
          Mark as read
        </button>
      )}
    </div>
  );
}
