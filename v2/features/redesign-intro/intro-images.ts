'use client';

import { useSyncExternalStore } from 'react';

import type { IntroImage } from './model';

/**
 * Loads the pop-up's pictures before it may open (Stay, 25 October 2026: the
 * pop-up must not open until its images have fully loaded, and never as a
 * broken card). Every picture is fetched and decoded up front; the card opens
 * only when all of them are ready. If one fails, or they are not all in within
 * {@link INTRO_IMAGES_TIMEOUT_MS}, the pop-up stays shut for this page load,
 * and, since it was never seen, it is offered again next time.
 *
 * No pictures (the placeholder band) counts as ready at once.
 */

export type ImagesStatus = 'loading' | 'ready' | 'failed';

/** Past this, a slow picture counts as failed for this page load (ms). */
export const INTRO_IMAGES_TIMEOUT_MS = 10_000;

/** What a set of pictures adds up to: ready only when every one loaded, failed as soon as one failed. */
export function imagesStatus(results: readonly ('loading' | 'loaded' | 'failed')[]): ImagesStatus {
  if (results.some((result) => result === 'failed')) return 'failed';
  return results.every((result) => result === 'loaded') ? 'ready' : 'loading';
}

let status: ImagesStatus = 'loading';
let started = false;
const listeners = new Set<() => void>();

function settle(next: ImagesStatus): void {
  if (status !== 'loading') return;
  status = next;
  for (const listener of listeners) listener();
}

function load(images: readonly IntroImage[]): void {
  if (started) return;
  started = true;
  if (images.length === 0) {
    settle('ready');
    return;
  }
  const results: ('loading' | 'loaded' | 'failed')[] = images.map(() => 'loading');
  const timer = window.setTimeout(() => settle('failed'), INTRO_IMAGES_TIMEOUT_MS);
  images.forEach((image, index) => {
    const element = new Image();
    const done = (result: 'loaded' | 'failed') => {
      results[index] = result;
      const now = imagesStatus(results);
      if (now !== 'loading') {
        window.clearTimeout(timer);
        settle(now);
      }
    };
    element.onload = () => {
      // Decoded too, so the first frame of the card already has the picture.
      if (typeof element.decode === 'function') element.decode().then(() => done('loaded'), () => done('loaded'));
      else done('loaded');
    };
    element.onerror = () => done('failed');
    element.src = image.src;
  });
}

/**
 * The pictures' state, starting their load on the first read in the browser.
 * The server snapshot is "loading": nothing opens before the client has them.
 */
export function useIntroImages(images: readonly IntroImage[], enabled: boolean): ImagesStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      if (enabled) load(images);
      return () => listeners.delete(listener);
    },
    () => status,
    () => 'loading',
  );
}
