/**
 * Wrapped 2026's view counts (Backend, 21 November 2026): POST
 * /api/wrapped/2026/me/progress, the Bar Finals body plus two optional
 * fields. `card` is the slide's place in the full kit order, 1 to 15
 * (story.ts cardNumber). The first guess rides on card 3 (02a) as `guess`,
 * 0 to 2; a share names its `platform` and `format`.
 *
 * Fire-and-forget, as in the Bar Finals edition (lib/wrapped/progress.ts):
 * open, each card and finish go once per visit, a share every time one
 * succeeds, and a failed send never stops the story.
 */

export type Wrapped26Platform = 'whatsapp' | 'instagram' | 'x' | 'linkedin' | 'save';

export type Wrapped26CardFormat = 'story' | 'square' | 'landscape';

export type Wrapped26Progress =
  | { event: 'open' }
  | { event: 'finish' }
  | { event: 'card'; card: number; guess?: number }
  | { event: 'share'; platform: Wrapped26Platform; format: Wrapped26CardFormat };

export type SendWrapped26Progress = (progress: Wrapped26Progress) => Promise<unknown> | unknown;

export interface Wrapped26ProgressTracker {
  open(): void;
  card(card: number): void;
  /** The guess tapped on 02a (card 3), once: the server keeps the first. */
  guess(option: number): void;
  finish(): void;
  share(platform: Wrapped26Platform, format: Wrapped26CardFormat): void;
}

export function createWrapped26Tracker(send: SendWrapped26Progress): Wrapped26ProgressTracker {
  const sent = new Set<string>();
  const fire = (progress: Wrapped26Progress) => {
    try {
      void Promise.resolve(send(progress)).catch(() => {});
    } catch {
      // A failed send never stops the story.
    }
  };
  const once = (key: string, progress: Wrapped26Progress) => {
    if (sent.has(key)) return;
    sent.add(key);
    fire(progress);
  };
  return {
    open: () => once('open', { event: 'open' }),
    card: (card) => once(`card:${card}`, { event: 'card', card }),
    guess: (option) => once('guess', { event: 'card', card: 3, guess: option }),
    finish: () => once('finish', { event: 'finish' }),
    share: (platform, format) => fire({ event: 'share', platform, format }),
  };
}
