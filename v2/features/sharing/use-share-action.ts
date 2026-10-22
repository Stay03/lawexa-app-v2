'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useShareUrl } from './useShareUrl';

/**
 * useShareAction — the one share BEHAVIOUR, for a control that is not the
 * pill: a menu row, a card's own button.
 *
 * Pulled out of `ShareButton` on 21 October 2026 when a quiz row's menu needed
 * to share the quiz's link; the pill keeps its look and composes this. The
 * behaviour is unchanged: the phone's own share sheet where there is one, the
 * clipboard where there is not (with `copied` true for two seconds so the
 * control can say so), a cancelled sheet swallowed as the reader deciding, and
 * a clipboard the browser refuses reported once. An ambassador's code rides
 * the link ({@link useShareUrl}).
 *
 * `text` (22 October 2026, the quiz results' Challenge a friend) is the one
 * sentence the share sheet puts beside the link — a score and an ask. It is
 * for the sheet only: the clipboard fallback still copies the LINK alone,
 * because "Link copied" is what the control then says, and a paragraph where
 * a reader expected an address would be the small lie that label exists to
 * avoid.
 */
export function useShareAction({
  path,
  title,
  text,
}: {
  /** The page to share, as a path. Omitted: the address the reader is on. */
  path?: string;
  /** Passed to the share sheet, which shows it above the link. */
  title: string | null;
  /** Passed to the share sheet beside the link; nothing without one. */
  text?: string;
}): { share: () => Promise<void>; copied: boolean } {
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
      const data: ShareData = { url };
      if (title) data.title = title;
      if (text) data.text = text;
      try {
        await navigator.share(data);
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

  return { share, copied };
}
