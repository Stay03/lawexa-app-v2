'use client';

import { Pencil, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Space } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { memberCountLabel, spacePrincipleLine, type MembershipSubject } from '../model';
import { SpaceAbout } from './SpacePlaceHeader';

/**
 * SpaceAboutSheet — what the space IS, on the surface its name opens.
 *
 * The top of the space page became one row (Stay, 15 October 2026: "it takes
 * too much space at the top and makes things messy"), and the techlead kept
 * the information rather than dropping it: the owner's description and Stay's
 * lines on a shared space live here, whole, behind a tap on the name. The
 * channel screen's `ChannelAboutSheet` is the same surface for a channel.
 *
 * It is a `?panel=about` value of the page's own overlay, so Back closes it
 * and a copied link opens it. The member count is a line, not a door: the
 * People tab is one tap away under the page's own tab strip, and closing an
 * overlay while switching the tab would race the page's Back handling.
 *
 * EDIT SPACE IS HERE TOO (techlead, 16 October 2026): Arthur opened this sheet
 * from the name looking for a way to edit the space and found none. For
 * whoever may manage the space, `onEdit` opens the edit form. It is the same
 * `?panel=` param, so the form takes this sheet's place in one history entry
 * and Back closes it, rather than reopening this sheet.
 */
export function SpaceAboutSheet({
  space,
  membership,
  onEdit,
  open,
  onOpenChange,
}: {
  space: Space;
  membership: MembershipSubject;
  /** Opens the edit form; absent for anyone who may not manage the space. */
  onEdit?: () => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Bottom, as the channel's: a detail about the place being read, where
          a thumb reaches on a phone. */}
      <SheetContent
        side="bottom"
        className="v2-safe-bottom max-h-[85svh] gap-0 overflow-y-auto rounded-t-2xl p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-1">
          <div className="flex items-center gap-3">
            <SpaceCrest
              uuid={space.uuid}
              name={space.name}
              type={space.type}
              size="sm"
              className="size-10 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <SheetTitle className="line-clamp-2 text-left text-base">{space.name}</SheetTitle>
              <SheetDescription className="truncate text-left text-xs">{space.type_label}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-5 pb-6">
          <SpaceAbout
            description={space.description}
            principle={spacePrincipleLine({
              kind: space.kind,
              my_content_role: membership.my_content_role,
            })}
          />
          <p className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
            <Users aria-hidden className="size-4 shrink-0" />
            {memberCountLabel(space.active_members_count)}
          </p>
          {onEdit ? (
            <Button type="button" variant="secondary" onClick={onEdit} className="w-full md:w-auto">
              <Pencil aria-hidden className="size-4" />
              Edit space
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
