'use client';

import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';

import { canShareFile, canvasToFile, copyText, download, loadImage } from '@/lib/share-card/canvas';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import { drawResultCard, resultCardCopy, type ResultCardInput } from './result-card';
import { COMPACT_RAISED } from './ui';
import { useResultsLink } from './use-results-link';

/**
 * ResultCardShare — the player's own result card under the podium, with
 * Share and Download (Arthur, f730f71c, 11 November 2026). The card is drawn
 * once on the device (`result-card.ts`) and shown as that very image, so what
 * the player sees is what they post, as Wrapped's share frame does.
 *
 * Share hands the picture to the phone's sheet (WhatsApp Status, Instagram),
 * with the results link in its words; a browser whose sheet takes no picture
 * saves it and copies the link, as Wrapped does. Download saves it. A
 * dismissed sheet is a decision, not a failure: nothing is said. A sheet that
 * fails to open says so. Messages are inline, as on every channel surface.
 */

interface Drawn {
  file: File;
  url: string;
}

/** The family a CSS custom property names (next/font sets `--font-comfortaa`). */
function fontFamilyOf(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

export function ResultCardShare({ gameUuid, input }: { gameUuid: string; input: ResultCardInput }) {
  const link = useResultsLink(gameUuid);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const copy = resultCardCopy(input);

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    void (async () => {
      try {
        const fonts = {
          display: fontFamilyOf('--font-comfortaa', 'system-ui, sans-serif'),
          body: getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif',
        };
        // Settled, not all: a fallback face that is not on the phone rejects its load (see Wrapped's ShareFrame).
        await Promise.allSettled([document.fonts.load(`700 80px ${fonts.display}`), document.fonts.load(`500 40px ${fonts.body}`)]);
        const logo = await loadImage('/images/logo.png');
        const canvas = document.createElement('canvas');
        drawResultCard(canvas, input, fonts, logo);
        const file = await canvasToFile(canvas, resultCardCopy(input).fileName);
        if (cancelled) return;
        if (!file) {
          setFailed(true);
          return;
        }
        made = URL.createObjectURL(file);
        setDrawn({ file, url: made });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [input]);

  const save = () => {
    if (!drawn) return;
    download(drawn.url, drawn.file.name);
    setNote('Saved to your downloads.');
  };

  /** The phone's sheet with the picture; where a sheet takes no picture, the card is saved and the link copied. */
  const share = async () => {
    if (!drawn) return;
    if (canShareFile(drawn.file)) {
      try {
        await navigator.share({ files: [drawn.file], text: link ? `${copy.shareText} ${link}` : copy.shareText });
        setNote(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setNote('Sharing did not open. Download the card and post it instead.');
      }
      return;
    }
    download(drawn.url, drawn.file.name);
    const copied = link ? await copyText(link) : false;
    setNote(copied ? 'Saved. Your link is copied too.' : 'Saved to your downloads.');
  };

  return (
    <section aria-label="Your result card" className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex aspect-[9/16] w-full max-w-[15rem] items-center justify-center overflow-hidden rounded-xl bg-[#111]">
        {drawn ? (
          // eslint-disable-next-line @next/next/no-img-element -- a blob of the drawn card, not a remote image
          <img src={drawn.url} alt={`Result card: ${copy.headline}, ${input.score.toLocaleString('en-US')} points`} className="size-full object-contain" />
        ) : (
          <p role="status" className="px-4 text-center text-sm text-neutral-400">
            {failed ? 'Your card could not be drawn on this device.' : 'Drawing your card…'}
          </p>
        )}
      </div>
      <div className="flex w-full max-w-xs gap-3 pb-1">
        <RaisedButton className={`${COMPACT_RAISED} flex-1`} disabled={!drawn} onClick={() => void share()}>
          <Share2 aria-hidden className="size-4" />
          Share
        </RaisedButton>
        <RaisedButton tone="quiet" className={`${COMPACT_RAISED} flex-1`} disabled={!drawn} onClick={save}>
          <Download aria-hidden className="size-4" />
          Download
        </RaisedButton>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
        {note ?? ''}
      </p>
    </section>
  );
}
