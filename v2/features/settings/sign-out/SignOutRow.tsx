'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import { signOutOfThisDevice } from './sign-out';

/**
 * The last block of the settings screen: Sign out, alone (Stay, 29 September
 * 2026: "Do the signout"; v2 had none anywhere).
 *
 * A button, not a link, in the same row grammar as the settings links, so the
 * block reads as one more door. It asks first, because it deletes the
 * confidential chats saved on this device and there is no undo for that. After
 * signing out it LOADS the sign-in page rather than routing to it: a full load
 * drops every module-level cache and the v2 session snapshot in one step.
 */
export function SignOutRow() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    await signOutOfThisDevice(queryClient);
    window.location.assign('/login');
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group v2-interactive flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left',
          'transition-colors duration-150 hover:bg-foreground/[0.04] motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        <LogOut
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground motion-reduce:transition-none"
        />
        <span className="text-[15px] leading-snug font-medium text-foreground">Sign out</span>
      </button>

      <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Lawexa on this device?</AlertDialogTitle>
            <AlertDialogDescription>
              Confidential chats saved on this device are deleted. Your other chats, notes and
              bookmarks stay in your account.
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
    </li>
  );
}
