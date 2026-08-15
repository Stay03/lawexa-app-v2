import { Briefcase, Building2, GraduationCap, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { SpaceType } from '@/types/collab';
import { crestMonogram, crestStyle } from './crest-model';

/**
 * SpaceCrest / OrgCrest — THE identity mark for a collab place. A tinted
 * ground carrying the object's monogram, with its kind as a small corner mark.
 * The colour and letter maths live in `./crest-model.ts`; this file is only
 * the shape. Sizes sm / md / lg / xl map to 24 / 36 / 48 / 64 px.
 *
 * ── THE CREST NEVER MOVES WITH ACTIVITY ────────────────────────────────────
 * The row it leads goes bold and grows a gold dot when there is unread, and
 * the crest does not change at all. That is the whole point: a mark that
 * restyles itself under load is not an identity, and the old row's
 * warm-the-tile-to-gold behaviour put a second gold object next to the badge
 * that carries the real number.
 *
 * ── THE CORNER MARK SITS INSIDE THE TILE ───────────────────────────────────
 * Work / Study / Organization as a small disc in the crest's bottom-right
 * corner, in the page colour so it reads as a notch punched out of the tile.
 * It is INSIDE the tile's bounds and carries no ring, deliberately: a ring in
 * the surface colour is only correct while the surface holds still, and a lane
 * that tints on hover would leave the notch floating as a page-coloured disc
 * on a tinted row. Nothing about this mark depends on what is behind the crest.
 *
 * It is omitted at `sm`: below ~14px the glyph is a smudge, and every `sm` site
 * (breadcrumbs, chips, previews) already names the kind in adjacent text.
 * {@link PlaceCrest} omits it at every size, for the payloads that identify an
 * object without stating its kind — a crest may be silent about something, but
 * it may never guess.
 *
 * ── AN OBJECT THAT DOES NOT EXIST YET HAS NO HUE ───────────────────────────
 * `uuid` is nullable for exactly one caller: the create-space preview, where
 * the object has no uuid because the server has not made it. A `null` uuid
 * paints the neutral secondary ground and still draws the live monogram. It
 * would be easy to derive a hue from the name there, and it would be a lie —
 * the real hue comes from the uuid, so a name-derived preview would visibly
 * change colour the instant the space was created.
 *
 * ── ACCESSIBILITY ──────────────────────────────────────────────────────────
 * Always `aria-hidden`. A crest only ever appears beside the name it stands
 * for, which makes it decorative by the avatar rule — announcing "F H, work
 * space" before the name is noise, not information.
 */

interface CrestGeometry {
  box: string;
  text: string;
  mark: string | null;
  glyph: string;
}

const GEOMETRY = {
  sm: { box: 'size-6 rounded-md', text: 'text-[10px]', mark: null, glyph: '' },
  md: {
    box: 'size-9 rounded-lg',
    text: 'text-[13px]',
    mark: 'size-3.5 bottom-0.5 right-0.5',
    glyph: 'size-2',
  },
  lg: {
    box: 'size-12 rounded-xl',
    text: 'text-[17px]',
    mark: 'size-[18px] bottom-1 right-1',
    glyph: 'size-3',
  },
  xl: {
    box: 'size-16 rounded-2xl',
    text: 'text-2xl',
    mark: 'size-6 bottom-1.5 right-1.5',
    glyph: 'size-3.5',
  },
} satisfies Record<string, CrestGeometry>;

type CrestSize = keyof typeof GEOMETRY;

function Crest({
  uuid,
  name,
  glyph: Glyph,
  size,
  className,
}: {
  /** `null` = not created yet: neutral ground, live monogram, no hue. */
  uuid: string | null;
  name: string;
  /** `null` draws no corner mark — the object's kind is unknown, not implied. */
  glyph: LucideIcon | null;
  size: CrestSize;
  className?: string;
}) {
  const geometry = GEOMETRY[size];
  return (
    <span
      aria-hidden
      style={uuid === null ? undefined : crestStyle(uuid)}
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center',
        uuid === null
          ? 'bg-secondary text-muted-foreground'
          : [
              'bg-[color:var(--crest-bg)] text-[color:var(--crest-fg)]',
              'dark:bg-[color:var(--crest-bg-dark)] dark:text-[color:var(--crest-fg-dark)]',
            ],
        geometry.box,
        className,
      )}
    >
      <span className={cn('font-semibold tracking-tight', geometry.text)}>
        {crestMonogram(name)}
      </span>
      {geometry.mark && Glyph ? (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-background text-muted-foreground',
            geometry.mark,
          )}
        >
          <Glyph className={geometry.glyph} />
        </span>
      ) : null}
    </span>
  );
}

/** A space's crest — Work and Study carry different corner marks. */
export function SpaceCrest({
  uuid,
  name,
  type,
  size = 'md',
  className,
}: {
  uuid: string | null;
  name: string;
  type: SpaceType;
  size?: CrestSize;
  className?: string;
}) {
  return (
    <Crest
      uuid={uuid}
      name={name}
      glyph={type === 'study' ? GraduationCap : Briefcase}
      size={size}
      className={className}
    />
  );
}

/** An organization's crest. The real logo is deliberately not rendered — the
 *  app configures no `images.remotePatterns`, so a monogram is the honest mark
 *  until a rendering path for remote logos is agreed. */
export function OrgCrest({
  uuid,
  name,
  size = 'md',
  className,
}: {
  uuid: string | null;
  name: string;
  size?: CrestSize;
  className?: string;
}) {
  return (
    <Crest uuid={uuid} name={name} glyph={Building2} size={size} className={className} />
  );
}

/**
 * A crest for an object whose KIND the payload did not state — a channel
 * invitation's parent space arrives as `{uuid, name}` and nothing else. Same
 * monogram, same fixed hue, no corner mark.
 */
export function PlaceCrest({
  uuid,
  name,
  size = 'md',
  className,
}: {
  uuid: string | null;
  name: string;
  size?: CrestSize;
  className?: string;
}) {
  return <Crest uuid={uuid} name={name} glyph={null} size={size} className={className} />;
}

/** The crest's reserved shape — same box and radius, so the swap moves nothing.
 *  It pulses wherever it is drawn, route fallbacks included: one wait may only
 *  have one appearance. */
export function CrestSkeleton({
  size = 'md',
  className,
}: {
  size?: CrestSize;
  className?: string;
}) {
  return <Skeleton className={cn('shrink-0', GEOMETRY[size].box, className)} />;
}
