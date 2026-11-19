'use client';

import { X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { AllowedIn } from '@/types/private-items';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useRevokeGrant } from './queries';

/**
 * "Always used in: <Space> ×" (Stay, thread 9ae498ae, 19 November 2026): the
 * Spaces where the owner said "always in this Space". Only the owner sees it,
 * and only the owner can take it away. After ×, Lawexa asks again next time.
 */
export function AllowedInChips({ allowedIn, itemName }: { allowedIn: readonly AllowedIn[]; itemName: string }) {
  const revoke = useRevokeGrant();
  if (allowedIn.length === 0) return null;
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] leading-snug text-muted-foreground">
      <span>Always used in:</span>
      {allowedIn.map((grant) => {
        const going = revoke.isPending && revoke.variables === grant.grant_uuid;
        return (
          <span
            key={grant.grant_uuid}
            className={cn(
              'inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-0.5 pl-2.5 text-foreground transition-opacity duration-150',
              going && 'opacity-50',
            )}
          >
            {grant.space.name}
            <button
              type="button"
              disabled={going}
              aria-label={`Stop always using ${itemName} in ${grant.space.name}`}
              onClick={() =>
                revoke.mutate(grant.grant_uuid, {
                  onSuccess: () => toast.success(`Lawexa will ask again before using ${itemName} in ${grant.space.name}.`),
                  onError: (error) => toast.error(extractApiError(error).message),
                })
              }
              className={cn(
                'v2-interactive flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground',
                FOCUS_RING,
              )}
            >
              <X aria-hidden className="size-3" />
            </button>
          </span>
        );
      })}
    </span>
  );
}
