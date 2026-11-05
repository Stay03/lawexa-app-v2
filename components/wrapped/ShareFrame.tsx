'use client';

import { useEffect, useState } from 'react';
import { Copy, Download, Instagram, Music2, Share2, Twitter } from 'lucide-react';
import { toast } from 'sonner';

import { shareUrl, vibeFor } from '@/lib/wrapped/copy';
import { canvasToFile, corsPhotoUrl, drawShareCard, loadImage, type ShareFonts } from '@/lib/wrapped/share-image';
import { wrappedArt } from '@/lib/wrapped/theme';
import type { WrappedRecord } from '@/lib/wrapped/types';

/**
 * Frame 08, the share card (Arthur's spec; the techlead's brief, 4 November
 * 2026). The poster is drawn once on the phone as a 1080 × 1920 PNG and shown
 * as that very image, so what the student sees is what they post. The share
 * bar under it is app UI, never in the image. Buttons in the brief's order:
 * Share to your story (the phone's share sheet with the picture, where WhatsApp
 * Status is the first choice), Save image, Instagram, X, TikTok, Copy link.
 * Nothing posts by itself: every share is the student's tap.
 */

interface Poster {
  file: File;
  url: string;
}

function shareText(record: WrappedRecord, link: string): string {
  return `My post-Bar Finals vibe: ${vibeFor(record.vibe.id).line} Get yours: ${link}`;
}

function download(url: string, name: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareFrame({ record, fonts }: { record: WrappedRecord; fonts: ShareFonts }) {
  const [poster, setPoster] = useState<Poster | null>(null);
  const [failed, setFailed] = useState(false);
  const link = shareUrl(record.share_code);

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    void (async () => {
      try {
        // The canvas draws with whatever font is loaded: wait for both. Settled, not all: next/font's
        // fallback face is local("Arial"), and a phone without Arial rejects the load even though
        // Unbounded and Inter themselves loaded, which left the card undrawn.
        await Promise.allSettled([document.fonts.load(`900 80px ${fonts.display}`), document.fonts.load(`700 40px ${fonts.body}`), document.fonts.load(`500 30px ${fonts.body}`)]);
        // Arthur's frame, face and prop for this vibe, and the student's photo, all at once.
        const id = record.vibe.id;
        const [frame, face, prop, photo] = await Promise.all([
          loadImage(wrappedArt('frame', id)),
          loadImage(wrappedArt('face', id)),
          loadImage(wrappedArt('prop', id)),
          loadImage(corsPhotoUrl(record.student.photo_url)),
        ]);
        const canvas = document.createElement('canvas');
        drawShareCard(canvas, record, fonts, { frame, face, prop, photo });
        const file = await canvasToFile(canvas);
        if (cancelled) return;
        if (!file) {
          setFailed(true);
          return;
        }
        made = URL.createObjectURL(file);
        setPoster({ file, url: made });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [record, fonts]);

  const canShareFile = (file: File) => typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });

  /** The phone's share sheet with the picture; elsewhere, the picture is saved and the link copied. */
  const shareToStory = async (afterSave: string) => {
    if (!poster) return;
    if (canShareFile(poster.file)) {
      try {
        await navigator.share({ files: [poster.file], text: shareText(record, link) });
      } catch (error) {
        if ((error as DOMException)?.name !== 'AbortError') toast.error('Sharing did not open. Save the image and post it instead.');
      }
      return;
    }
    download(poster.url, poster.file.name);
    const copied = await copyText(link);
    toast.success(copied ? `${afterSave} Your link is copied too.` : afterSave);
  };

  const save = () => {
    if (!poster) return;
    download(poster.url, poster.file.name);
    toast.success('Saved to your downloads.');
  };

  const copyLink = async () => {
    if (await copyText(link)) toast.success('Link copied.');
    else toast.error(`Copy did not work. Your link: ${link}`);
  };

  const xHref = `https://x.com/intent/post?text=${encodeURIComponent(`My post-Bar Finals vibe: ${vibeFor(record.vibe.id).line}`)}&url=${encodeURIComponent(link)}`;

  return (
    <section className="wr-frame wr-share-frame" data-ground="ink" aria-label="Your share card">
      <div className="wr-share-stage">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- a blob of the drawn poster, not a remote image
          <img className="wr-share-preview" src={poster.url} alt={`Share card: ${vibeFor(record.vibe.id).line}`} />
        ) : (
          <p className="wr-body" role="status" style={{ opacity: 0.7 }}>
            {failed ? 'Your card could not be drawn on this device.' : 'Drawing your card…'}
          </p>
        )}
      </div>
      <div className="wr-share-bar" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="wr-share-primary" disabled={!poster} onClick={() => void shareToStory('Saved. Add it to your WhatsApp Status.')}>
          <Share2 aria-hidden size={18} />
          Share to your story
        </button>
        <div className="wr-share-row">
          <button type="button" disabled={!poster} onClick={save}>
            <Download aria-hidden size={18} />
            Save image
          </button>
          <button type="button" disabled={!poster} onClick={() => void shareToStory('Saved. Open Instagram and add it to your story.')}>
            <Instagram aria-hidden size={18} />
            Instagram
          </button>
          <a href={xHref} target="_blank" rel="noopener noreferrer">
            <Twitter aria-hidden size={18} />X
          </a>
          <button type="button" disabled={!poster} onClick={() => void shareToStory('Saved. Open TikTok and add it to your story.')}>
            <Music2 aria-hidden size={18} />
            TikTok
          </button>
          <button type="button" onClick={() => void copyLink()}>
            <Copy aria-hidden size={18} />
            Copy link
          </button>
        </div>
      </div>
    </section>
  );
}
