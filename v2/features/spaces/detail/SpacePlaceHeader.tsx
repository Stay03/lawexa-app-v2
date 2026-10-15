'use client';

import { useLayoutEffect, useRef } from 'react';
import { ChevronRight, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Space } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { setSpaceTitleOnScreen } from '@/v2/features/collab/shell/collab-header';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  showsPrivateMark,
  spaceOwnerLabel,
  spacePrincipleLine,
  spaceRoleLabel,
  type MembershipSubject,
} from '../model';

/**
 * SpacePlaceHeader — the identity block at the top of the space page.
 *
 * ── IT LEADS WITH THE PLACE, NOT WITH A DOCUMENT ───────────────────────────
 * The shipped header was the case page's grammar — a grey type tile, a kicker,
 * an `h1`, a kebab — which reads as "a record about a space". A space is a
 * PLACE, so it leads with the crest at 48px (the same monogram and the same
 * hue the reader has already seen on the `/spaces` lane, in the rail beside
 * this page and in the channel header afterwards).
 *
 * ── ONE ROW, AND THE REST BEHIND THE NAME (Stay, 15 October 2026) ──────────
 * "I also dont like the top of the space page, it takes too much space at the
 * top and makes things messy, remove the members from there since there will
 * now be a tab for that." So the block is the crest, the kicker and the name,
 * nothing under them: the faces and their count went to the People tab, New
 * channel to the Channels tab, and the description and Stay's lines to the
 * details sheet the name opens (`SpaceAboutSheet`), the way a chat app opens a
 * conversation's details from its name. A space with nothing to say beyond
 * its name keeps a plain heading (`spaceHasAbout`).
 *
 * ── WHO YOU ARE HERE, AND HOW THE SPACE WORKS (design round 1) ─────────────
 * The kicker ends with the viewer's role ("Work · You're a viewer"), so a
 * Viewer knows before trying that they cannot add. On a shared space Stay's
 * two lines sit under the description, full or empty: "Members can add to this
 * space. What's here is organised for the whole team." A Viewer reads who adds
 * instead, because the first line is not true for them (`spacePrincipleLine`).
 * The word "Personal" left the kicker (`spaceOwnerLabel`), and so did the lock
 * on a shared space, which is always private and so said nothing.
 *
 * ── THE NAME IS PRINTED IN FULL AT EVERY WIDTH ─────────────────────────────
 * Below `md:` the heading used to be stated for assistive tech only, with the
 * name in the shell's bar, cut to about 190px: a law firm's matter names were
 * never readable on a phone. It now wraps to two lines at every width, and
 * the bar's title steps back while this heading is on screen
 * (`setSpaceTitleOnScreen`), so the name and the crest are not printed twice.
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
}: {
  space: Space;
  /** The viewer's roles, the frame's one reading of them. */
  membership: MembershipSubject;
  /** Opens the space's details sheet (the description, Stay's lines). */
  onOpenAbout: () => void;
}) {
  const hasAbout = spaceHasAbout(space, membership);

  return (
    <header className="border-b pb-4">
      <div className="flex items-start gap-4">
        <SpaceCrest uuid={space.uuid} name={space.name} type={space.type} size="lg" />

        <div className="min-w-0 flex-1">
          <MetaLine
            lead={[space.type_label, spaceOwnerLabel(space), spaceRoleLabel(membership)]}
          />
          <SpaceHeading
            name={space.name}
            privateMark={showsPrivateMark(space)}
            onOpenAbout={hasAbout ? onOpenAbout : undefined}
          />
        </div>
      </div>
    </header>
  );
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
 * The space's name as the page's `h1`, at every width, on up to two lines.
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
  privateMark,
  onOpenAbout,
}: {
  name: string;
  /** A team space that is private: the lock, and the words for it. */
  privateMark: boolean;
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
      className="mt-1 flex min-w-0 items-start gap-2 text-xl font-semibold leading-snug tracking-tight text-foreground md:text-2xl"
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
          <span className="line-clamp-2 min-w-0 break-words" title={name}>
            {name}
          </span>
          <span className="sr-only">, about this space</span>
          <ChevronRight
            aria-hidden
            className="mt-1.5 size-4 shrink-0 text-muted-foreground md:mt-2"
          />
        </button>
      ) : (
        <span className="line-clamp-2 min-w-0 break-words" title={name}>
          {name}
        </span>
      )}
      {privateMark ? (
        <>
          <Lock
            aria-hidden
            className="mt-1.5 size-4 shrink-0 text-muted-foreground md:mt-2"
          />
          <span className="sr-only">Private space</span>
        </>
      ) : null}
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
