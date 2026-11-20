'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { isAxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import { useV2Session } from '@/v2/runtime/session-context';
import type { DiscoverableSpace } from '@/types/collab';
import { useCancelJoinRequest, useJoinPublicSpace } from '@/v2/features/invites/queries';
import { spaceLimitOf } from '@/lib/utils/space-limit';
import { PlansLink } from '@/v2/features/files/PlansLink';
import { CANCEL_FAILED, discoverAction, joinErrorCode, joinOpensSpace, joinRefusal, type Refusal } from './discover-model';

/**
 * The way into a public Space: Open for a member, Join for anyone else, and
 * "Request sent" with a way to take it back while the Owner decides. Shared by
 * a Discover card and a public Space's own page for someone not in it (Lucy's
 * walk, 16 November 2026), so both say and do the same thing.
 *
 * A join that lets them in opens the Space; on the Space's own page that is
 * the page they are on, and the join's re-read of the Space draws it whole.
 */
export function SpaceJoinAction({
  space,
  className,
}: {
  space: Pick<DiscoverableSpace, 'uuid' | 'kind' | 'my_status' | 'is_member'>;
  className?: string;
}) {
  const router = useRouter();
  const join = useJoinPublicSpace();
  const cancel = useCancelJoinRequest();
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const action = discoverAction(space);
  // A guest pass is signed in too; it is not an account.
  const { signedIn, role } = useV2Session();
  const hasAccount = signedIn && role !== 'guest' && role !== 'bot';

  const cancelRequest = () => {
    setRefusal(null);
    cancel.mutate(space.uuid, { onError: () => setRefusal(CANCEL_FAILED) });
  };

  const press = () => {
    setRefusal(null);
    join.mutate(space.uuid, {
      // A request (someone the Owner removed or turned down) stays here: the
      // list is read again and the card shows "Request sent".
      onSuccess: (outcome) => {
        if (outcome === 'joined') router.push(`/spaces/${space.uuid}`);
      },
      onError: (error) => {
        const response = isAxiosError<{ message?: string }>(error) ? error.response : undefined;
        if (joinOpensSpace(response?.status, joinErrorCode(response?.data))) router.push(`/spaces/${space.uuid}`);
        else setRefusal(joinRefusal(response?.status, hasAccount, response?.data?.message, spaceLimitOf(response?.status, response?.data)));
      },
    });
  };

  return (
    <div className={className}>
      {action === 'open' ? (
        <Button asChild variant="outline" size="sm" className="w-full md:w-auto">
          <Link href={`/spaces/${space.uuid}`}>Open</Link>
        </Button>
      ) : action === 'pending' ? (
        // One row: what happened on the left, the way to take it back on the
        // right. The helper line is the phone's; on desktop the row is short.
        <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 py-1.5 pr-1 pl-3 md:gap-2 md:bg-transparent md:p-0">
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Check aria-hidden className="size-4 shrink-0 text-primary" />
              Request sent
            </span>
            <span className="truncate text-xs text-muted-foreground md:hidden">
              The owner will let you in.
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="v2-interactive shrink-0"
            disabled={cancel.isPending}
            onClick={cancelRequest}
          >
            {cancel.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Cancel request
          </Button>
        </div>
      ) : (
        <Button size="sm" className="w-full md:w-auto" disabled={join.isPending} onClick={press}>
          {join.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Join
        </Button>
      )}
      {refusal ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {refusal.text}
          {refusal.offerAccount ? (
            <>
              {' '}
              <Link href="/register" className="font-medium text-primary underline">
                Create an account
              </Link>
            </>
          ) : null}
          {refusal.offerPlans ? (
            <>
              {' '}
              <PlansLink className="text-primary" />
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
