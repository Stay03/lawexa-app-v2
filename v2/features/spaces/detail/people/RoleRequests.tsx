'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, UserCheck, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { Member } from '@/types/collab';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  useAskToContribute,
  useDecideRoleRequest,
  useWithdrawContributeRequest,
} from '../../mutations';
import { spacesQueries } from '../../queries';

/**
 * A Viewer asks to become a Contributor, and the Owner says yes or no (backend,
 * 16 October 2026; Arthur's joining changes, part 2).
 *
 * The ask lives on the reader's own row in the members list
 * (`requested_content_role`, "editor" while open), which every member may read
 * but which the server fills only on the reader's own row, and on every row for
 * the Owner. So the Viewer's control reads their own row, and the Owner's list
 * is the members list narrowed to the open asks (`?requests=1`, Owner only).
 *
 * Failures are said inline, under the control that produced them, never in a
 * toast (the mutations are `silentError`).
 */

/** The Viewer's control, at the top of the People tab where an Owner has
 *  Invite: "Ask to contribute", or "Request sent" with a way to take it back. */
export function ContributeAsk({ spaceUuid, ownRow }: { spaceUuid: string; ownRow: Member | null }) {
  const ask = useAskToContribute(spaceUuid);
  const withdraw = useWithdrawContributeRequest(spaceUuid);
  const open = ownRow?.requested_content_role === 'editor';
  const failure = ask.error ?? withdraw.error;
  return (
    <div className="flex flex-col items-end gap-1">
      {open ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Check aria-hidden className="size-4 text-primary" />
            Request sent
          </span>
          <Button
            variant="outline"
            size="sm"
            className="v2-interactive"
            disabled={withdraw.isPending}
            onClick={() => {
              ask.reset();
              withdraw.mutate();
            }}
          >
            {withdraw.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Withdraw request
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          className="v2-interactive"
          disabled={ask.isPending}
          onClick={() => {
            withdraw.reset();
            ask.mutate();
          }}
        >
          {ask.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Ask to contribute
        </Button>
      )}
      {failure ? (
        <p role="alert" className="text-xs text-destructive">
          {extractApiError(failure).message}
        </p>
      ) : null}
    </div>
  );
}

/** The Owner's list of open asks, above "Needs your approval". Nothing at all
 *  while nobody has asked. */
export function RoleRequestsSection({ spaceUuid }: { spaceUuid: string }) {
  const session = useV2Session();
  const query = useQuery(
    spacesQueries.members(spaceUuid, { viewerId: session.userId, requests: true }),
  );
  const decide = useDecideRoleRequest(spaceUuid);
  const rows = (query.data?.data ?? []).filter((member) => member.requested_content_role === 'editor');
  if (rows.length === 0) return null;
  return (
    // Fades in: on a cold cache the list can land after the members.
    <section
      aria-labelledby="space-people-role-requests"
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <h2
        id="space-people-role-requests"
        className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Wants to contribute
      </h2>
      <ul className="space-y-3">
        {rows.map((member) => {
          const deciding = decide.isPending && decide.variables?.memberId === member.id;
          return (
            <li key={member.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
                  <MemberAvatar user={member.user} className="size-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{member.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Viewer, asks to be a Contributor
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ memberId: member.id, approve: true })}
                  >
                    {deciding && decide.variables?.approve ? (
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                    ) : (
                      <UserCheck aria-hidden className="size-4" />
                    )}
                    Allow
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ memberId: member.id, approve: false })}
                  >
                    <UserX aria-hidden className="size-4" />
                    Decline
                  </Button>
                </div>
              </div>
              {decide.error && decide.variables?.memberId === member.id ? (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {extractApiError(decide.error).message}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
