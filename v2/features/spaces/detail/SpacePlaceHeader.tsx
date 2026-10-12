'use client';

import { useLayoutEffect, useRef } from 'react';
import { Lock, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Member, Space } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { PresenceStack } from '@/v2/features/collab/kit/PresenceStack';
import { setSpaceTitleOnScreen } from '@/v2/features/collab/shell/collab-header';
import {
  memberCountLabel,
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
 * this page and in the channel header afterwards), and the people are FACES,
 * followed by their count in words so the stack reads as the door to the
 * members sheet it is.
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
 * ── THE PRIMARY ACTION IS A PRIMARY BUTTON ─────────────────────────────────
 * "New channel" stands here at full weight for anyone who may use it, and is
 * absent for anyone who may not (a button that only 403s is worse than none).
 * From `lg:` the docked rail carries the same action at its foot, so it is
 * shown here only below `lg:`: one of each at every width.
 *
 * ── THE OVERFLOW LEFT THIS BLOCK (phase 7) ─────────────────────────────────
 * The space's verbs are published to the bar's single overflow menu
 * (`SpaceScreen`, through `v2/shell/screen-context.ts`): two identical kebabs
 * on one phone screen, holding two different menus, was the alternative.
 */
export function SpacePlaceHeader({
  space,
  members,
  membership,
  canCreateChannel,
  onCreateChannel,
  onOpenRoster,
}: {
  space: Space;
  members: readonly Member[];
  /** The viewer's roles, the frame's one reading of them. */
  membership: MembershipSubject;
  /** May manage the space AND the space shows its channels to this viewer
   *  (Spaces F2): a shared space has no channels to add one to. */
  canCreateChannel: boolean;
  onCreateChannel: () => void;
  onOpenRoster: () => void;
}) {
  const countLabel = memberCountLabel(space.active_members_count);
  // The faces are the people who are in: an invitee who has not accepted yet
  // is not one of the members the count names.
  const faces = members
    .filter((member) => member.is_active && !member.is_pending)
    .map((member) => member.user);

  return (
    <header className="border-b pb-5">
      <div className="flex items-start gap-4">
        <SpaceCrest uuid={space.uuid} name={space.name} type={space.type} size="lg" />

        <div className="min-w-0 flex-1">
          <MetaLine
            lead={[space.type_label, spaceOwnerLabel(space), spaceRoleLabel(membership)]}
          />
          <SpaceHeading name={space.name} privateMark={showsPrivateMark(space)} />
        </div>
      </div>

      <SpaceAbout
        description={space.description}
        principle={spacePrincipleLine({
          kind: space.kind,
          my_content_role: membership.my_content_role,
        })}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* One stack per width: 40px faces from `md:` up, beside the 24px
            title, and the 32px ones on a phone (design round 2). */}
        <PresenceStack
          members={faces}
          total={space.active_members_count}
          countLabel={countLabel}
          label={`${countLabel} in ${space.name}. Open the members list`}
          size="md"
          withCount
          onClick={onOpenRoster}
          className="md:hidden"
        />
        <PresenceStack
          members={faces}
          total={space.active_members_count}
          countLabel={countLabel}
          label={`${countLabel} in ${space.name}. Open the members list`}
          size="lg"
          withCount
          onClick={onOpenRoster}
          className="hidden md:inline-flex"
        />
        {canCreateChannel ? (
          <Button size="sm" className="v2-interactive lg:hidden" onClick={onCreateChannel}>
            <Plus aria-hidden className="size-4" />
            New channel
          </Button>
        ) : null}
      </div>
    </header>
  );
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
}: {
  name: string;
  /** A team space that is private: the lock, and the words for it. */
  privateMark: boolean;
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
      <span className="line-clamp-2 min-w-0 break-words" title={name}>
        {name}
      </span>
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
 * paragraphs; `text-pretty` so neither ends on one orphaned word. Shared with
 * the silhouette for the same reason as the heading.
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
