'use client';

import { Loader2, Square } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface EndSessionDialogProps {
  onConfirm: () => void;
  ending: boolean;
}

/** The "End" button + its confirmation dialog, used in the play header. */
export function EndSessionDialog({ onConfirm, ending }: EndSessionDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="End session">
          <Square className="h-4 w-4" />
          End
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End this session?</AlertDialogTitle>
          <AlertDialogDescription>
            Your score will be finalized and you&apos;ll see your results. You can
            start a new session anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ending}>Keep going</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={ending}>
            {ending && <Loader2 className="h-4 w-4 animate-spin" />}
            End session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
