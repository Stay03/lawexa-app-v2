import type { WrappedSlideNumber } from './types';

/**
 * Wrapped view tracking (Stay's go, f833c285 4384a3a6; Techlead 462b8946):
 * the story tells the server it was opened, which card was shown, that it
 * reached the end, and that it was shared or saved, so the admin page can
 * count how far students got.
 *
 * Backend's contract (e717a1af): POST /api/wrapped/me/progress with
 * `{event, card}`, `card` only for "card". The server keeps every step
 * forward only, so a repeat is harmless; still, `open`, each card and
 * `finish` go once per visit. A share goes EACH time one succeeds, since the
 * server counts shares. Fire-and-forget: a send that fails or throws is
 * swallowed, so the story never waits on it and never stops for it. Pure
 * apart from the `send` it is given, so a test pins the rules.
 *
 * `card` is the frame's own number (1 to 8, the share card 8), the numbers
 * the admin summary's `reached` counts by, so a short story's share card is
 * counted as card 8.
 */

export type WrappedProgressEvent = 'open' | 'card' | 'finish' | 'share';

export type WrappedProgress = { event: 'card'; card: WrappedSlideNumber } | { event: 'open' | 'finish' | 'share' };

export type SendProgress = (progress: WrappedProgress) => Promise<unknown> | unknown;

export interface ProgressTracker {
  /** The story opened. */
  open(): void;
  /** A card was shown. */
  card(card: WrappedSlideNumber): void;
  /** The last card was reached. */
  finish(): void;
  /** A share or save succeeded: Share to your story, Instagram, TikTok, Save image. Every time. */
  share(): void;
}

export function createProgressTracker(send: SendProgress): ProgressTracker {
  const sent = new Set<string>();
  const fire = (progress: WrappedProgress) => {
    try {
      void Promise.resolve(send(progress)).catch(() => {});
    } catch {
      // A failed send never stops the story.
    }
  };
  const once = (key: string, progress: WrappedProgress) => {
    if (sent.has(key)) return;
    sent.add(key);
    fire(progress);
  };
  return {
    open: () => once('open', { event: 'open' }),
    card: (card) => once(`card:${card}`, { event: 'card', card }),
    finish: () => once('finish', { event: 'finish' }),
    share: () => fire({ event: 'share' }),
  };
}
