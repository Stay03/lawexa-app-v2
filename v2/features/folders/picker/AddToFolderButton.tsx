'use client';

import { useState } from 'react';
import { FolderPlus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import type { FolderItemTarget } from '../item-mutations';
import { FolderPicker } from './FolderPicker';

/**
 * AddToFolderButton — one more pill in the case, statute and note action rows,
 * beside the bookmark control, wearing the shared {@link ACTION_PILL} shape so
 * the set still reads as a set.
 *
 * ── DRAWN ONLY WHEN IT CAN WORK ────────────────────────────────────────────
 * Every folder endpoint 401s without a token, so a signed-out reader would get
 * a picker that could only fail. The pill is therefore not drawn for them.
 *
 * THIS IS NOT YET A HOUSE RULE, and the docblock that claimed it was is
 * corrected here: the three bookmark buttons beside this one have NO session
 * gate, so a signed-out reader on a statute now sees "Save" but not "Add to
 * folder". Hiding is the better of the two behaviours — "Save" fires a request
 * that can only 401 — but the inconsistency is real and belongs to those
 * buttons, which are outside this wave's boundary. Filed, not papered over.
 *
 * GUESTS ARE NOT SIGNED OUT: a guest session is a real session with real
 * folders (probed), so guests get the pill and the full picker, with no upsell
 * panel in the way.
 *
 * The picker component stays mounted while closed, so its confirmation toast
 * can still perform the Undo it promises after the surface has gone.
 */

export function AddToFolderButton({ target }: { target: FolderItemTarget }) {
  const { signedIn } = useV2Session();
  const [open, setOpen] = useState(false);

  if (!signedIn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(ACTION_PILL, FOCUS_RING)}
      >
        <FolderPlus
          aria-hidden
          className="size-4 transition-transform motion-safe:duration-150 active:scale-90"
        />
        <span>Add to folder</span>
      </button>
      <FolderPicker target={target} open={open} onOpenChange={setOpen} />
    </>
  );
}
