'use client';

import { Check, Share2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { useShareAction } from './use-share-action';

/**
 * ShareButton — the one share control for the pages a reader shares from.
 *
 * ── ONE WORD, ONE BEHAVIOUR (Arthur's ambassador feedback, 25 Sep 2026) ────
 * Cases said "Share" while notes and statutes said "Copy link", for the same
 * act, and readers could not tell whether the two did different things. The
 * owner said go on "Share" everywhere. It is the right word because on a phone
 * the button opens the phone's own share sheet, and "Copy link" would name the
 * fallback rather than the act. Where there is no share sheet (most desktops)
 * the link is copied, and the button says so for two seconds.
 *
 * The behaviour lives in {@link useShareAction} since 21 October 2026, so a
 * control that is not this pill (a quiz row's menu) shares the same way; a
 * cancelled sheet, the clipboard fallback and the ambassador's code are all
 * described there.
 */
export function ShareButton({
  path,
  title,
  label,
}: {
  /** The page to share, as a path (`/notes/{slug}`). Omitted: the address the
   *  reader is on, which is right for a page whose URL is already canonical. */
  path?: string;
  /** Passed to the share sheet, which shows it above the link. A page
   *  without a title (an untitled note) shares the link alone. */
  title: string | null;
  /** The accessible name, e.g. "Share this case". */
  label: string;
}) {
  const { share, copied } = useShareAction({ path, title });

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={cn(ACTION_PILL, FOCUS_RING)}
      aria-label={label}
    >
      {copied ? (
        <Check aria-hidden className="size-4 text-primary" />
      ) : (
        <Share2 aria-hidden className="size-4" />
      )}
      <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}
