'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Loader2, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ArchiveRadarDialog } from './ArchiveRadarDialog';
import { RadarForm, type RadarFormHelpers } from './RadarForm';
import {
  usePauseRadar,
  useResumeRadar,
  useUpdateRadar,
} from '@/lib/hooks/useRadars';
import { extractApiError } from '@/lib/utils/api-error';
import type { CreateRadarPayload, Radar } from '@/types/radar';

interface RadarSettingsSheetProps {
  radar: Radar;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Setup drawer over the radar inbox: the shared edit form plus the danger
 * zone (pause/resume and permanent archive).
 */
function RadarSettingsSheet({ radar, open, onOpenChange }: RadarSettingsSheetProps) {
  const router = useRouter();
  const updateRadar = useUpdateRadar();
  const pauseRadar = usePauseRadar();
  const resumeRadar = useResumeRadar();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const handleSubmit = async (
    payload: CreateRadarPayload,
    helpers: RadarFormHelpers
  ) => {
    try {
      await updateRadar.mutateAsync({ uuid: radar.uuid, payload });
      toast.success('Radar updated');
      onOpenChange(false);
    } catch (error) {
      const apiError = extractApiError(error);
      if (apiError.errors && helpers.applyServerErrors(apiError.errors)) {
        toast.error('Check the highlighted fields', {
          description: apiError.message,
        });
        return;
      }
      toast.error('Failed to update radar', { description: apiError.message });
    }
  };

  const handlePauseToggle = async () => {
    const isPausing = radar.status === 'active';
    try {
      if (isPausing) {
        await pauseRadar.mutateAsync(radar.uuid);
        toast.success('Radar paused', {
          description: 'Scans are stopped — nothing is billed while paused.',
        });
      } else {
        await resumeRadar.mutateAsync(radar.uuid);
        toast.success('Radar resumed', {
          description: 'The schedule picks back up from here.',
        });
      }
    } catch (error) {
      toast.error(
        isPausing ? 'Could not pause radar' : 'Could not resume radar',
        { description: extractApiError(error).message }
      );
    }
  };

  const pauseToggling = pauseRadar.isPending || resumeRadar.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Radar settings</SheetTitle>
          <SheetDescription>
            Changes to the schedule take effect immediately.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          <RadarForm
            mode="edit"
            radar={radar}
            isSubmitting={updateRadar.isPending}
            submitLabel="Save changes"
            onSubmit={handleSubmit}
          />

          <div className="mt-8 rounded-xl border border-destructive/30 p-4">
            <h3 className="text-sm font-semibold">Danger zone</h3>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {radar.status === 'active' ? 'Pause radar' : 'Resume radar'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {radar.status === 'active'
                    ? 'Stops all scans. Reports stay readable and nothing is billed.'
                    : 'Picks the schedule back up.'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handlePauseToggle}
                disabled={pauseToggling || radar.status === 'archived'}
              >
                {pauseToggling ? (
                  <Loader2 className="animate-spin" />
                ) : radar.status === 'active' ? (
                  <Pause />
                ) : (
                  <Play />
                )}
                {radar.status === 'active' ? 'Pause' : 'Resume'}
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <p className="text-sm font-medium">Archive radar</p>
                <p className="text-sm text-muted-foreground">
                  Permanent — scans stop and the schedule is cancelled. Past
                  reports remain readable.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setArchiveOpen(true)}
              >
                <Archive />
                Archive
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>

      <ArchiveRadarDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        radar={radar}
        onArchived={() => {
          onOpenChange(false);
          router.push('/radars');
        }}
      />
    </Sheet>
  );
}

export { RadarSettingsSheet };
