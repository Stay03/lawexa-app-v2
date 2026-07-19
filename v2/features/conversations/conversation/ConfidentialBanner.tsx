'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react';
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

/**
 * ConfidentialBanner — the honest-copy home for a confidential conversation
 * (fix round §A7-39). It replaces the old inline banner whose "stored only on this
 * device, never on our servers" copy omitted the crucial truth: the device-owned
 * IndexedDB transcript persists INDEFINITELY (nothing enforces a TTL on the text),
 * so it is stored until the user deletes it. The binding owner copy states that
 * plainly, and the banner pairs it with the delete affordance that makes the promise
 * actionable.
 *
 * ANATOMY — a slim emerald hairline strip (the confidential identity, kept from the
 * old banner): a shield + "Confidential" label, the honest copy, and a trailing
 * Delete control. It flex-WRAPS so the long copy and the control reflow cleanly at
 * the 320px floor instead of overflowing. Emerald reads in both themes.
 *
 * MOTION — the strip fades + slides in on mount (motion-reduce-guarded). It is
 * mounted for the entire life of a confidential conversation (the flag is sticky and
 * never toggles off in place; delete navigates away, unmounting the whole screen),
 * so there is no in-place reverse state to animate here. The destructive confirm is
 * a Radix `AlertDialog` whose primitive animates BOTH open and close (its
 * `data-[state]` enter/exit classes), so that show/hide is symmetric.
 */
const HONEST_COPY = 'Stored only on this device until you delete it — never on our servers.';

export function ConfidentialBanner({ onDelete }: { onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      // Resolves by navigating home, which unmounts this subtree. The re-arm below
      // only runs on the rare path where navigation didn't tear us down.
      await onDelete();
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  };

  return (
    <div className="v2-safe-left v2-safe-right flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 border-b border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
      <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="font-medium">Confidential</span>
      </span>
      <span className="text-center text-emerald-700/70 dark:text-emerald-400/70">{HONEST_COPY}</span>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          // Never let a dialog dismiss slip through mid-delete.
          if (!deleting) setOpen(next);
        }}
      >
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="v2-interactive inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2.5 font-medium text-emerald-700/80 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 dark:text-emerald-400/80"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Delete
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this confidential conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This conversation is stored only on this device. Deleting it removes the
              only copy — the transcript and any files attached to it can&rsquo;t be
              recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                // Keep the dialog up while the async delete + navigation runs.
                event.preventDefault();
                void confirm();
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
