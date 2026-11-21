'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Instagram, Linkedin, MessageCircle, Share2, Twitter, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { shareUrl } from '@/lib/wrapped/copy';
import { canvasToFile, corsPhotoUrl, loadImage } from '@/lib/wrapped/share-image';
import { EASE_BACK, EASE_IN_OUT, RISE, SlideMotion } from '@/lib/wrapped26/motion';
import type { Wrapped26CardFormat, Wrapped26Platform } from '@/lib/wrapped26/progress';
import { FORMAT_FOR, cardContent, drawWrapped26Card, type CardFonts } from '@/lib/wrapped26/share-card';
import { Avatar, accentVar, type SlideProps } from './slides';

/**
 * Slide 10, the forecast and the share (the kit's 10-forecast-and-share.png,
 * BUILD_SPEC §6). The card in the hand is a preview; the picture that is
 * shared is drawn on a canvas in the format the target wants. Each link
 * carries utm_source={platform}, utm_campaign=wrapped2026 and
 * utm_content={track}. Nothing posts by itself: every share is a tap.
 */

/** The share link for one platform, with the kit's utm tags. */
export function wrapped26Link(code: string, platform: Wrapped26Platform | 'invite', track: string): string {
  const url = new URL(shareUrl(code));
  url.searchParams.set('utm_source', platform);
  url.searchParams.set('utm_campaign', 'wrapped2026');
  url.searchParams.set('utm_content', track);
  return url.toString();
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

const enterShare = (root: HTMLElement, m: SlideMotion) => {
  m.animate(root.querySelector('[data-a="forecast"]'), RISE, { duration: 700 });
  const card = root.querySelector('[data-a="card"]');
  m.animate(card, [{ transform: 'translateY(400px) rotate(-14deg) scale(.8)', opacity: 0 }, { transform: 'rotate(3deg)', opacity: 1 }], { duration: 900, delay: 400, easing: EASE_BACK });
  m.after(1300, () =>
    m.animate(card, [{ transform: 'rotate(3deg) translateY(0)' }, { transform: 'rotate(2deg) translateY(-10px)' }, { transform: 'rotate(3deg) translateY(0)' }], {
      duration: 3000,
      iterations: Infinity,
      easing: EASE_IN_OUT,
      fill: 'none',
    }),
  );
  m.stagger(root.querySelectorAll('[data-a="btn"]'), RISE, { delay: 1100 }, 140);
};

export function ShareSlide({
  record,
  character,
  active,
  reduced,
  fonts,
  onShared,
}: SlideProps & { fonts: CardFonts; onShared: (platform: Wrapped26Platform, format: Wrapped26CardFormat) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const accent = accentVar(character);

  useEffect(() => {
    const el = root.current;
    if (!active || !el) return;
    const m = new SlideMotion(reduced);
    enterShare(el, m);
    return () => m.stop();
  }, [active, reduced]);

  /** The card for `format`, drawn now with the loaded fonts and the person's photo. */
  const makeCard = async (format: Wrapped26CardFormat): Promise<File | null> => {
    await Promise.allSettled([document.fonts.load(`900 80px ${fonts.display}`), document.fonts.load(`700 40px ${fonts.display}`), document.fonts.load(`700 40px ${fonts.body}`)]);
    const photo = await loadImage(corsPhotoUrl(record.user.avatarUrl));
    const canvas = document.createElement('canvas');
    drawWrapped26Card(canvas, format, cardContent(record, character), photo, fonts);
    return canvasToFile(canvas, `lawexa-wrapped-2026-${format}.png`);
  };

  const share = async (platform: Wrapped26Platform) => {
    if (busy) return;
    setBusy(true);
    const format = FORMAT_FOR[platform];
    const link = wrapped26Link(record.shareCode, platform, record.track);
    const text = `I’m ${record.character.name} in my Lawexa Wrapped 2026. Get yours:`;
    try {
      const file = await makeCard(format);
      if (!file) {
        toast.error('Your card could not be drawn on this device.');
        return;
      }
      if (platform !== 'save' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: `${text} ${link}` });
          onShared(platform, format);
        } catch (error) {
          if ((error as DOMException)?.name !== 'AbortError') toast.error('Sharing did not open. Save the image and post it instead.');
        }
        return;
      }
      const url = URL.createObjectURL(file);
      download(url, file.name);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      onShared(platform, format);
      if (platform === 'save') {
        toast.success('Saved to your downloads.');
      } else if (platform === 'x') {
        window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`, '_blank', 'noopener,noreferrer');
      } else if (platform === 'linkedin') {
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, '_blank', 'noopener,noreferrer');
      } else {
        const copied = await copyText(link);
        toast.success(copied ? 'Saved. Post it, and your link is copied too.' : 'Saved. Post it from your gallery.');
      }
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    const link = wrapped26Link(record.shareCode, 'invite', record.track);
    if (navigator.share) {
      try {
        await navigator.share({ text: `See your year on Lawexa: ${link}` });
      } catch {
        // Closed the sheet.
      }
      return;
    }
    if (await copyText(link)) toast.success('Invite link copied.');
    else toast.error(`Copy did not work. Your link: ${link}`);
  };

  const stop = { onPointerDown: (event: React.PointerEvent) => event.stopPropagation(), onPointerUp: (event: React.PointerEvent) => event.stopPropagation() };
  const targets: { platform: Wrapped26Platform; label: string; icon: typeof Share2 }[] = [
    { platform: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { platform: 'instagram', label: 'Instagram Stories', icon: Instagram },
    { platform: 'x', label: 'X', icon: Twitter },
    { platform: 'linkedin', label: 'LinkedIn', icon: Linkedin },
    { platform: 'save', label: 'Save image', icon: Download },
  ];

  return (
    <div ref={root} style={{ position: 'absolute', inset: 0 }}>
      <div className="w26-content" style={{ gap: 48 }}>
        <div className="w26-eyebrow" style={{ color: 'var(--muted)' }}>
          2027 forecast
        </div>
        <p data-a="forecast" className="w26-d" style={{ fontSize: 76, lineHeight: 1.02, letterSpacing: -2 }}>
          {record.forecast}
        </p>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <div
            data-a="card"
            aria-hidden
            style={{
              width: 480,
              height: 580,
              background: 'var(--w26-ink)',
              color: 'var(--w26-cream)',
              border: '4px solid var(--w26-ink)',
              padding: 40,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: `16px 16px 0 ${accent}`,
              transform: 'rotate(3deg)',
            }}
          >
            <div className="w26-eyebrow" style={{ fontSize: 18, letterSpacing: 6 }}>
              {record.user.firstName}’s Wrapped 2026
            </div>
            <div>
              <Avatar record={record} character={character} size={150} />
              <div className="w26-d" style={{ fontSize: 64, letterSpacing: -2, marginTop: 16 }}>
                {record.user.firstName}
              </div>
              <div className="w26-d" style={{ fontSize: 30, color: accent, marginTop: 14, letterSpacing: -1 }}>
                as {record.character.name}
              </div>
              <div className="w26-billing" style={{ fontSize: 16, marginTop: 14, color: 'var(--w26-ink300)' }}>
                {record.character.archetype}
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>LAWEXA.COM/WRAPPED</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} {...stop}>
          {sheet ? (
            <div data-a="btn" role="group" aria-label="Share to" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {targets.map(({ platform, label, icon: Icon }) => (
                <button
                  key={platform}
                  type="button"
                  className="w26-btn w26-pill"
                  disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontSize: 32, padding: 26, color: 'inherit', background: 'transparent', borderColor: 'var(--line)', gridColumn: platform === 'save' ? 'span 2' : undefined }}
                  onClick={() => void share(platform)}
                >
                  <Icon aria-hidden size={36} />
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <button data-a="btn" type="button" className="w26-btn" style={{ background: 'var(--fg)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }} onClick={() => setSheet(true)}>
              <Share2 aria-hidden size={40} />
              {record.cta.share}
            </button>
          )}
          <button data-a="btn" type="button" className="w26-btn w26-pill" style={{ color: 'inherit', background: 'transparent', borderColor: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }} onClick={() => void invite()}>
            <UserPlus aria-hidden size={40} />
            {record.cta.invite}
          </button>
          {record.hasBarFinals ? (
            <a data-a="btn" href="/wrapped/bar-finals" className="w26-label" style={{ textAlign: 'center', textDecoration: 'underline', color: 'var(--muted)', padding: 20 }}>
              See your Bar Finals Wrapped
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
