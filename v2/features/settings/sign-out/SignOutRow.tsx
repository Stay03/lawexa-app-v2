'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';

import { cn } from '@/lib/utils';
import { SignOutConfirm } from './SignOutConfirm';

/**
 * The last block of the settings screen: Sign out, alone (Stay, 29 September
 * 2026: "Do the signout"; v2 had none anywhere).
 *
 * A button, not a link, in the same row grammar as the settings links, so the
 * block reads as one more door. It asks first (SignOutConfirm, shared with the
 * account menu in the sidebar).
 */
export function SignOutRow() {
  const [open, setOpen] = useState(false);

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

      <SignOutConfirm open={open} onOpenChange={setOpen} />
    </li>
  );
}
