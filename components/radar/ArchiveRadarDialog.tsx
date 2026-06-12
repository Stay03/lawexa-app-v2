'use client';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useArchiveRadar } from '@/lib/hooks/useRadars';
import { extractApiError } from '@/lib/utils/api-error';

interface ArchiveRadarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  radar: { uuid: string; name: string };
  onArchived?: () => void;
}

/**
 * Confirmation dialog for archiving a radar. Archiving is permanent in v1 —
 * scans stop, the schedule is cancelled, and the radar moves to the Archived
 * tab where its past reports remain readable.
 */
function ArchiveRadarDialog({
  open,
  onOpenChange,
  radar,
  onArchived,
}: ArchiveRadarDialogProps) {
  const archiveRadar = useArchiveRadar();

  const handleArchive = async () => {
    try {
      await archiveRadar.mutateAsync(radar.uuid);
      toast.success('Radar archived', {
        description: `"${radar.name}" has stopped scanning. Past reports remain readable.`,
      });
      onOpenChange(false);
      onArchived?.();
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to archive radar', {
        description: apiError.message,
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive &ldquo;{radar.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Archiving is permanent — this radar can&apos;t be reactivated and its
            schedule will be cancelled. Past reports remain readable under the
            Archived tab.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={archiveRadar.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {archiveRadar.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Archive radar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ArchiveRadarDialog };
