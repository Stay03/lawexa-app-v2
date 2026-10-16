'use client';

import { Loader2, UserCheck, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { JoinRequest } from '@/types/collab';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import {
  useChannelJoinRequests,
  useDecideJoinRequest,
  useSpaceJoinRequests,
} from './queries';
import {
  REQUEST_AVATAR,
  REQUEST_BUTTON,
  REQUEST_ICON,
  REQUEST_ITEM,
  REQUEST_LINE,
  REQUEST_LIST,
  REQUEST_NAME,
} from './request-row';

/**
 * JoinRequestsPanel — who is waiting, and the two buttons that decide.
 *
 * ── THE ONE THING THIS SCREEN MUST NOT GET WRONG ───────────────────────────
 * A request that came through a link naming a channel carries
 * `also_joins_channel`, and approving it grants THAT CHANNEL TOO. An admin
 * reading "wants to join the space" would be handing out access to a private
 * channel they never agreed to open. So when the field is present it is stated
 * on the row, above the buttons, in the sentence the admin is about to act on
 * — not in a tooltip, and not after the fact.
 *
 * ── NO ROLE PICKER: THE SERVER'S DEFAULT (Stay, 16 October 2026) ──────────
 * A shared space's request is one plain row, and "Let them in" sends no
 * role, so the server gives its default: Contributor, or Viewer when the
 * person came through the Owner's own Viewer link (`approves_as`). A picker
 * on every row was "an atrocious design" for a choice Stay had already made
 * ("Contributor by default"). The Owner changes a role afterwards from the
 * member's own row.
 *
 * ── EVERY DECISION IS ADDRESSED BY THE ROW'S OWN `id` ──────────────────────
 * Read from the response, never constructed. The API shipped once without that
 * field and thirty passing tests missed it, because a test keeps the id it
 * created and never reads one back the way this screen has to.
 */

function RequestRow({
  request,
  deciding,
  onDecide,
}: {
  request: JoinRequest;
  deciding: boolean;
  onDecide: (approve: boolean) => void;
}) {
  const channel = request.also_joins_channel;
  return (
    <li className={REQUEST_ITEM}>
      {/* TWO COMPACT BUTTONS AT THE END OF THE ROW. A full-width "Let them in"
          read as "a mess" on desktop (Stay, 15 October 2026). A plain request
          is one line: on a phone a roster row with small pills, on a wide
          screen a card (`request-row.ts`). A request that also opens a
          channel keeps its sentence ABOVE the buttons (the rule below), so
          there the buttons always sit under it. */}
      <div className={REQUEST_LINE}>
        <div className={REQUEST_NAME}>
          <MemberAvatar user={request.user} className={REQUEST_AVATAR} />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {request.user.name}
          </p>
        </div>
        {channel ? null : (
          <DecideButtons channel={false} deciding={deciding} onDecide={onDecide} />
        )}
      </div>

      {/* SAID BEFORE THE PRESS, NEVER AFTER. See the docblock. */}
      {channel ? (
        <>
          <p className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground">
            Saying yes also lets them into <strong>#{channel.name}</strong>, which
            is not open to the whole space.
          </p>
          <div className="mt-3 flex justify-end">
            <DecideButtons channel deciding={deciding} onDecide={onDecide} />
          </div>
        </>
      ) : null}
    </li>
  );
}

/** The two decisions, compact, side by side. */
function DecideButtons({
  channel,
  deciding,
  onDecide,
}: {
  /** Saying yes also opens a channel: the button says so. */
  channel: boolean;
  deciding: boolean;
  onDecide: (approve: boolean) => void;
}) {
  return (
    <div className="ml-auto flex shrink-0 gap-2">
      <Button
        size="sm"
        className={REQUEST_BUTTON}
        disabled={deciding}
        onClick={() => onDecide(true)}
      >
        {deciding ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <UserCheck aria-hidden className={REQUEST_ICON} />
        )}
        {channel ? 'Let them in, and into the channel' : 'Let them in'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={REQUEST_BUTTON}
        disabled={deciding}
        onClick={() => onDecide(false)}
      >
        <UserX aria-hidden className={REQUEST_ICON} />
        Decline
      </Button>
    </div>
  );
}

function Panel({
  rows,
  pending,
  deciding,
  onDecide,
  emptyLine,
}: {
  rows: readonly JoinRequest[];
  pending: boolean;
  deciding: boolean;
  onDecide: (id: number, approve: boolean) => void;
  emptyLine: string;
}) {
  if (pending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-xl md:h-24" />
        <Skeleton className="h-11 w-full rounded-xl md:h-24" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{emptyLine}</p>
    );
  }
  return (
    <ul className={REQUEST_LIST}>
      {rows.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          deciding={deciding}
          onDecide={(approve) => onDecide(request.id, approve)}
        />
      ))}
    </ul>
  );
}

/** A space's waiting list. On a shared space approving gives the server's
 *  default role (see the docblock). */
export function SpaceJoinRequestsPanel({ spaceUuid }: { spaceUuid: string }) {
  const query = useSpaceJoinRequests(spaceUuid);
  const decide = useDecideJoinRequest('space', spaceUuid);
  return (
    <Panel
      rows={query.data?.data ?? []}
      pending={query.isPending}
      deciding={decide.isPending}
      onDecide={(id, approve) => decide.mutate({ id, approve })}
      emptyLine="Nobody is waiting to join."
    />
  );
}

export function ChannelJoinRequestsPanel({
  channelUuid,
}: {
  channelUuid: string;
}) {
  const query = useChannelJoinRequests(channelUuid);
  const decide = useDecideJoinRequest('channel', channelUuid);
  return (
    <Panel
      rows={query.data?.data ?? []}
      pending={query.isPending}
      deciding={decide.isPending}
      onDecide={(id, approve) => decide.mutate({ id, approve })}
      emptyLine="Nobody is waiting for this channel."
    />
  );
}
