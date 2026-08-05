'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Hash, Lock, MoreHorizontal, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Channel, SlimUser } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { PresenceStack } from '@/v2/features/collab/kit/PresenceStack';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { ChannelTab } from '../model';
import { SectionSwitch, type ChannelSection, type SectionCounts } from './SectionSwitch';

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
 * ── THE BAR IS FIXED AT `h-14`, AND THAT IS THE POINT ──────────────────────
 * Everything that used to change the header's HEIGHT now changes its CONTENT:
 * the description is a disclosure on the name, the sections are a segment, and
 * joining a channel adds controls rather than a row. The one thing that still
 * moves the header is the reader opening the description themselves, and the
 * feed's viewport keeper holds them bottom-anchored through it.
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
 * ── PRESENCE IS FACES, AND THE COUNT IS A WORD ─────────────────────────────
 * `PresenceStack` replaces both the "4 members" text and the "3 online" text.
 * With a roster it shows faces and a `+N`; without one it says the count in
 * words. The online figure rides its accessible name and its tooltip rather
 * than a second grey run in the bar — the header states WHO is here, and the
 * roster it opens is where "how many are looking" belongs. No presence dots,
 * ever (DIRECTION 7, binding).
 */

export interface HeaderLens {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

export function ChannelPlaceHeader({
  channel,
  members,
  onlineCount,
  onOpenRoster,
  sections,
  section,
  onSelectSection,
  sectionCounts,
  lenses,
  menu,
}: {
  channel: Channel;
  /** Faces for the stack. Empty degrades to the count in words. */
  members: readonly SlimUser[];
  /** Live presence total; `0` when there is no room (a previewer, a refusal). */
  onlineCount: number;
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
  const presenceLabel =
    onlineCount > 0 ? `${countLabel}, ${onlineCount} online` : countLabel;

  return (
    <div className="shrink-0 border-b">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="flex h-14 items-center gap-2">
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
                without ever drawing the ellipsis. */}
            <h1 className="flex min-w-0 items-center text-base leading-tight font-semibold">
              {description ? (
                /* The description used to cost 20px on every channel forever.
                   As a disclosure it costs a chevron, and the name itself is
                   the control — the reader reaches for what they want to know
                   more about. */
                <button
                  type="button"
                  aria-expanded={descriptionOpen}
                  aria-controls={DESCRIPTION_ID}
                  onClick={() => setDescriptionOpen((open) => !open)}
                  className={cn(
                    'v2-interactive flex min-w-0 items-center gap-1 rounded',
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
              ) : (
                <span className="min-w-0 truncate">{channel.name}</span>
              )}
            </h1>

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
              A `div`, never a `span`: `PresenceStack` builds on `AvatarGroup`,
              which emits flow content, and a `div` inside a `span` is invalid.
              The wrapper exists to carry the hover `title` — which is where the
              online figure lives, rather than as a second grey text run in the
              bar (see the file docblock). */}
          <div title={presenceLabel} className="shrink-0">
            <PresenceStack
              members={members}
              total={total}
              countLabel={countLabel}
              label={presenceLabel}
              size="sm"
              onClick={onOpenRoster}
            />
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
 */
function ActionCluster({
  lenses,
  menu,
}: {
  lenses: readonly HeaderLens[];
  menu?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {lenses.length > 0 && (
        <div
          className={cn(
            'flex items-center gap-0.5 rounded-lg border p-0.5',
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
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
