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
import { extractApiError } from '@/lib/utils/api-error';
import type { Session } from '@/types/auth';
import { deviceLabel } from './model';
import { useSignOutDevice, useSignOutOtherDevices } from './queries';

/** Who is being signed out: one device, or every device but this one. */
export type SignOutTarget =
  | { kind: 'one'; session: Session }
  | { kind: 'others'; count: number };

/**
 * The confirmation before a sign-out. Signing a device out cannot be undone
 * from here (that device must log in again), so it is asked once, in words
 * that name the device. The pattern is the chat-delete dialog's: the action
 * is the destructive variant, it stays busy until the server answers, and a
 * refusal shows the server's own message inside the dialog.
 */
export function SignOutDialog({
  target,
  onClose,
}: {
  /** `null` while nothing is being signed out (the closed state). */
  target: SignOutTarget | null;
  onClose: () => void;
}) {
  const one = useSignOutDevice();
  const others = useSignOutOtherDevices();
  const mutation = target?.kind === 'others' ? others : one;

  const busy = mutation.isPending;
  const apiError = mutation.error ? extractApiError(mutation.error) : null;
  const errorMessage = apiError
    ? apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : "Couldn't sign out. Try again."
    : null;

  const title =
    target?.kind === 'others'
      ? `Sign out of ${target.count} other devices?`
      : `Sign out of ${target ? deviceLabel(target.session) : 'this device'}?`;
  const description =
    target?.kind === 'others'
      ? 'Every device except this one will need to log in again.'
      : 'That device will need to log in again.';

  function close() {
    one.reset();
    others.reset();
    onClose();
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(next) => {
        if (!next && !busy) close();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage ? (
          <p
            role="alert"
            className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {errorMessage}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={(event) => {
              event.preventDefault();
              if (!target || busy) return;
              const done = {
                onSuccess: () => {
                  toast.success(target.kind === 'others' ? 'Signed out of other devices' : 'Device signed out');
                  close();
                },
              };
              if (target.kind === 'others') others.mutate(undefined, done);
              else one.mutate(target.session.id, done);
            }}
          >
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
