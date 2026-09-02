'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useDecideCaseMaintenanceItems } from '@/lib/hooks/useAdminCaseMaintenanceRuns';
import { extractApiError } from '@/lib/utils/api-error';
import type { CaseMaintenanceItem } from '@/types/admin-case-maintenance-runs';

/**
 * Clears every case on the page in one press.
 *
 * ── WHY IT EXISTS ──────────────────────────────────────────────────────────
 * A refresh run left 101 cases waiting on a person, and the owner could only
 * act on them one at a time.
 *
 * ── AND WHY IT IS NOT "CLEAR THE WHOLE QUEUE" ──────────────────────────────
 * This was first justified on a reading that every one of the 101 scored
 * exactly 67, so the whole pile was one answer repeated. THAT WAS WRONG, and
 * the correction arrived hours later: it came from the seven rows legible in a
 * screenshot, which were the sorted top of the list. Rescoring all 101 gave 28
 * at 67, 41 at 50, the rest lower, 4 with no candidate — and SOME ARE REAL
 * MATCHES.
 *
 * The control survives that correction only because it never believed the
 * uniformity. It acts on the rows on screen, states the count, and asks. Had it
 * been built to the premise — one press clearing all 101 — it would now be a
 * feature that silently rejects genuine matches.
 *
 * Keep that shape. A batch control is safe in proportion to how much of what it
 * touches the person can actually see when they press it.
 *
 * ── WHY REJECT AND NOT ACCEPT ──────────────────────────────────────────────
 * Accepting writes a judgment into case law, so a wrong batch press there is
 * expensive and hard to walk back. Rejecting only marks a suggestion as not
 * taken and writes nothing to a case. The two directions do not carry the same
 * risk and this control deliberately offers the safe one. The accept path is a
 * separate piece of work with a failure question still open on it.
 *
 * ── SHOWN MEANS SHOWN ──────────────────────────────────────────────────────
 * It acts on the rows the reader can see and no others. Rejecting everything
 * behind the filter would put a hundred invisible writes behind one press, and
 * the reader would have no way to check what they had just agreed to. The count
 * is in the button and in the confirmation, so the number pressed is the number
 * read. A page holds 20, well inside the server's cap of 100 per call, so this
 * never has to split a batch and never half-sends one.
 *
 * ── A PARTIAL WRITE IS THE NORMAL CASE ─────────────────────────────────────
 * The endpoint decides items individually and answers 200 with two lists. Six
 * refused out of fifty is a success response, not an error, so a plain "done"
 * would be a lie and a thrown error would lose which six. Both numbers are
 * reported, and the server's own words for the refusals are shown rather than
 * reworded.
 */
export function RejectAllShownButton({
  uuid,
  items,
  disabled,
  onCleared,
}: {
  uuid: string;
  /** The rows currently on screen. Only those awaiting a decision are sent. */
  items: CaseMaintenanceItem[];
  disabled: boolean;
  /**
   * Called once anything was actually cleared.
   *
   * Clearing a page removes those rows from the filtered set, so every page
   * after it re-flows and the page number the reader is on no longer means what
   * it did. On the last page it may stop existing altogether, and the table's
   * empty state then reads "no cases in this run" while the run is still full
   * of them. The page owns the page number, so it does the correcting.
   */
  onCleared: () => void;
}) {
  const [open, setOpen] = useState(false);
  const decide = useDecideCaseMaintenanceItems(uuid);

  const ids = items
    .filter((item) => item.status === 'awaiting_confirmation')
    .map((item) => item.id);

  /* Nothing on this page is waiting, so there is nothing to offer. Drawing a
     disabled button instead would make the reader press it to find that out. */
  if (ids.length === 0) return null;

  const handleReject = () => {
    decide.mutate(
      { decision: 'reject', itemIds: ids },
      {
        onSuccess: (response) => {
          const { succeeded, failed } = response.data;
          setOpen(false);
          if (succeeded.length > 0) onCleared();

          if (failed.length === 0) {
            toast.success(
              succeeded.length === 1 ? 'Cleared 1 case' : `Cleared ${succeeded.length} cases`,
            );
            return;
          }

          /* Both halves in one line, then the server's reasons underneath. The
             reviewer's next question is always WHICH ones did not go through.

             The only `toast.warning` in the codebase, and deliberately so. A
             partly-written batch is neither of the two states admin already
             uses: `success` would bury the refusals and `error` would claim
             nothing was written when most of it was. */
          toast.warning(`Cleared ${succeeded.length}, refused ${failed.length}`, {
            /* Real elements, not a joined string. A description is rendered as
               text, so newlines in it collapse and the reasons run together
               into one unreadable line. */
            description: (
              <ul className="mt-1 space-y-0.5">
                {failed.slice(0, 3).map((f) => (
                  <li key={f.id}>
                    <span className="font-medium">#{f.id}</span> {f.reason}
                  </li>
                ))}
                {failed.length > 3 ? (
                  <li className="text-muted-foreground">
                    and {failed.length - 3} more
                  </li>
                ) : null}
              </ul>
            ),
          });
        },
        onError: (error) => toast.error(extractApiError(error).message),
      },
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled || decide.isPending}
      >
        {decide.isPending ? (
          <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <X aria-hidden className="mr-2 h-4 w-4" />
        )}
        Reject all {ids.length} shown
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reject {ids.length} {ids.length === 1 ? 'case' : 'cases'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This clears every case on this page that is waiting on you. It
                  acts on the{' '}
                  <span className="font-semibold text-foreground">
                    {ids.length} shown
                  </span>{' '}
                  and on no others.
                </p>
                <p className="text-sm">
                  Nothing is written to a case. Rejecting records that the
                  suggestion was not taken.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={decide.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={decide.isPending}
            >
              {decide.isPending && (
                <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reject {ids.length} shown
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
