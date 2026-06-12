'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { MessageBlockBanner } from '@/components/chat/message-block-banner';
import { PageContainer, PageHeader } from '@/components/layout';
import { RadarForm, type RadarFormHelpers } from '@/components/radar/RadarForm';
import { useCreateRadar } from '@/lib/hooks/useRadars';
import { extractApiError } from '@/lib/utils/api-error';
import type { IBlockedReason } from '@/types/message-pack';
import type { CreateRadarPayload, Radar } from '@/types/radar';

interface BlockedCreateResult {
  radar: Radar;
  blockReason: IBlockedReason;
}

export default function NewRadarPage() {
  const router = useRouter();
  const createRadar = useCreateRadar();
  const [blockedResult, setBlockedResult] = useState<BlockedCreateResult | null>(
    null
  );

  const handleSubmit = async (
    payload: CreateRadarPayload,
    helpers: RadarFormHelpers
  ) => {
    try {
      const response = await createRadar.mutateAsync(payload);
      const { radar, first_scan } = response.data;

      if (first_scan.dispatched) {
        toast.success('Radar created', {
          description: 'The first scan is running — its report lands shortly.',
        });
        router.push(`/radars/${radar.uuid}`);
        return;
      }

      if (first_scan.block_reason) {
        // No message balance: the radar exists and will scan on schedule,
        // but the immediate first scan was blocked — surface the top-up path.
        setBlockedResult({ radar, blockReason: first_scan.block_reason });
        return;
      }

      toast.success('Radar created', {
        description: 'The first report arrives on schedule.',
      });
      router.push(`/radars/${radar.uuid}`);
    } catch (error) {
      const apiError = extractApiError(error);
      if (apiError.errors && helpers.applyServerErrors(apiError.errors)) {
        toast.error('Check the highlighted fields', {
          description: apiError.message,
        });
        return;
      }
      toast.error('Failed to create radar', { description: apiError.message });
    }
  };

  if (blockedResult) {
    return (
      <PageContainer variant="detail">
        <PageHeader title="New radar" />
        <MessageBlockBanner
          message={blockedResult.blockReason.message}
          reason={blockedResult.blockReason.reason}
          resetsAt={blockedResult.blockReason.resets_at}
        />
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                &ldquo;{blockedResult.radar.name}&rdquo; was created
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                It will scan on schedule once you have message balance — the
                immediate first scan was skipped.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button asChild>
              <Link href={`/radars/${blockedResult.radar.uuid}`}>
                Go to radar
              </Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="detail">
      <PageHeader
        title="New radar"
        description="A saved watch the AI agent investigates on a schedule, delivering one report per scan."
      />
      <RadarForm
        mode="create"
        isSubmitting={createRadar.isPending}
        submitLabel="Create radar"
        onSubmit={handleSubmit}
      />
    </PageContainer>
  );
}
