'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ChannelJoinRequestsPanel } from './JoinRequestsPanel';

/**
 * ChannelJoinRequestsSheet — the other end of "Ask to join".
 *
 * ── WHY THIS EXISTS, WHICH IS ALSO WHY IT SHOULD HAVE EXISTED SOONER ───────
 * The space queue was mounted on the space screen the day it was built. The
 * channel queue was written at the same time and mounted NOWHERE, which nobody
 * noticed because nothing on the member side could put a row in it yet. Adding
 * "Ask to join" to a private channel is exactly what makes that a fault: the
 * request would leave, the server would take it, an admin would be notified —
 * and there would be no screen in the app that could open it.
 *
 * The lesson is small and worth keeping: a queue is half a feature. The half
 * that ASKS and the half that DECIDES ship together or the asking is a lie.
 *
 * Presentation only — the panel owns its query and its two mutations, and the
 * caller owns the URL overlay so Back closes it like every other panel.
 */
export function ChannelJoinRequestsSheet({
  channelUuid,
  channelName,
  open,
  onOpenChange,
}: {
  channelUuid: string;
  channelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* THE WIDTH MUST BE VARIANT-MATCHED OR IT IS A DEAD CLASS. `SheetContent`
          sizes itself with `data-[side=right]:w-3/4`, and an attribute selector
          outranks a bare `w-full` written later — so a sheet that means to fill
          a phone has to say so in the same shape. Without it this queue opened
          at three quarters of the screen with the page showing down one side,
          which is the one thing phase 7 exists to remove. */}
      <SheetContent
        side="right"
        className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Waiting to join</SheetTitle>
          <SheetDescription>
            People who asked to be let into {channelName}.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ChannelJoinRequestsPanel channelUuid={channelUuid} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
