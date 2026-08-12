import { GitBranch, LogOut, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Message } from '@/types/collab';
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

/**
 * QuietSystemLine — the lines the server writes itself: somebody joined, left
 * or was removed, and a conversation branching into a thread.
 *
 * ── RECESSIVE, LIKE THE DAY LABEL, AND FOR THE SAME REASON ─────────────────
 * These are furniture. A join is not something a reader comes back for, so this
 * borrows `DayDivider`'s grammar — centred, small, muted, no pill, no rule —
 * rather than the unread line's. Gold still means unread and nothing else.
 *
 * ── THE SENTENCE IS THE SERVER'S, DELIBERATELY ─────────────────────────────
 * The API sends the whole line already written ("Ada Obi joined the channel"),
 * and it is rendered verbatim. `metadata.user_uuid` is there so the name could
 * be linked, but linking it would mean finding the name INSIDE that sentence —
 * a substring match against a display name, which breaks on a name that
 * contains the word "joined", on a rename, and on any wording change the
 * backend makes. The whole sentence, unparsed, cannot drift from what the
 * server decided happened.
 *
 * ── THE THREE STAY THREE ───────────────────────────────────────────────────
 * `member_left` and `member_removed` get different glyphs as well as different
 * words. Collapsing them — even visually — misrepresents somebody who was
 * removed as having walked out, in front of everybody who reads the channel.
 * Any unknown type falls back to the plain sentence with no glyph, which is
 * still true and still readable.
 *
 * ── THE THREAD LINE READS, IT DOES NOT YET TRAVEL ──────────────────────────
 * `thread_started` carries a `thread_uuid` and could be a way in to the thread.
 * It is drawn as a plain sentence for now because opening threads is a feature
 * nobody has asked for yet; this exists so that the line the server already
 * posts is not attributed to "Deleted account", which is what an author-less
 * row does in the ordinary message path.
 */
const SYSTEM_LINE_GLYPHS: Readonly<Record<string, LucideIcon>> = {
  member_joined: UserPlus,
  member_left: LogOut,
  member_removed: UserMinus,
  thread_started: GitBranch,
};

export function QuietSystemLine({ message }: { message: Message }) {
  const type = message.metadata.type;
  const Glyph = type ? SYSTEM_LINE_GLYPHS[type] : undefined;
  const text = message.content.trim();
  if (!text) return null;

  return (
    <div
      role="separator"
      aria-label={text}
      className="flex items-center justify-center gap-1.5 py-1"
    >
      {Glyph && (
        <Glyph aria-hidden className="size-3 shrink-0 text-muted-foreground/70" />
      )}
      {/* `aria-hidden`: the separator's own label already reads the sentence,
          and without this a screen reader says it twice. */}
      <span aria-hidden className="text-[11px] leading-snug text-muted-foreground">
        {text}
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
