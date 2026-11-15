'use client';

import { cn } from '@/lib/utils';
import { spaceLimitFromError } from '@/lib/utils/space-limit';
import { PlansLink } from '@/v2/features/files/PlansLink';

/**
 * Why a link could not be made, where it was asked for. A Space full for its
 * owner's plan (organisation plans) says the server's sentence, which names
 * the plan and the limit, with the way to the plans; anything else is still
 * worth one more press.
 */
export function LinkRefusal({ error, className }: { error: unknown; className?: string }) {
  const limit = spaceLimitFromError(error);
  return (
    <p role="alert" className={cn('text-destructive', className)}>
      {limit ? (
        <>
          {limit.message} <PlansLink />
        </>
      ) : (
        <>That didn&rsquo;t work. Try again.</>
      )}
    </p>
  );
}
