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
import { useArchiveRadar } from './actions';

/**
 * ArchiveRadarDialog — the ONE confirm for the one destructive radar action.
 * Archiving is permanent (the backend has no unarchive), so it gets a real
 * AlertDialog rather than a menu item that fires straight away. Used by the
 * list row's menu, the detail's menu, and the settings sheet's danger zone —
 * one dialog, one copy.
 *
 * THE DIALOG OWNS ITS OWN CLOSE. Radix's `AlertDialogAction` auto-closes on
 * click, which would tear the dialog down BEFORE the request settles — the
 * pending spinner could never render and a failure would leave the user
 * staring at the row they just "archived". `preventDefault` on the action
 * keeps it open: the confirm button shows its live pending state, success
 * closes in `onSuccess`, and a failure keeps the dialog open while the
 * global error channel reports it. `mutate`, not `mutateAsync`
 * (standards §2).
 */
export function ArchiveRadarDialog({
  open,
  onOpenChange,
  radar,
  onArchived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  radar: { uuid: string; name: string };
  /** Post-archive navigation (detail surfaces leave the dead route). */
  onArchived?: () => void;
}) {
  const archiveRadar = useArchiveRadar();

  const confirm = (event: React.MouseEvent) => {
    // Stop Radix's auto-close so the dialog outlives the request — see the
    // docblock.
    event.preventDefault();
    archiveRadar.mutate(radar.uuid, {
      onSuccess: () => {
        toast.success('Radar archived', {
          description: `"${radar.name}" has stopped scanning. Past reports remain readable.`,
        });
        onOpenChange(false);
        onArchived?.();
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive &ldquo;{radar.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Archiving is permanent — this radar can&apos;t be reactivated and
            its schedule will be cancelled. Past reports remain readable under
            the Archived tab.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiveRadar.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={archiveRadar.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {archiveRadar.isPending ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : null}
            Archive radar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
