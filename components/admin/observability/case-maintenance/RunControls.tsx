'use client';

import { useState } from 'react';
import { Loader2, Pause, Play, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import type { CaseMaintenanceRun } from '@/types/admin-case-maintenance-runs';

/**
 * The four things a person can do to a run in flight.
 *
 * ── ONLY ONE OF THEM ASKS, AND ONLY BECAUSE ONLY ONE IS PERMANENT ─────────
 * Pause is reversible, so it acts immediately: making somebody confirm a
 * reversible action teaches them to confirm without reading, which is exactly
 * how the irreversible one gets waved through later.
 *
 * Cancel cannot be undone — the run is over and what has not been done will not
 * be. That is the one that asks, and its question names the cost in numbers
 * from this run rather than in the abstract.
 *
 * ── WHAT IS SHOWN DEPENDS ON WHERE THE RUN IS ─────────────────────────────
 * A finished run offers nothing but a retry, and only if something failed.
 * Buttons that exist but refuse are worse than buttons that are not there: the
 * reader spends their attention working out why the thing they pressed did
 * nothing.
 */
export function RunControls({
  run,
  onPause,
  onResume,
  onCancel,
  onRetryFailed,
  busy,
}: {
  run: CaseMaintenanceRun;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
  busy: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inFlight = run.status === 'running' || run.status === 'pending';
  const paused = run.status === 'paused';
  const over = run.status === 'completed' || run.status === 'cancelled';
  const failed = run.progress.failed;
  const remaining =
    run.total_items -
    (run.progress.completed +
      run.progress.failed +
      run.progress.skipped +
      run.progress.cancelled +
      run.progress.conflict +
      run.progress.no_match);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {inFlight ? (
        <Button size="sm" variant="outline" onClick={onPause} disabled={busy}>
          {busy ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Pause aria-hidden className="h-3.5 w-3.5" />
          )}
          Pause
        </Button>
      ) : null}

      {paused ? (
        <Button size="sm" onClick={onResume} disabled={busy}>
          {busy ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play aria-hidden className="h-3.5 w-3.5" />
          )}
          Resume
        </Button>
      ) : null}

      {(inFlight || paused) ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          <X aria-hidden className="h-3.5 w-3.5" />
          Cancel run
        </Button>
      ) : null}

      {(over || paused) && failed > 0 ? (
        <Button size="sm" variant="outline" onClick={onRetryFailed} disabled={busy}>
          <RotateCcw aria-hidden className="h-3.5 w-3.5" />
          Retry {failed.toLocaleString()} failed
        </Button>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this run?</AlertDialogTitle>
            <AlertDialogDescription>
              {/* The cost, in this run's own numbers. "This cannot be undone"
                  on its own is a sentence people have learnt to click past. */}
              {remaining > 0
                ? `${remaining.toLocaleString()} of ${run.total_items.toLocaleString()} cases have not been handled yet. They will not be. Cases already running will finish, and nothing that has been changed is undone.`
                : 'Everything has been handled already, so cancelling only closes the run.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it running</AlertDialogCancel>
            <AlertDialogAction
              onClick={onCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel the run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
