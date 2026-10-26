'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Radar as RadarIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import type { CreateRadarPayload, FirstScanResult, Radar } from '@/types/radar';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { RadarForm, type RadarFormHelpers } from '@/v2/features/radars/create/RadarForm';
import { OutOfMessagesNotice } from '@/v2/features/subscription/OutOfMessagesNotice';
import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { canAddContent } from '../../model';
import { spacesQueries } from '../../queries';
import { spaceRadarHref } from './radar-rows';
import { useCreateSpaceRadar } from './use-create-space-radar';

/**
 * SpaceRadarCreateScreen — `/spaces/{uuid}/radars/new` (Radar in Spaces, first
 * part, 26 October 2026): the personal create form, in the space. An Owner or
 * Contributor makes it and it runs at once, with no approval; its reports go
 * to everyone in the space, and the space's owner pays for its scans. No topic
 * suggestions in this part.
 *
 * The outcomes are the personal screen's: created (a toast, then the Radar's
 * screen in the space); created with the first scan stopped for balance (said
 * in the page, with the way on); refused (on the fields, or in the form). The
 * balance that stops a scan is the PAYER'S: when that is the space's owner and
 * not the reader, the reader cannot buy their way past it, so the page says
 * whose it is and offers no purchase.
 */
export function SpaceRadarCreateScreen({ spaceUuid }: { spaceUuid: string }) {
  const { userId: viewerId } = useV2Session();
  const router = useRouter();
  const spaceQuery = useQuery(spacesQueries.detail(spaceUuid, { viewerId }));
  const space = spaceQuery.data?.data ?? null;
  const createRadar = useCreateSpaceRadar(spaceUuid);
  const [blocked, setBlocked] = useState<{
    radar: Radar;
    reason: NonNullable<FirstScanResult['block_reason']>;
  } | null>(null);

  const handleSubmit = (payload: CreateRadarPayload, helpers: RadarFormHelpers) => {
    createRadar.mutate(payload, {
      onSuccess: (response) => {
        const { radar, first_scan } = response.data;
        if (first_scan.block_reason) {
          setBlocked({ radar, reason: first_scan.block_reason });
          return;
        }
        toast.success('Radar created', {
          description: first_scan.dispatched
            ? 'The first scan is running. Its report will show in this space.'
            : 'The first report arrives on schedule, in this space.',
        });
        router.push(spaceRadarHref(spaceUuid, radar.uuid));
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        if (apiError.errors && helpers.applyServerErrors(apiError.errors)) return;
        helpers.setFormError(apiError.message);
      },
    });
  };

  return (
    <div className={LIST_COLUMN}>
      {/* One title per screen: the bar says "New Radar" below `md:`. */}
      <header className="mb-6 space-y-1 md:mt-4">
        <h1 className="sr-only md:not-sr-only md:text-xl md:font-semibold md:tracking-tight md:text-foreground">
          New Radar
        </h1>
        {space ? (
          <p className="max-w-prose text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            {`Choose what to watch. Lawexa scans on your schedule and posts each report in ${space.name}, for everyone in it.`}
          </p>
        ) : (
          <Skeleton aria-hidden className="h-4 w-80 max-w-full rounded" />
        )}
      </header>

      {spaceQuery.isError ? (
        <CollabFailure
          presentation="panel"
          title="Couldn’t load this space"
          message={extractApiError(spaceQuery.error).message || 'Something went wrong on our side. Please try again.'}
          onRetry={() => void spaceQuery.refetch()}
        />
      ) : !space ? (
        <FormSkeleton />
      ) : !canAddContent(space) ? (
        <CollabEmpty
          icon={RadarIcon}
          title="Only the owner and contributors add Radars"
          description="You can read every report this space's Radars post."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={`/spaces/${spaceUuid}?tab=radars`}>See this space&apos;s Radars</Link>
            </Button>
          }
        />
      ) : blocked ? (
        <BlockedFirstScanState spaceUuid={spaceUuid} radar={blocked.radar} reason={blocked.reason} />
      ) : (
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <RadarForm
            mode="create"
            space={{ uuid: space.uuid, name: space.name }}
            isSubmitting={createRadar.isPending}
            submitLabel="Create Radar"
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div aria-hidden className="space-y-7">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}

/** Created, but the first scan did not start for want of balance. */
function BlockedFirstScanState({
  spaceUuid,
  radar,
  reason,
}: {
  spaceUuid: string;
  radar: Radar;
  reason: NonNullable<FirstScanResult['block_reason']>;
}) {
  const goToRadar = (
    <Button asChild size="sm">
      <Link href={spaceRadarHref(spaceUuid, radar.uuid)}>Go to Radar</Link>
    </Button>
  );
  const ownerPays = reason.payer === 'space_owner';
  return (
    <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">&ldquo;{radar.name}&rdquo; was created</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {ownerPays
                ? 'It will scan on schedule once the space’s owner has messages again. Only the first scan was skipped.'
                : 'It will scan on schedule once you have messages again. Only the first scan was skipped.'}
            </p>
          </div>
        </div>
      </div>
      {ownerPays ? (
        // The owner's balance: nothing to buy from here, so the server's own
        // sentence and the way on.
        <div className="flex flex-col gap-3 rounded-2xl border border-border p-5">
          <p className="text-sm text-foreground">{reason.message}</p>
          <div>{goToRadar}</div>
        </div>
      ) : (
        <OutOfMessagesNotice blocked={reason} heading="First scan skipped: no messages left" leading={goToRadar} />
      )}
    </div>
  );
}
