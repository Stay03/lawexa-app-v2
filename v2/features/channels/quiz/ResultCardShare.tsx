'use client';

import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { canvasToFile, corsPhotoUrl, loadImage } from '@/lib/wrapped/share-image';
import { cn } from '@/lib/utils';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import {
  CARD_FORMATS,
  cardCta,
  cardHeadline,
  cardPlace,
  cardStats,
  cardSubline,
  podiumText,
  resultCardCopy,
  shareCaption,
  type CardFormat,
  type ResultCardInput,
} from './result-card';
import { drawResultCard } from './result-card-draw';
import { loadCardFonts } from './result-card-fonts';
import { COMPACT_RAISED } from './ui';
import { useResultsLink } from './use-results-link';

/**
 * ResultCardShare — the player's own result card under the final scores,
 * with Share and Download (Arthur, f9645a22, 12 November 2026). The card is
 * Arthur's design for the player's place (`result-card-draw.ts`), drawn on
 * the device in both his sizes: the story for Status and Stories, the square
 * for feeds. The player picks one; what they see is the very image they post.
 *
 * Share hands the picture to the phone's sheet (WhatsApp Status, Instagram),
 * with its caption: the card's words and the results link (Arthur,
 * e3d57458). A browser whose sheet takes no picture saves it and copies the
 * caption. Download saves the picture alone. A dismissed sheet is a
 * decision, not a failure: nothing is said. A sheet that fails to open says
 * so. Messages are inline, as on every channel surface.
 */

interface Drawn {
  file: File;
  url: string;
}

const FORMAT_LABEL: Record<CardFormat, string> = { story: 'Story', square: 'Square' };

/** Saves a drawn card (an object URL) to the device's downloads. */
function download(url: string, name: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** Copies text to the clipboard; false when the browser refuses (no permission, an insecure page). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Whether this browser's share sheet takes a picture. Read at tap time, never in render. */
const canShareFile = (file: File) => typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });

/** Every character the card prints, so the fonts load only the ranges it needs. */
function cardText(input: ResultCardInput): string {
  const place = cardPlace(input);
  const { lead, title } = cardSubline(input);
  const stats = cardStats(input).flatMap((stat) => [stat.value, stat.label]);
  return [...cardHeadline(place), podiumText(input), lead, title, ...stats, cardCta(place), 'Lawexa live quiz', 'Play at lawexa.com', 'Top 10…'].join(' ');
}

export function ResultCardShare({ gameUuid, input }: { gameUuid: string; input: ResultCardInput }) {
  const link = useResultsLink(gameUuid);
  const [format, setFormat] = useState<CardFormat>('story');
  const [drawn, setDrawn] = useState<Partial<Record<CardFormat, Drawn>>>({});
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const current = drawn[format] ?? null;
  const copy = resultCardCopy(input, format);

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    void (async () => {
      try {
        // The type and the photo at once; a photo that will not load leaves the initials in the gold circle.
        const [, photo] = await Promise.all([loadCardFonts(cardText(input)), loadImage(corsPhotoUrl(input.avatarUrl))]);
        const cards: Partial<Record<CardFormat, Drawn>> = {};
        for (const each of CARD_FORMATS) {
          const canvas = document.createElement('canvas');
          drawResultCard(canvas, input, each, photo);
          const file = await canvasToFile(canvas, resultCardCopy(input, each).fileName);
          if (!file) throw new Error('The card could not be saved as a picture.');
          const url = URL.createObjectURL(file);
          made.push(url);
          cards[each] = { file, url };
        }
        if (!cancelled) setDrawn(cards);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, [input]);

  const save = () => {
    if (!current) return;
    download(current.url, current.file.name);
    setNote('Saved to your downloads.');
  };

  /** The phone's sheet with the picture and its caption; where a sheet takes no picture, the card is saved and the caption copied. */
  const share = async () => {
    if (!current) return;
    const caption = shareCaption(copy.shareText, link);
    if (canShareFile(current.file)) {
      try {
        await navigator.share({ files: [current.file], text: caption });
        setNote(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setNote('Sharing did not open. Download the card and post it instead.');
      }
      return;
    }
    download(current.url, current.file.name);
    const copied = await copyText(caption);
    setNote(copied ? 'Saved. Caption and link copied.' : 'Saved to your downloads.');
  };

  return (
    <section aria-label="Your result card" className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-4">
      <Tabs
        value={format}
        onValueChange={(value) => {
          setFormat(value as CardFormat);
          setNote(null);
        }}
        className="w-full items-center"
      >
        <TabsList aria-label="Card size">
          {CARD_FORMATS.map((each) => (
            <TabsTrigger key={each} value={each} className="px-4">
              {FORMAT_LABEL[each]}
            </TabsTrigger>
          ))}
        </TabsList>
        {CARD_FORMATS.map((each) => {
          const card = drawn[each];
          return (
            <TabsContent key={each} value={each} className="flex w-full justify-center">
              <div
                className={cn(
                  'flex w-full items-center justify-center overflow-hidden rounded-xl bg-muted',
                  each === 'story' ? 'aspect-[9/16] max-w-[15rem]' : 'aspect-square max-w-[18rem]',
                )}
              >
                {card ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a blob of the drawn card, not a remote image
                  <img src={card.url} alt={resultCardCopy(input, each).alt} className="size-full object-contain" />
                ) : (
                  <p role="status" className="px-4 text-center text-sm text-muted-foreground">
                    {failed ? 'Your card could not be drawn on this device.' : 'Drawing your card…'}
                  </p>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
      <div className="flex w-full max-w-xs gap-3 pb-1">
        <RaisedButton className={`${COMPACT_RAISED} flex-1`} disabled={!current} onClick={() => void share()}>
          <Share2 aria-hidden className="size-4" />
          Share
        </RaisedButton>
        <RaisedButton tone="quiet" className={`${COMPACT_RAISED} flex-1`} disabled={!current} onClick={save}>
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
