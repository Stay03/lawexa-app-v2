'use client';

import { useMemo } from 'react';

import { cn } from '@/lib/utils';
import { AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { ChannelPresence, PresenceMember } from '../room';

/**
 * HereNow — the channel header's faces, and they mean WHO IS IN THIS CHANNEL
 * RIGHT NOW. Decided by @arthur 2026-08-06, built 2026-08-08.
 *
 * ── WHAT IT REPLACES, AND WHY THAT WAS WRONG ───────────────────────────────
 * The slot used to hold `PresenceStack` fed from the member ROSTER: faces of
 * people who belong here, and a `+N` counting everyone else on the list. The
 * live presence figure existed the whole time and was spent on a `title`
 * attribute and an accessible name — which, on a phone, means nowhere. So the
 * one cluster that looks like "who is around" was the one thing on the screen
 * that could not tell you.
 *
 * Now the faces ARE the presence, and the count they carry is the same count:
 * three faces, then a `+N` OF PEOPLE HERE, and the roster — where the total
 * belongs — is one tap behind them. A "3 here · 12 members" line was proposed
 * and rejected on the spot: a `+N` standing next to a total puts two numbers
 * with different meanings side by side, which is worse than saying less.
 *
 * ── ACTIVE FIRST, BACKGROUNDED DIM, DEPARTED GONE ──────────────────────────
 * Sorting active faces to the front is what keeps the dim honest. Fade someone
 * inside a cluster that means "present" and the cluster stops meaning anything;
 * put the dim ones last and the reader learns the order instead of decoding it.
 * Someone whose socket has gone is not dim — they are OUT, because "here" is
 * the only claim this component makes.
 *
 * AND A DIM FACE IS THE WEAKER CLAIM, DELIBERATELY. The away signal is a
 * whisper the other device sends when its tab goes to the background, and a
 * pocketed phone often never gets to send it (see `../room`). So dim means "was
 * here, may have stepped away" and bright means "here, as far as anyone knows"
 * — never "definitely watching". Nothing on this screen is worth reading as
 * attendance, which is the whole reason there is no green dot.
 *
 * ── NO `aria-live`, ON PURPOSE ─────────────────────────────────────────────
 * Every arrival and departure changes this cluster, and a live region would
 * read them out over whatever the reader was actually doing — the classic way
 * to make an ambient signal hostile. It is a BUTTON instead, whose accessible
 * name is recomputed from the live count, so "4 people here now" is available
 * the moment anyone asks for it and silent until then. The faces themselves are
 * `aria-hidden`: the button already says how many, and eight avatars announcing
 * their own alt text would bury the number that matters.
 *
 * ── IT EMITS FLOW CONTENT ──────────────────────────────────────────────────
 * `AvatarGroup` renders a `<div>`, the same constraint `PresenceStack` carries:
 * never place this inside phrasing-only content.
 */

/** Three, then a `+N`. The decision's number, not a tunable. */
const MAX_FACES = 3;

interface DrawnFace {
  member: PresenceMember;
  /** Their tab told us it went to the background. */
  away: boolean;
  /** Their socket has gone; this face is playing its exit. */
  leaving: boolean;
}

/**
 * `onOpenRoster` is REQUIRED, and that is a statement about who sees this. Only
 * a reader who joined the presence room has presence to show, and joining it
 * means the roster read is already theirs — so there is no such thing as this
 * cluster without somewhere for its `+N` to go.
 */
export function HereNow({
  presence,
  onOpenRoster,
  className,
}: {
  presence: ChannelPresence;
  /** Opens the member list — where the TOTAL belongs. */
  onOpenRoster: () => void;
  className?: string;
}) {
  const { here, departing, away } = presence;

  const faces = useMemo<readonly DrawnFace[] | null>(() => {
    if (here === null) return null;

    // Arrival order is preserved inside each group, so a face only ever moves
    // for a reason the reader can see.
    const active = here.filter((person) => !away.has(person.uuid));
    const quiet = here.filter((person) => away.has(person.uuid));
    const live = [...active, ...quiet];

    // A departure that arrives as `leaving` and then again in a fresh `here()`
    // would otherwise be drawn twice for a frame.
    const present = new Set(live.map((person) => person.uuid));
    const gone = departing.filter((person) => !present.has(person.uuid));

    // Live faces claim the slots first, so a departure from the `+N` crowd is
    // invisible (correct — the stack did not change) while a departure from the
    // stack itself keeps its slot long enough to fade.
    return [
      ...live.map((member) => ({
        member,
        away: away.has(member.uuid),
        leaving: false,
      })),
      ...gone.map((member) => ({
        member,
        away: away.has(member.uuid),
        leaving: true,
      })),
    ].slice(0, MAX_FACES);
  }, [here, departing, away]);

  const hereCount = here?.length ?? 0;
  // Only the living count against the overflow; a fading face is nobody.
  const drawnLive = faces?.filter((face) => !face.leaving).length ?? 0;
  const overflow = Math.max(0, hereCount - drawnLive);

  const countPhrase =
    faces === null
      ? null
      : `${hereCount === 1 ? '1 person' : `${hereCount} people`} here now`;

  const body =
    faces === null ? (
      // Skeleton at the real geometry — three discs the size of the faces that
      // will replace them, spaced like them, so the header does not resize when
      // the room answers. A previewer never reaches this: with no room to join
      // there is no presence to wait for, and the header says the member count
      // in words instead (see `PlaceHeader`), so the shimmer cannot outlive a
      // refusal.
      <div aria-hidden className="flex -space-x-1">
        {[0, 1, 2].map((index) => (
          <Skeleton
            key={index}
            className="ring-background size-6 rounded-full ring-2"
          />
        ))}
      </div>
    ) : (
      <AvatarGroup aria-hidden>
        {faces.map((face) => (
          <MemberAvatar
            key={face.member.uuid}
            user={face.member}
            size="sm"
            className={cn(
              // DIM THE PERSON, NOT THE DISC. `opacity` on the avatar root
              // makes the whole mark translucent — and an away face sorts
              // LAST, so it is painted over an active one and that neighbour
              // would show straight through the overlap. Fading only the
              // children (the photo, or the initials on their tint) keeps the
              // root's opaque ground and its hairline ring — a pseudo-element
              // `*:` cannot reach — solid, which is what makes a dim face read
              // as faded rather than as a rendering fault. The ground is
              // unconditional so it is already there for the fade back.
              'bg-background *:transition-opacity *:duration-200 motion-reduce:*:transition-none',
              face.away && '*:opacity-45',
              face.leaving
                ? // `fill-mode-forwards` is the working hold (the shorthand
                  // `animate-out` resets a bare `animation-fill-mode`), and
                  // `motion-reduce:hidden` covers the path with no animation at
                  // all, where the face would otherwise sit fully drawn until
                  // the room's 200ms timer drops it.
                  'motion-safe:animate-out motion-safe:fade-out motion-safe:zoom-out-75 motion-safe:duration-200 fill-mode-forwards motion-reduce:hidden'
                : 'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-200',
            )}
          />
        ))}
        {overflow > 0 ? (
          <AvatarGroupCount className="font-medium tabular-nums">
            {`+${overflow > 99 ? 99 : overflow}`}
          </AvatarGroupCount>
        ) : null}
      </AvatarGroup>
    );

  return (
    <button
      type="button"
      // Named by the count, not by the faces — see the `aria-live` note above.
      // While the room is still answering the control keeps its box and says
      // only what it can do.
      aria-label={countPhrase === null ? 'Members' : `${countPhrase}, open members`}
      title={countPhrase ?? undefined}
      onClick={onOpenRoster}
      className={cn(
        'v2-interactive inline-flex items-center rounded-full px-1 py-0.5',
        'transition-colors duration-150 hover:bg-secondary motion-reduce:transition-none',
        FOCUS_RING,
        className,
      )}
    >
      {body}
    </button>
  );
}
