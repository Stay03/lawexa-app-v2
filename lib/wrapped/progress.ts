import type { WrappedSlideNumber } from './types';

/**
 * Wrapped view tracking (Stay's go, f833c285 4384a3a6; Techlead 462b8946):
 * the story tells the server it was opened, which card was shown, that it
 * reached the end, and that it was shared or saved, so the admin page can
 * count how far students got.
 *
 * Each event goes once per visit (per card for `card`), and fire-and-forget:
 * a send that fails or throws is swallowed, so the story never waits on it
 * and never stops for it. Pure apart from the `send` it is given, so a test
 * pins the rules.
 */

export type WrappedProgressEvent = 'open' | 'card' | 'finish' | 'share';

export interface WrappedProgress {
  event: WrappedProgressEvent;
  card: WrappedSlideNumber;
}

export type SendProgress = (progress: WrappedProgress) => Promise<unknown> | unknown;

export interface ProgressTracker {
  /** The story opened, on the card it opened on. */
  open(card: WrappedSlideNumber): void;
  /** A card was shown. */
  card(card: WrappedSlideNumber): void;
  /** The last card was reached. */
  finish(card: WrappedSlideNumber): void;
  /** Share to your story, Instagram, TikTok, or Save image. */
  share(card: WrappedSlideNumber): void;
}

export function createProgressTracker(send: SendProgress): ProgressTracker {
  const sent = new Set<string>();
  const once = (key: string, progress: WrappedProgress) => {
    if (sent.has(key)) return;
    sent.add(key);
    try {
      void Promise.resolve(send(progress)).catch(() => {});
    } catch {
      // A failed send never stops the story.
    }
  };
  return {
    open: (card) => once('open', { event: 'open', card }),
    card: (card) => once(`card:${card}`, { event: 'card', card }),
    finish: (card) => once('finish', { event: 'finish', card }),
    share: (card) => once('share', { event: 'share', card }),
  };
}
