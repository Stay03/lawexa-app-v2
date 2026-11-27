'use client';

import { useSyncExternalStore } from 'react';
import { UserPlus } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  accountRequiredSnapshot,
  dismissAccountRequired,
  subscribeAccountRequired,
} from '@/lib/utils/account-required';
import { AccountOfferButtons } from './AccountOfferButtons';

/** The title for each refused action; the server's sentence is the body. */
const TITLES: Record<string, string> = {
  organization: 'Create an account to start an organisation',
  invite: 'Create an account to invite people',
  note: 'Create an account to write notes',
  publish: 'Create an account to publish',
  upload: 'Create an account to upload files',
};

/**
 * The sign-up prompt for a guest's refused action. Mounted once in the v2
 * layout; any request the server refuses with `account_required` opens it
 * (`lib/utils/account-required.ts`), whichever button sent it: an upload, a
 * publish switch, a new note, a new organisation, an invite.
 */
export function AccountRequiredDialog() {
  const refusal = useSyncExternalStore(
    subscribeAccountRequired,
    accountRequiredSnapshot,
    () => null,
  );
  return (
    <Dialog
      open={refusal !== null}
      onOpenChange={(open) => {
        if (!open) dismissAccountRequired();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-start text-left">
          <span
            aria-hidden
            className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <UserPlus className="size-5" />
          </span>
          <DialogTitle>
            {(refusal && TITLES[refusal.action]) || 'Create an account to continue'}
          </DialogTitle>
          <DialogDescription>{refusal?.message}</DialogDescription>
        </DialogHeader>
        {/* Following either link leaves this page, which closes the prompt. */}
        <div onClickCapture={dismissAccountRequired}>
          <AccountOfferButtons className="pt-1" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
