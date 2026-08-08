'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Hash, Lock, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Channel, SlimUser } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { PresenceStack } from '@/v2/features/collab/kit/PresenceStack';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { ChannelTab } from '../model';
import type { ChannelPresence } from '../room';
import { HereNow } from './HereNow';
import { SectionSwitch, type ChannelSection, type SectionCounts } from './SectionSwitch';
import type { MarkComponent } from '../ui/avatars';

/** One frozen empty roster, so the no-presence fallback hands `PresenceStack`
 *  the same reference every render and it renders the count in WORDS. */
const NO_FACES: readonly SlimUser[] = [];

/**
 * PlaceHeader — ONE bar and ONE hairline over a channel. Phase-5 redesign
 * wave, W2 (2026-08-05).
 *
 * WHAT IT REPLACES, AND WHY THAT WAS THE COMPLAINT. The shipped screen stacked
 * an identity header, a push nudge, a quiz bar and a tab strip — three of them
 * with their own `border-b` — so a 640px phone spent roughly 150px on chrome
 * before the first message. Inside that, the space was a 14px text link, the
 * people were the WORD "4 members", and Pins / Saved / overflow were three
 * adjacent 32px grey squares of near-identical weight, which is a row of
 * buttons rather than a set of decisions.
 *
 * ── THE BAR'S HEIGHT IS FIXED PER WIDTH, AND THAT IS THE POINT ─────────────
 * Everything that used to change the header's HEIGHT now changes its CONTENT:
 * the description is a disclosure, the sections are a segment, and joining a
 * channel adds controls rather than a row. The one thing that still moves the
 * header is the reader opening the description themselves, and the feed's
 * viewport keeper holds them bottom-anchored through it.
 *
 * ── THE NAME IS PRINTED ONCE PER SCREEN, AND BELOW `md:` NOT HERE ──────────
 * The shell's own header carries the channel name over the space name BELOW
 * `md:` only, and deliberately goes EMPTY at `md:` and up because that is where
 * this bar starts naming the channel (`v2/shell/V2Header.tsx`, and the same
 * contract again in `v2/features/collab/shell/CollabHeaderSlot.tsx`). Half of
 * that contract was honoured and half was not: this bar's `h1` rendered at
 * every width, so a phone printed "Product Development" in the shell bar and
 * again, one row below, here — two bars of height spent saying one thing before
 * the conversation starts, which is the complaint that took this screen from
 * four stacked bars to one in the first place.
 *
 * So below `md:` the heading is `sr-only` — the screen keeps its `h1` and
 * assistive tech keeps the name at every width, because a document whose only
 * heading changed with the viewport would be a different document at every
 * width — and the bar prints what the shell CANNOT: what the channel is FOR.
 * See "THE PURPOSE LINE" below.
 *
 * ── THE TWO BREAKPOINTS, AND WHY THEY ARE WHERE THEY ARE ───────────────────
 * Three surfaces can name the space a channel lives in — the shell's collab
 * header, the docked space rail, and this bar's breadcrumb chip — and the
 * reader should meet exactly one of them at any width. So:
 *
 *  - THE CHIP RUNS `md:` → `lg:` ONLY. Below `md:` the shell's collab header
 *    carries the space on a phone. At `lg:`+ the space rail docks and names the
 *    space permanently down the side of the screen, so a chip beside the
 *    channel name would be the same fact a third time. The band between is the
 *    one width with neither, and that is exactly the band the chip exists for.
 *
 *  - THE SECTION SWITCH RUNS AT `xl:`+. It is the widest control in the bar,
 *    and below `xl:` the channel PANE is not the viewport: subtract the app
 *    sidebar and, from `lg:`, a 240px rail, and a 1024px window leaves this
 *    header roughly 500px to hold identity, sections, faces, two lenses and an
 *    overflow. Something has to go, and the sections are the one cluster with a
 *    better home — the phone's bottom bar, which is pane-scoped and free while
 *    the reader is in Chat. A bar in a 500px pane is not a "mobile" affordance;
 *    it is the right affordance for a 500px pane.
 *
 * Both gates are keyed to where the rail docks. If that moves, these move with
 * it — they are the only two breakpoints in this feature's chrome.
 *
 * ── THE FACES MEAN "HERE NOW", AND ONLY WHEN THEY CAN ──────────────────────
 * The slot holds one of two objects, and which one depends on whether this
 * reader is in the presence room at all:
 *
 *   IN THE ROOM   — {@link HereNow}: three faces of people who are here this
 *                   second, then a `+N` of MORE PEOPLE HERE, opening the
 *                   roster. Presence is the thing the header shows, not a
 *                   figure hidden in a `title` where a phone never finds it.
 *   NO ROOM       — a previewer, or a refusal. `PresenceStack` with NO faces,
 *                   which prints the member count in words. Showing roster
 *                   faces in this slot would be the old lie in a new place:
 *                   the cluster now means "here", and someone with no socket
 *                   cannot know who is.
 *
 * No presence dots, ever (DIRECTION 7, binding) — and no "3 here · 12 members"
 * line either: a `+N` beside a total is two numbers with different meanings,
 * side by side (@arthur, 2026-08-06).
 *
 * ── THE PURPOSE LINE, AND WHY IT IS THE DISCLOSURE'S TRIGGER ON A PHONE ────
 * The description has always been a disclosure rather than a permanent 20px
 * row, and the CONTROL was the channel name. Take the name away below `md:`
 * and the affordance loses its trigger, so at that width the trigger becomes
 * the description ITSELF, on one truncated line: the reader taps what they want
 * to read the rest of, which is the same move the name asked for and a plainer
 * one.
 *
 * TWO TRIGGERS, ONE PER WIDTH, ONE DISCLOSURE — the same `descriptionOpen` and
 * the same `aria-controls`, and exactly one of them is ever displayed, so the
 * other is `display:none` and therefore out of the tab order and out of the
 * accessibility tree entirely. (Two controls for one job, switched by CSS, is
 * the `SPACE_DRAWER_TRIGGER_IDS` idiom this feature already runs on.) They must
 * not both be `sr-only`-style hidden: a clipped control is still focusable, and
 * a phone reader tabbing into an invisible copy of the name is worse than the
 * duplicate this change removes.
 *
 * A channel with no description has nothing to disclose, so at that width the
 * slot falls back to the visibility in words ("Private"), which the lock glyph
 * beside it can only imply. It is `aria-hidden` because the `sr-only` label on
 * the glyph already says it, so the words are printed once too.
 *
 * ── AND THE BAR IS SHORTER FOR IT ──────────────────────────────────────────
 * `h-11` below `md:`, `h-14` from there up. 56px is the height of a bar built
 * around a 16px semibold heading; without one, the tallest thing in it is a
 * 32px control, and 44px holds that with room to spare — the standards' primary
 * tap target, exactly. The strip now reads as subordinate to the shell bar
 * above it, which is what it is.
 */

export interface HeaderLens {
  id: string;
  label: string;
  icon: MarkComponent;
  onSelect: () => void;
}

export function ChannelPlaceHeader({
  channel,
  presence,
  onOpenRoster,
  sections,
  section,
  onSelectSection,
  sectionCounts,
  lenses,
  menu,
}: {
  channel: Channel;
  /** Who is here now. `null` for a reader with no room — see the docblock. */
  presence: ChannelPresence | null;
  /** Opens the roster. Omitted where the roster is not readable. */
  onOpenRoster?: () => void;
  /** Sections this reader can reach. One entry = no control at all. */
  sections: readonly ChannelSection[];
  section: ChannelTab;
  onSelectSection: (next: ChannelTab) => void;
  sectionCounts: SectionCounts;
  /** The reading lenses over this channel — pinned, saved, AI history. */
  lenses: readonly HeaderLens[];
  /** The overflow menu's ITEMS. Absent ⇒ no overflow button at all. */
  menu?: ReactNode;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const VisibilityIcon = channel.visibility === 'private' ? Lock : Hash;
  const description = channel.description?.trim() || null;
  const total = channel.active_members_count;
  const countLabel = `${total} ${total === 1 ? 'member' : 'members'}`;

  return (
    <div className="shrink-0 border-b">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="flex h-11 items-center gap-2 md:h-14">
          {/* ── Identity ─────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <VisibilityIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="sr-only">{channel.visibility_label}</span>

            {/* The `min-w-0` chain runs identity → h1 → button → span, and every
                link of it is load-bearing: a flex item defaults to
                `min-width: auto`, so without it the name refuses to shrink and
                pushes the presence stack and the actions off the bar instead of
                ellipsizing. The truncation itself lives on the innermost span,
                because `truncate` on an element with a flex child clips it
                without ever drawing the ellipsis.

                `sr-only` below `md:` — the shell bar prints the channel there
                (see the docblock). It is the heading, not the trigger, at that
                width, so the button inside it is `hidden` rather than clipped:
                `sr-only` leaves a control focusable, and a phone reader must
                not be able to tab into an invisible copy of a control the
                purpose line beside it already offers. */}
            <h1 className="sr-only min-w-0 md:not-sr-only md:flex md:items-center md:text-base md:leading-tight md:font-semibold">
              {description ? (
                <>
                  {/* The description used to cost 20px on every channel forever.
                      As a disclosure it costs a chevron, and the name itself is
                      the control — the reader reaches for what they want to know
                      more about. */}
                  <button
                    type="button"
                    aria-expanded={descriptionOpen}
                    aria-controls={DESCRIPTION_ID}
                    onClick={() => setDescriptionOpen((open) => !open)}
                    className={cn(
                      'v2-interactive hidden min-w-0 items-center gap-1 rounded md:flex',
                      'transition-colors duration-150 hover:text-foreground/80 motion-reduce:transition-none',
                      FOCUS_RING,
                    )}
                  >
                    <span className="min-w-0 truncate">{channel.name}</span>
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground',
                        'transition-transform duration-200 motion-reduce:transition-none',
                        descriptionOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {/* The heading's OWN text below `md:`, where the button above
                      is `display:none` and would otherwise take the name out of
                      the accessibility tree along with the pixels. */}
                  <span className="md:hidden">{channel.name}</span>
                </>
              ) : (
                <span className="min-w-0 md:truncate">{channel.name}</span>
              )}
            </h1>

            {/* ── The purpose (below `md:` only) ─────────────────────────
                What this bar can say that the shell bar above it cannot — and,
                since the name went, where the description's disclosure lives at
                this width. See the docblock. */}
            {description ? (
              <button
                type="button"
                aria-expanded={descriptionOpen}
                aria-controls={DESCRIPTION_ID}
                onClick={() => setDescriptionOpen((open) => !open)}
                className={cn(
                  'v2-interactive flex min-w-0 flex-1 items-center gap-1 rounded md:hidden',
                  'text-sm text-muted-foreground',
                  'transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
                  FOCUS_RING,
                )}
              >
                <span className="min-w-0 truncate">{description}</span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'size-4 shrink-0',
                    'transition-transform duration-200 motion-reduce:transition-none',
                    descriptionOpen && 'rotate-180',
                  )}
                />
              </button>
            ) : (
              <span
                aria-hidden
                className="min-w-0 truncate text-sm text-muted-foreground md:hidden"
              >
                {channel.visibility_label}
              </span>
            )}

            {/* The space as a real object, not a text link: the same crest the
                space's own lane and header carry, so the reader recognises
                where they are instead of reading it. `md:` → `lg:` only — see
                the breakpoint note in the file docblock. */}
            <Link
              href={`/spaces/${channel.space.uuid}`}
              className={cn(
                // Capped so a long space name can never be the thing that
                // squeezes the channel's own name out of the bar.
                'v2-interactive hidden min-w-0 max-w-56 shrink items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1',
                'text-xs text-muted-foreground md:inline-flex lg:hidden',
                'transition-colors duration-150 hover:bg-secondary hover:text-foreground motion-reduce:transition-none',
                FOCUS_RING,
              )}
            >
              <SpaceCrest
                uuid={channel.space.uuid}
                name={channel.space.name}
                type={channel.space.type}
                size="sm"
                className="size-5 rounded"
              />
              <span className="min-w-0 truncate">{channel.space.name}</span>
            </Link>
          </div>

          {/* ── Sections (wide panes only — see the docblock) ─────────── */}
          {sections.length > 1 && (
            <SectionSwitch
              sections={sections}
              value={section}
              onChange={onSelectSection}
              counts={sectionCounts}
              density="header"
              className="hidden xl:inline-flex"
            />
          )}

          {/* ── People ───────────────────────────────────────────────────
              A `div`, never a `span`: both of these build on `AvatarGroup`,
              which emits flow content, and a `div` inside a `span` is invalid.
              Which one renders is the whole question — see the file docblock. */}
          <div className="shrink-0">
            {presence !== null && onOpenRoster ? (
              <HereNow presence={presence} onOpenRoster={onOpenRoster} />
            ) : (
              <PresenceStack
                members={NO_FACES}
                total={total}
                countLabel={countLabel}
                label={countLabel}
                size="sm"
                onClick={onOpenRoster}
              />
            )}
          </div>

          {/* ── Actions ──────────────────────────────────────────────── */}
          <ActionCluster lenses={lenses} menu={menu} />
        </div>

        {/* The description, revealed. `EnablePushNudge`'s symmetric grid-rows
            idiom — reused rather than re-invented — so it never snaps. */}
        {description && (
          <div
            id={DESCRIPTION_ID}
            aria-hidden={!descriptionOpen}
            inert={!descriptionOpen}
            className={cn(
              'grid transition-[grid-template-rows] duration-200 ease-out',
              'motion-reduce:transition-none',
              descriptionOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <p className="pb-3 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const DESCRIPTION_ID = 'v2-channel-description';

/**
 * ActionCluster — the trailing action group, and the end of the row of
 * identical grey squares.
 *
 * THE LENSES ARE ONE OBJECT. Pinned and Saved (and, for a previewer who has no
 * menu to hold it, the Lawexa history) are the same KIND of move: a lens over
 * this channel's own messages. So they share one bordered container and read as
 * a segmented control — one thing with two positions — while the overflow, a
 * different kind of move entirely, is a LABELLED button beside it. Weight now
 * follows meaning: two quiet glyphs in one frame, then a word.
 *
 * `aria-pressed` is deliberately absent: opening a lens is a navigation, not a
 * toggle, and the panel it opens is not a state of this button.
 *
 * ── ON A PHONE THE BAR'S TRAILING SLOT HOLDS EXACTLY ONE OBJECT ────────────
 * Below `md:` this bar also carries the channel's purpose on one line, and a
 * 360px row cannot hold a line of prose AND faces AND a two-glyph frame AND an
 * overflow: filmed at 390px with all four, the purpose truncated to "Everything
 * on th…", which is not a sentence and not worth a bar.
 *
 * So at that width the lenses fold INTO the overflow, as labelled rows at the
 * head of the menu — which is the better affordance for them on a phone anyway:
 * two 28px unlabelled glyphs become two thumb-sized rows that say what they
 * open. They fold only when there IS a menu to fold into. A previewer has none
 * (every item in it is a write they do not have), so their lenses keep the
 * frame and their bar has no overflow — one object either way, never both and
 * never neither. At `md:`+ nothing here changes at all.
 */
function ActionCluster({
  lenses,
  menu,
}: {
  lenses: readonly HeaderLens[];
  menu?: ReactNode;
}) {
  const lensesFoldIntoMenu = menu !== undefined && lenses.length > 0;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {lenses.length > 0 && (
        <div
          className={cn(
            'items-center gap-0.5 rounded-lg border p-0.5',
            lensesFoldIntoMenu ? 'hidden md:flex' : 'flex',
            'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
          )}
        >
          {lenses.map((lens) => (
            <button
              key={lens.id}
              type="button"
              aria-label={lens.label}
              title={lens.label}
              onClick={lens.onSelect}
              className={cn(
                'v2-interactive flex size-7 items-center justify-center rounded-[7px] text-muted-foreground',
                'transition-colors duration-150 hover:bg-secondary hover:text-foreground',
                'motion-reduce:transition-none',
                FOCUS_RING,
              )}
            >
              <lens.icon aria-hidden className="size-4" />
            </button>
          ))}
        </div>
      )}

      {menu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
              aria-label="Channel options"
            >
              <MoreHorizontal aria-hidden className="size-4" />
              <span className="hidden sm:inline">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* The lenses' other home. `md:hidden` on the GROUP, not on each
                row, so the separator leaves with them and the menu never opens
                on a rule with nothing above it. */}
            {lensesFoldIntoMenu && (
              <DropdownMenuGroup className="md:hidden">
                {lenses.map((lens) => (
                  <DropdownMenuItem key={lens.id} onClick={lens.onSelect}>
                    <lens.icon aria-hidden className="size-4" />
                    {lens.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </DropdownMenuGroup>
            )}
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
