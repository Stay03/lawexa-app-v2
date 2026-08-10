'use client';

import { Loader2, UserCheck, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { JoinRequest } from '@/types/collab';
import {
  useChannelJoinRequests,
  useDecideJoinRequest,
  useSpaceJoinRequests,
} from './queries';

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
    <li className="rounded-xl border border-border/60 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-8 shrink-0">
          {request.user.avatar_url ? (
            <AvatarImage src={request.user.avatar_url} alt="" />
          ) : null}
          <AvatarFallback>{request.user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {request.user.name}
        </p>
      </div>

      {/* SAID BEFORE THE PRESS, NEVER AFTER. See the docblock. */}
      {channel ? (
        <p className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground">
          Saying yes also lets them into <strong>#{channel.name}</strong>, which
          is not open to the whole space.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={deciding}
          onClick={() => onDecide(true)}
        >
          {deciding ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <UserCheck aria-hidden className="size-4" />
          )}
          {channel ? 'Let them in, and into the channel' : 'Let them in'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={deciding}
          onClick={() => onDecide(false)}
        >
          <UserX aria-hidden className="size-4" />
          No
        </Button>
      </div>
    </li>
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
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{emptyLine}</p>
    );
  }
  return (
    <ul className="space-y-3">
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
