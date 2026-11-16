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
    <section aria-label="Share the results" className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-4">
      <RaisedButton className={`${COMPACT_RAISED} w-full max-w-xs`} disabled={!link} onClick={() => void share()}>
        <Share2 aria-hidden className="size-4" />
        Share results
      </RaisedButton>
      <p role="status" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
        {note ?? ''}
      </p>
    </section>
  );
}
