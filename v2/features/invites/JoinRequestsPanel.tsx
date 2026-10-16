'use client';

import { useId, useState } from 'react';
import { Loader2, UserCheck, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { JoinRequest } from '@/types/collab';
import type { InvitableContentRole } from '@/v2/features/collab/membership/content-role';
import { SHARED_INVITE_ROLES } from '@/v2/features/collab/membership/invite-roles';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { RoleSelect } from '@/v2/features/collab/membership/RoleSelect';
import { joinRequestStartRole } from './join-role';
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
 * ── ON A SHARED SPACE THE OWNER PICKS THE ROLE (16 October 2026) ───────────
 * Each request carries a Contributor | Viewer choice, the invite dialog's own
 * `RoleSelect`, starting on what approving with no role would give
 * (`joinRequestStartRole`: Contributor unless the Owner's own link said
 * Viewer). "Let them in" always sends the role on screen, so the Owner gives
 * exactly what they see.
 *
 * ── EVERY DECISION IS ADDRESSED BY THE ROW'S OWN `id` ──────────────────────
 * Read from the response, never constructed. The API shipped once without that
 * field and thirty passing tests missed it, because a test keeps the id it
 * created and never reads one back the way this screen has to.
 */

function RequestRow({
  request,
  contentRoles,
  deciding,
  onDecide,
}: {
  request: JoinRequest;
  /** A shared space: the Owner picks the role saying yes gives. */
  contentRoles: boolean;
  deciding: boolean;
  onDecide: (approve: boolean, contentRole?: InvitableContentRole) => void;
}) {
  const channel = request.also_joins_channel;
  const roleId = useId();
  const [role, setRole] = useState<InvitableContentRole>(() =>
    joinRequestStartRole(request.approves_as),
  );
  const decide = (approve: boolean) => onDecide(approve, contentRoles ? role : undefined);
  return (
    <li className="rounded-xl border border-border/60 p-3">
      {/* TWO COMPACT BUTTONS AT THE END OF THE ROW. A full-width "Let them in"
          read as "a mess" on desktop (Stay, 15 October 2026). A plain request
          is one line on a wide screen; on a phone the role choice and the
          buttons wrap under the name, still compact, at the right. A request
          that also opens a channel keeps its sentence ABOVE the buttons (the
          rule below), so there the buttons always sit under it. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          <MemberAvatar user={request.user} className="size-8 shrink-0" />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {request.user.name}
          </p>
        </div>
        {contentRoles ? (
          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor={roleId} className="text-xs text-muted-foreground">
              Joins as
            </label>
            <div className="w-36">
              <RoleSelect id={roleId} value={role} roles={SHARED_INVITE_ROLES} onChange={setRole} />
            </div>
          </div>
        ) : null}
        {channel ? null : (
          <DecideButtons channel={false} deciding={deciding} onDecide={decide} />
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
            <DecideButtons channel deciding={deciding} onDecide={decide} />
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
      <Button size="sm" disabled={deciding} onClick={() => onDecide(true)}>
        {deciding ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <UserCheck aria-hidden className="size-4" />
        )}
        {channel ? 'Let them in, and into the channel' : 'Let them in'}
      </Button>
      <Button size="sm" variant="outline" disabled={deciding} onClick={() => onDecide(false)}>
        <UserX aria-hidden className="size-4" />
        Decline
      </Button>
    </div>
  );
}

function Panel({
  rows,
  contentRoles = false,
  pending,
  deciding,
  onDecide,
  emptyLine,
}: {
  rows: readonly JoinRequest[];
  contentRoles?: boolean;
  pending: boolean;
  deciding: boolean;
  onDecide: (id: number, approve: boolean, contentRole?: InvitableContentRole) => void;
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
          contentRoles={contentRoles}
          deciding={deciding}
          onDecide={(approve, contentRole) => onDecide(request.id, approve, contentRole)}
        />
      ))}
    </ul>
  );
}

/** `contentRoles` on a SHARED space: the Owner picks each request's role. */
export function SpaceJoinRequestsPanel({
  spaceUuid,
  contentRoles = false,
}: {
  spaceUuid: string;
  contentRoles?: boolean;
}) {
  const query = useSpaceJoinRequests(spaceUuid);
  const decide = useDecideJoinRequest('space', spaceUuid);
  return (
    <Panel
      rows={query.data?.data ?? []}
      contentRoles={contentRoles}
      pending={query.isPending}
      deciding={decide.isPending}
      onDecide={(id, approve, contentRole) => decide.mutate({ id, approve, contentRole })}
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
