'use client';

import { useLayoutEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Space } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { setSpaceTitleOnScreen } from '@/v2/features/collab/shell/collab-header';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { spaceHeaderFacts, spacePrincipleLine, type MembershipSubject } from '../model';

/**
 * SpacePlaceHeader — the identity block at the top of the space page.
 *
 * ── IT LEADS WITH THE PLACE, NOT WITH A DOCUMENT ───────────────────────────
 * The shipped header was the case page's grammar — a grey type tile, a kicker,
 * an `h1`, a kebab — which reads as "a record about a space". A space is a
 * PLACE, so it leads with the crest (the same monogram and the same hue the
 * reader has already seen on the `/spaces` lane, in the rail beside this page
 * and in the channel header afterwards).
 *
 * ── ONE SHORT ROW, AND THE REST BEHIND THE NAME (Stay, 15 October 2026) ────
 * "I also dont like the top of the space page, it takes too much space at the
 * top and makes things messy." So the block is the crest, the name and one
 * line under it, at the 36px crest since design B4 (17 October 2026): the
 * description and Stay's lines are in the details sheet the name opens
 * (`SpaceAboutSheet`), the way a chat app opens a conversation's details from
 * its name. A space with nothing to say beyond its name keeps a plain heading
 * (`spaceHasAbout`).
 *
 * ── THE NAME, THEN THE TYPE, WHO CAN GET IN, AND HOW MANY ARE IN IT ────────
 * Arthur, 15 October 2026: "Display the Space name prominently, with the type
 * and privacy status as secondary information", for example "Constitutional
 * Law" over "Study · Private" (`spaceHeaderFacts`). B4 ends the line with the
 * members count ("Work · Private · 7 members"), and the line opens the members
 * sheet (`onOpenRoster`), as the People pill shows the same people in the
 * list's place. On a shared space Stay's two lines still sit in the details
 * sheet (`spacePrincipleLine`).
 *
 * ── THE NAME IS PRINTED IN FULL AT EVERY WIDTH ─────────────────────────────
 * Below `md:` the heading used to be stated for assistive tech only, with the
 * name in the shell's bar, cut to about 190px: a law firm's matter names were
 * never readable on a phone. It is printed here at every width, and the bar's
 * title steps back while this heading is on screen (`setSpaceTitleOnScreen`),
 * so the name and the crest are not printed twice. On a phone it is ONE line,
 * cut with "…", with the facts on one line under it (header option 1, Stay,
 * 23 October 2026, 00:06Z, on two lines: "Waste of space, disorganised"); the
 * full name is in the details the name opens, and in its `title`. From `md:`
 * up it wraps to two lines.
 *
 * ── THE OVERFLOW LEFT THIS BLOCK (phase 7) ─────────────────────────────────
 * The space's verbs are published to the bar's single overflow menu
 * (`SpaceScreen`, through `v2/shell/screen-context.ts`): two identical kebabs
 * on one phone screen, holding two different menus, was the alternative.
 */
export function SpacePlaceHeader({
  space,
  membership,
  onOpenAbout,
  onOpenRoster,
}: {
  space: Space;
  /** The viewer's roles, the frame's one reading of them. */
  membership: MembershipSubject;
  /** Opens the space's details sheet (the description, Stay's lines). */
  onOpenAbout: () => void;
  /** Opens the members sheet (`SpaceMembersSheet`, the frame's). */
  onOpenRoster?: () => void;
}) {
  const hasAbout = spaceHasAbout(space, membership);
  const facts = (
    <MetaLine
      as="span"
      className="text-sm"
      // One zone, so a dot sits between every fact: "Work · Private · 2 members".
      // A separate trail zone had no dot before the count (Tester, live, 23
      // October 2026: "Private 2 members").
      lead={[...spaceHeaderFacts(space), spaceMembersLabel(space.active_members_count)]}
    />
  );

  return (
    <header className={SPACE_HEADER_ROW}>
      <SpaceCrest uuid={space.uuid} name={space.name} type={space.type} size="md" />

      <div className="min-w-0 flex-1">
        <SpaceHeading name={space.name} onOpenAbout={hasAbout ? onOpenAbout : undefined} />
        {onOpenRoster ? (
          <button
            type="button"
            onClick={onOpenRoster}
            className={cn('v2-interactive mt-0.5 block rounded-sm text-left', FOCUS_RING)}
          >
            {facts}
          </button>
        ) : (
          <div className="mt-0.5">{facts}</div>
        )}
      </div>
    </header>
  );
}

/** The header's row, shared with the route's silhouette so the hand-off
 *  moves nothing. */
export const SPACE_HEADER_ROW = 'flex items-center gap-3 pb-2';

/** "7 members", the header's count of who is in the space. */
export function spaceMembersLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

/**
 * Whether the space has anything to say beyond its name: a description, or
 * Stay's lines on a shared space. Only then is the name a door to the sheet
 * that prints them; a name that opens an empty sheet is a dead tap.
 */
export function spaceHasAbout(
  space: Pick<Space, 'description' | 'kind'>,
  membership: Pick<MembershipSubject, 'my_content_role'>,
): boolean {
  const description = space.description?.trim() || null;
  const principle = spacePrincipleLine({
    kind: space.kind,
    my_content_role: membership.my_content_role,
  });
  return description !== null || principle !== null;
}

/**
 * The space's name as the page's `h1`, at every width: one line on a phone,
 * up to two from `md:`.
 * It tells the shell's bar whether it is on screen, so the bar's own copy of
 * the name can step back while this one is readable. Shared with the route's
 * silhouette, so the hand-off moves nothing and the bar does not flicker
 * between them.
 *
 * THE FIRST ANSWER IS MEASURED BEFORE PAINT (a layout effect), so the bar
 * never shows the name for one frame and then hides it; the observer keeps it
 * true as the pane scrolls. Unmounting reports `false`, so a route that has
 * no heading gets its bar title back.
 */
export function SpaceHeading({
  name,
  onOpenAbout,
}: {
  name: string;
  /** When given, the name is a button that opens the space's details (the
   *  way a chat app's conversation name opens its details). */
  onOpenAbout?: () => void;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const heading = ref.current;
    if (heading === null) return;
    // The collab pane owns the scroll inside a place (`CollabFrame`).
    const root = heading.closest<HTMLElement>('[data-v2-scroller]');
    const box = heading.getBoundingClientRect();
    const frame = root?.getBoundingClientRect();
    setSpaceTitleOnScreen(
      box.bottom > (frame?.top ?? 0) && box.top < (frame?.bottom ?? window.innerHeight),
    );
    const observer = new IntersectionObserver(
      ([entry]) => setSpaceTitleOnScreen(entry.isIntersecting),
      { root },
    );
    observer.observe(heading);
    return () => {
      observer.disconnect();
      setSpaceTitleOnScreen(false);
    };
  }, []);

  return (
    <h1
      ref={ref}
      className="flex min-w-0 items-start gap-2 text-xl font-semibold leading-snug tracking-tight text-foreground md:text-2xl"
    >
      {onOpenAbout ? (
        <button
          type="button"
          onClick={onOpenAbout}
          aria-haspopup="dialog"
          className={cn(
            'v2-interactive -mx-1 inline-flex min-w-0 items-start gap-1 rounded-md px-1 text-left transition-colors hover:text-foreground/80',
            FOCUS_RING,
          )}
        >
          <span className="min-w-0 truncate md:line-clamp-2 md:whitespace-normal md:break-words" title={name}>
            {name}
          </span>
          <span className="sr-only">, about this space</span>
          <ChevronRight
            aria-hidden
            className="mt-1.5 size-4 shrink-0 text-muted-foreground md:mt-2"
          />
        </button>
      ) : (
        <span className="min-w-0 truncate md:line-clamp-2 md:whitespace-normal md:break-words" title={name}>
          {name}
        </span>
      )}
    </h1>
  );
}

/**
 * The owner's description, then Stay's lines on a shared space. Two muted
 * paragraphs; `text-pretty` so neither ends on one orphaned word. Printed in
 * the details sheet (`SpaceAboutSheet`) since the top of the page lost them.
 */
export function SpaceAbout({
  description,
  principle,
}: {
  description: string | null;
  principle: string | null;
}) {
  const text = description?.trim() || null;
  if (text === null && principle === null) return null;
  return (
    <div className="mt-3 max-w-2xl space-y-1.5">
      {text ? (
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{text}</p>
      ) : null}
      {principle ? (
        <p className="text-pretty text-sm leading-relaxed text-foreground/80">{principle}</p>
      ) : null}
    </div>
  );
}
