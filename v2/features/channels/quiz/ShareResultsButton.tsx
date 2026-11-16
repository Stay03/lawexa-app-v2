'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';

import { shareData } from '@/lib/utils/share-data';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import { copyText } from './copy-text';
import { hostShareText, shareCaption } from './result-card';
import { COMPACT_RAISED } from './ui';
import { useResultsLink } from './use-results-link';

/**
 * A host who ran the game without playing has no card of their own, so the
 * final scores give them one "Share results" (Arthur, 16 November 2026,
 * option 1, thread 5ffd636a): the public results page, the same link the
 * card's caption carries, in a plain caption. The phone's sheet where there is
 * one; else the caption and link are copied.
 */
export function ShareResultsButton({ gameUuid, quizTitle }: { gameUuid: string; quizTitle: string }) {
  const link = useResultsLink(gameUuid);
  const [note, setNote] = useState<string | null>(null);

  const share = async () => {
    if (!link) return;
    const caption = hostShareText(quizTitle);
    const data = shareData({ title: quizTitle, text: caption, url: link });
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        setNote(null);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    const copied = await copyText(shareCaption(caption, link));
    setNote(copied ? 'Link copied.' : `Copy this link: ${link}`);
  };

  return (
    // No box around it (an empty card reads as missing content): the button alone, full width, in the
    // column's own gap. The note sits in that gap under the button, so it never moves what follows.
    <section aria-label="Share the results" className="relative">
      <RaisedButton className={`${COMPACT_RAISED} w-full`} disabled={!link} onClick={() => void share()}>
        <Share2 aria-hidden className="size-4" />
        Share results
      </RaisedButton>
      <p role="status" aria-live="polite" className="absolute inset-x-0 top-full mt-1 text-center text-xs text-muted-foreground">
        {note ?? ''}
      </p>
    </section>
  );
}
