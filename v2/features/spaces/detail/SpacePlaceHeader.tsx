'use client';

import { Lock, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
 * The destructive verbs stay behind the overflow, and Delete is owner-only.
 * The confirmation itself is NOT in the URL: a shareable, refresh-surviving
 * link that re-opens "Delete this space?" is an armed trigger.
 */
export function SpacePlaceHeader({
  space,
  members,
  canManage,
  isOwner,
  onCreateChannel,
  onOpenRoster,
  onEdit,
  onInvites,
  onRequests,
  onDelete,
}: {
  space: Space;
  members: readonly Member[];
  canManage: boolean;
  isOwner: boolean;
  onCreateChannel: () => void;
  onOpenRoster: () => void;
  onEdit: () => void;
  onInvites: () => void;
  onRequests: () => void;
  onDelete: () => void;
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
          <h1 className="mt-1 flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <span className="min-w-0 truncate">{space.name}</span>
            {space.is_private ? (
              <Lock
                aria-label="Private space"
                className="size-4 shrink-0 text-muted-foreground"
              />
            ) : null}
          </h1>
        </div>

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="v2-interactive size-8 shrink-0"
                aria-label="Space settings"
              >
                <MoreHorizontal aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onInvites}>Invite by link</DropdownMenuItem>
              <DropdownMenuItem onClick={onRequests}>Waiting to join</DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil aria-hidden className="size-4" />
                Edit space
              </DropdownMenuItem>
              {isOwner ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 aria-hidden className="size-4" />
                    Delete space
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
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
