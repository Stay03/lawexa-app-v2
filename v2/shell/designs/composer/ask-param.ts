'use client';

import { useEffect, type RefObject } from 'react';

import { saveComposerDraft } from './useComposerDraft';

/**
 * A link that opens a chat box with words already in it (Arthur, 28 October
 * 2026: "Create with Lawexa" on the quiz form opens a chat ready for a quiz
 * request). `/?ask=…` fills the home's box, `/spaces/{uuid}?ask=…` a Space's.
 * The words are never sent for the reader: the box is focused with the cursor
 * after them, and the reader finishes the sentence and sends it.
 *
 * TWO WAYS IN, ONE READ. A tap on the link inside the app queues the words
 * (`queueAsk`) before Next moves: Next draws the new page BEFORE it changes
 * the address, so a box that read only the address would mount empty (seen on
 * a computer, 28 October 2026). A link opened in a new tab, or reloaded, has
 * only the address. `readAsk` takes the queued words first, then the
 * address's, as the box mounts (the boxes' lazy initial state); the box's
 * arrival (`useAskArrival`) then clears both, so a reload or a Back does not
 * fill the box a second time.
 */
export const ASK_PARAM = 'ask';

/** The words a quiz request starts with: the reader names the topic. */
export const QUIZ_ASK_PROMPT = 'Make me a quiz on ';

/** Which box the words are for: the home's, or one Space's. */
export type AskTarget = { kind: 'home' } | { kind: 'space'; spaceUuid: string };

/** Where a link opens the box. */
export function askHref(target: AskTarget, prompt: string): string {
  const path = target.kind === 'home' ? '/' : `/spaces/${target.spaceUuid}`;
  return `${path}?${ASK_PARAM}=${encodeURIComponent(prompt)}`;
}

/** The words a tap queued for the next box, until that box arrives. */
let queued: { target: AskTarget; prompt: string } | null = null;

/** Call from the link's own tap, before Next moves. */
export function queueAsk(target: AskTarget, prompt: string): void {
  queued = { target, prompt };
}

const sameTarget = (a: AskTarget, b: AskTarget) =>
  a.kind === 'home' ? b.kind === 'home' : b.kind === 'space' && a.spaceUuid === b.spaceUuid;

/** The words for this box, queued or in the address, or `null`. A client-only read. */
export function readAsk(target: AskTarget): string | null {
  if (typeof window === 'undefined') return null;
  if (queued && sameTarget(queued.target, target)) return queued.prompt;
  const ask = new URLSearchParams(window.location.search).get(ASK_PARAM);
  return ask ? ask : null;
}

/**
 * After the box has its words: focus it with the cursor at their end, so the
 * keyboard opens on a phone, and clear the queue and the address. `container`
 * holds the box's textarea. On the home the words are also stored as its draft
 * (`useComposerDraft`), so a box that mounts again before the reader types
 * still has them.
 */
export function useAskArrival(container: RefObject<HTMLElement | null>, target: AskTarget): void {
  const spaceUuid = target.kind === 'space' ? target.spaceUuid : null;
  useEffect(() => {
    const here: AskTarget = spaceUuid === null ? { kind: 'home' } : { kind: 'space', spaceUuid };
    const ask = readAsk(here);
    if (!ask) return;
    queued = null;
    if (here.kind === 'home') saveComposerDraft(ask);
    const textarea = container.current?.querySelector('textarea');
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
    const url = new URL(window.location.href);
    if (!url.searchParams.has(ASK_PARAM)) return;
    url.searchParams.delete(ASK_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [container, spaceUuid]);
}
