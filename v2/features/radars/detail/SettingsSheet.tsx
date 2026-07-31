'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Loader2, Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { extractApiError } from '@/lib/utils/api-error';
import type { CreateRadarPayload, Radar } from '@/types/radar';
import { usePauseRadar, useResumeRadar, useUpdateRadar } from '../actions';
import { ArchiveRadarDialog } from '../ArchiveRadarDialog';
import { RadarForm, type RadarFormHelpers } from '../create/RadarForm';

/**
 * SettingsSheet — the radar's settings as a sheet OVER the detail (the
 * separate `/radars/[uuid]/settings` route is dead in v2; the quiet
 * `?settings=1` URL in `RadarScreen` is its replacement). Contains the shared
 * edit form plus the danger zone: pause/resume and the permanent archive.
 *
 * `key={radar.uuid + updated_at}` on the form: the form seeds its state once
 * (controlled-uncontrolled hybrid), so a save that changes the radar remounts
 * it with the fresh values rather than silently keeping stale ones.
 */
export function SettingsSheet({
  radar,
  open,
  onOpenChange,
}: {
  radar: Radar;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const updateRadar = useUpdateRadar();
  const pauseRadar = usePauseRadar();
  const resumeRadar = useResumeRadar();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const handleSubmit = (
    payload: CreateRadarPayload,
    helpers: RadarFormHelpers,
  ) => {
    updateRadar.mutate(
      { uuid: radar.uuid, payload },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          const apiError = extractApiError(error);
          if (apiError.errors && helpers.applyServerErrors(apiError.errors)) {
            return;
          }
          helpers.setFormError(apiError.message);
        },
      },
    );
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
            key={`${radar.uuid}:${radar.updated_at}`}
            mode="edit"
            radar={radar}
            isSubmitting={updateRadar.isPending}
            submitLabel="Save changes"
            onSubmit={handleSubmit}
          />

          <div className="mt-8 rounded-xl border border-destructive/30 p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Danger zone
            </h3>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
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
                onClick={() =>
                  radar.status === 'active'
                    ? pauseRadar.mutate(radar.uuid)
                    : resumeRadar.mutate(radar.uuid)
                }
                disabled={pauseToggling || radar.status === 'archived'}
              >
                {pauseToggling ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : radar.status === 'active' ? (
                  <Pause aria-hidden />
                ) : (
                  <Play aria-hidden />
                )}
                {radar.status === 'active' ? 'Pause' : 'Resume'}
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Archive radar
                </p>
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
                <Archive aria-hidden />
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
