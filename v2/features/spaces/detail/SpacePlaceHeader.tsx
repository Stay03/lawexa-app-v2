'use client';

import { Lock, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Member, Space } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { PresenceStack } from '@/v2/features/collab/kit/PresenceStack';
import { memberCountLabel, spaceOwnerLabel } from '../model';

/**
 * SpacePlaceHeader — the identity block at the top of the space lobby.
 *
 * ── IT LEADS WITH THE PLACE, NOT WITH A DOCUMENT ───────────────────────────
 * The shipped header was the case page's grammar — a grey type tile, a kicker,
 * an `h1`, a kebab — which reads as "a record about a space". A space is a
 * PLACE, so it leads with the crest at 48px (the same monogram and the same
 * hue the reader has already seen on the `/spaces` lane, in the rail beside
 * this page and in the channel header afterwards), and the people are FACES
 * rather than the words "4 members" behind a text button.
 *
 * ── THE PRIMARY ACTION IS A PRIMARY BUTTON ─────────────────────────────────
 * "New channel" used to be a ghost button in a section heading — the quietest
 * control on a page whose entire purpose is to have channels in it. It stands
 * here, at full weight, for anyone who may use it, and is simply absent for
 * anyone who may not (a button that only 403s is worse than none).
 *
 * ── THE OVERFLOW LEFT THIS BLOCK (phase 7) ─────────────────────────────────
 * Invite by link, Waiting to join, Edit space and Delete space sat behind a
 * kebab at y183, under a shell bar that already carried one at the top right:
 * two identical glyphs on one phone screen, holding two different menus. They
 * are published to the bar's single overflow now (`SpaceScreen`, through
 * `v2/shell/screen-context.ts`), Delete still owner-only and still confirmed by
 * a dialog whose open state is deliberately NOT in the URL — a shareable,
 * refresh-surviving link that re-opens "Delete this space?" is an armed trigger.
 *
 * ── AND THE NAME IS PRINTED ONCE PER WIDTH ─────────────────────────────────
 * Below `md:` the shell's bar carries the crest and the space's name, so this
 * `h1` is stated for assistive tech and drawn only from `md:` up. The lock rides
 * with it, and its `aria-label` is inside the heading, so "Private space" is
 * still announced at every width.
 */
export function SpacePlaceHeader({
  space,
  members,
  canManage,
  onCreateChannel,
  onOpenRoster,
}: {
  space: Space;
  members: readonly Member[];
  canManage: boolean;
  onCreateChannel: () => void;
  onOpenRoster: () => void;
}) {
  const countLabel = memberCountLabel(space.active_members_count);

  return (
    <header className="border-b pb-5">
      <div className="flex items-start gap-4">
        <SpaceCrest
          uuid={space.uuid}
          name={space.name}
          type={space.type}
          size="lg"
        />

        <div className="min-w-0 flex-1">
          <MetaLine lead={[space.type_label, spaceOwnerLabel(space)]} />
          <h1 className="sr-only md:not-sr-only md:mt-1 md:flex md:min-w-0 md:items-center md:gap-2 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
            <span className="min-w-0 md:truncate">{space.name}</span>
            {/* The glyph is decorative and `display:none` below `md:`, so the
                fact is carried by a WORD that survives at every width. An
                `aria-label` on the icon would have gone silent with it. */}
            {space.is_private ? (
              <>
                <Lock
                  aria-hidden
                  className="hidden size-4 shrink-0 text-muted-foreground md:block"
                />
                <span className="sr-only">Private space</span>
              </>
            ) : null}
          </h1>
        </div>
      </div>

      {space.description ? (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {space.description}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PresenceStack
          members={members.map((member) => member.user)}
          total={space.active_members_count}
          countLabel={countLabel}
          label={`${countLabel} in ${space.name}`}
          size="md"
          onClick={onOpenRoster}
        />
        {canManage ? (
          <Button size="sm" className="v2-interactive" onClick={onCreateChannel}>
            <Plus aria-hidden className="size-4" />
            New channel
          </Button>
        ) : null}
      </div>
    </header>
  );
}
