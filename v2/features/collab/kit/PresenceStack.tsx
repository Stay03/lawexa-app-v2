import { cn } from '@/lib/utils';
import { AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import type { SlimUser } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { MemberAvatar } from '../membership/MemberAvatar';

/**
 * PresenceStack — the ONE answer to "who is here". Overlapping faces, a `+N`
 * overflow chip and the authoritative total, built on the shared
 * `AvatarGroup` / `AvatarGroupCount` primitives (which shipped unused; this is
 * the component they were for).
 *
 * ── NO PRESENCE DOTS. EVER. ────────────────────────────────────────────────
 * `AvatarBadge` exists in the same primitive file and is deliberately not
 * imported. Green-dot presence is the "butts in seats" pressure the research
 * names as a design failure (DIRECTION 7, binding). This shows WHO belongs,
 * never who is watching.
 *
 * ── IT DEGRADES, BECAUSE THE WIRE DOES ─────────────────────────────────────
 * `total` is always available; `members` frequently is not. `GET /api/spaces`
 * stamps `active_members_count` on every row and attaches the roster only on
 * `show`, so the spaces LIST has a count and no faces. With no faces this
 * renders the count IN WORDS — "12 members", never a bare `12`. On a row that
 * also carries a mention badge a loose numeral would be a second number told
 * apart from the badge by colour alone, and in this product A NUMBER IS ONLY
 * EVER MENTIONS.
 *
 * The `+N` inside the face stack is the one exemption and it stays: it sits in
 * a face-sized disc at the END of a row of faces, which is the facepile idiom
 * and cannot be read as a count of anything but the faces it follows.
 *
 * ── BUTTON OR NOT, DECIDED BY THE CALLER ───────────────────────────────────
 * `onClick` makes the whole thing a button that opens the roster. Without it
 * this is a plain element, which is REQUIRED wherever the stack sits inside a
 * row-wide `<Link>`: a button nested in an anchor is invalid HTML and the
 * browser's own repair of it swallows one of the two activations.
 *
 * ── IT EMITS FLOW CONTENT ──────────────────────────────────────────────────
 * `AvatarGroup` renders a `<div>`, so this component's wrapper is a `<div>`
 * too and it must never be placed inside phrasing-only content (a `<span>`, a
 * `<p>`). `MetaLine`, its main host, renders `<div>`s for the same reason. An
 * `<a>` accepts flow content, so a whole-row link is fine.
 */

interface StackGeometry {
  /** How many faces before the overflow chip takes over. */
  faces: number;
  avatar: 'sm' | 'default';
  text: string;
}

const GEOMETRY = {
  sm: { faces: 3, avatar: 'sm', text: 'text-xs' },
  md: { faces: 4, avatar: 'default', text: 'text-sm' },
} satisfies Record<string, StackGeometry>;

type PresenceStackSize = keyof typeof GEOMETRY;

export function PresenceStack({
  members,
  total,
  countLabel,
  label,
  size = 'sm',
  onClick,
  className,
}: {
  /** The faces to show, in the order they should appear. May be empty. */
  members: readonly SlimUser[];
  /** The authoritative member count — never `members.length`, which is a page. */
  total: number;
  /** The count IN WORDS ("12 members") — what renders when there are no faces. */
  countLabel: string;
  /** The accessible name — the same count, plus what it is a count OF. */
  label: string;
  size?: PresenceStackSize;
  /** Supplied ⇒ renders a button that opens the roster. Omit inside a `<Link>`. */
  onClick?: () => void;
  className?: string;
}) {
  const geometry = GEOMETRY[size];
  const faces = members.slice(0, geometry.faces);
  const overflow = Math.max(0, total - faces.length);

  const body =
    faces.length === 0 ? (
      <span className={cn('text-muted-foreground', geometry.text)}>{countLabel}</span>
    ) : (
      <AvatarGroup>
        {faces.map((member) => (
          <MemberAvatar key={member.uuid} user={member} size={geometry.avatar} />
        ))}
        {overflow > 0 ? (
          <AvatarGroupCount className={cn('font-medium tabular-nums', geometry.text)}>
            {`+${overflow > 99 ? 99 : overflow}`}
          </AvatarGroupCount>
        ) : null}
      </AvatarGroup>
    );

  if (!onClick) {
    return (
      <div aria-label={label} role="img" className={cn('inline-flex', className)}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
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
