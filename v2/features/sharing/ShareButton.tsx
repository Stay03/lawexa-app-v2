'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { useShareUrl } from './useShareUrl';

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
 * A cancelled share sheet throws `AbortError`. That is the reader deciding, not
 * a failure, so it is swallowed rather than reported.
 *
 * An ambassador's code rides the shared link ({@link useShareUrl}), so a sign-up
 * from it credits them. Everybody else shares the plain address.
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
  const shareUrl = useShareUrl();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const share = async () => {
    const url = shareUrl(path ? `${window.location.origin}${path}` : window.location.href);

    if ('share' in navigator) {
      try {
        await navigator.share(title ? { title, url } : { url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Anything else falls through to copying the link.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, 2000);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

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
