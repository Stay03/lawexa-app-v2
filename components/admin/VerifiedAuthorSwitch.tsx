'use client';

import { useId } from 'react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSetUserVerifiedAuthor } from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import { VERIFIED_AUTHOR_HINT, verifiedAuthorToast } from './verified-author-model';

/**
 * "Verified author" on the admin user page (Arthur's B, 31 October 2026): an
 * admin marks someone as a verified author, or not, themselves
 * (`PUT /users/{uuid}/verified-author`). The switch holds while the request is
 * out, and the server's answer sets it. The admin pages have no global
 * mutation error toast, so a refusal says the server's message here.
 */
export function VerifiedAuthorSwitch({
  uuid,
  name,
  isVerifiedAuthor,
}: {
  uuid: string;
  name: string;
  isVerifiedAuthor: boolean;
}) {
  const id = useId();
  const mutation = useSetUserVerifiedAuthor();
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        checked={isVerifiedAuthor}
        disabled={mutation.isPending}
        aria-describedby={`${id}-hint`}
        onCheckedChange={(next) =>
          mutation.mutate(
            { uuid, isVerifiedAuthor: next },
            {
              onSuccess: () => toast.success(verifiedAuthorToast(name, next)),
              onError: (error) => toast.error(extractApiError(error).message),
            }
          )
        }
        className="mt-0.5"
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          Verified author
        </Label>
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted-foreground">
          {VERIFIED_AUTHOR_HINT}
        </p>
      </div>
    </div>
  );
}
