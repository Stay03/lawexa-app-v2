'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

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
import { signOutOfThisDevice } from './sign-out';

/**
 * The one "Sign out of Lawexa on this device?" question, shared by the
 * settings screen's Sign out row and the account menu in the sidebar (Stay,
 * 26 October 2026: the profile area shows a few options, like v1's).
 *
 * It asks first, because it deletes the confidential chats saved on this
 * device and there is no undo for that. After signing out it LOADS the sign-in
 * page rather than routing to it: a full load drops every module-level cache
 * and the v2 session snapshot in one step.
 */
export function SignOutConfirm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    await signOutOfThisDevice(queryClient);
    window.location.assign('/login');
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of Lawexa on this device?</AlertDialogTitle>
          <AlertDialogDescription>
            Confidential chats saved on this device are deleted. Your other chats, notes and
            saved items stay in your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              // Keep the dialog open while signing out; the page then reloads.
              event.preventDefault();
              void signOut();
            }}
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
