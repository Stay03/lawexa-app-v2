'use client';

import { useEffect } from 'react';

/**
 * Loads the conversation screen's code before anyone taps a chat.
 *
 * WHY. The chat route renders `ConversationScreen` (app/v2/c/[conversationId]/
 * page.tsx), and its code, the message list, the markdown and the streaming
 * engine come down only when the route is asked for. When a phone discards the
 * page while the person is in another app, the page loads again on return
 * without that code, and the first tap on a chat waited while the bundler loaded
 * and ran it: tap response 511 to 1,567 ms on live, the main thread busy for
 * nearly all of it (8 October 2026, CPU x4, against 91 to 142 ms when the page
 * was kept). Loading it while the page sits idle takes that work off the tap.
 *
 * WHERE. Mounted on the two screens a chat is opened from: the conversation
 * list (ConversationsList) and the home (V2Home, every tab: the home's recents,
 * and the rail and drawer recents over it). Signed-in readers only; a guest has
 * no chats to open.
 *
 * WHAT IT COSTS. The screen's code is fetched once per page life, even if no
 * chat is opened: from the browser's cache on a return visit (the service worker
 * keeps it), from the server on a first visit. A reader who asked for less data
 * (Save-Data) or is on a 2G connection pays for it only when they open a chat.
 */

type Loader = () => Promise<unknown>;

/** The same module the chat route renders, so the route finds it loaded. */
const loadScreen: Loader = () => import('./conversation/ConversationScreen');

let started = false;

/** Start loading the screen's code, once per page life. A failed load may be tried again. */
export function preloadConversationScreen(load: Loader = loadScreen): void {
  if (started) return;
  started = true;
  load().catch(() => {
    started = false;
  });
}

/** For tests: forget that the load started. */
export function resetConversationScreenPreload(): void {
  started = false;
}

/** The part of the Network Information API this reads. Not in every engine's lib.dom. */
export interface ConnectionHints {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Whether code nobody asked for is worth downloading on this connection: not
 * when the reader turned on Save-Data, and not on a 2G link, where the download
 * would compete with what they are reading. No hints (Safari, Firefox) means yes.
 */
export function preloadAllowed(connection: ConnectionHints | undefined): boolean {
  if (!connection) return true;
  if (connection.saveData === true) return false;
  return connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g';
}

/** How long to wait where the browser has no idle callback (Safari). */
export const PRELOAD_FALLBACK_MS = 1200;

/** The longest the idle callback may wait on a page that is never idle. */
const PRELOAD_IDLE_TIMEOUT_MS = 3000;

/** Preload the screen once the page has drawn and the browser is idle. */
export function usePreloadConversationScreen(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const connection = (navigator as Navigator & { connection?: ConnectionHints }).connection;
    if (!preloadAllowed(connection)) return;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => preloadConversationScreen(), {
        timeout: PRELOAD_IDLE_TIMEOUT_MS,
      });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => preloadConversationScreen(), PRELOAD_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [enabled]);
}
