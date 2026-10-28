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
 * Read once, as the box mounts (the boxes' lazy initial state), then taken out
 * of the address, so a reload or a Back does not fill the box a second time.
 */
export const ASK_PARAM = 'ask';

/** The words a quiz request starts with: the reader names the topic. */
export const QUIZ_ASK_PROMPT = 'Make me a quiz on ';

/** Where a link opens the box: `/` for the home, `/spaces/{uuid}` for a Space. */
export function askHref(path: string, prompt: string): string {
  return `${path}?${ASK_PARAM}=${encodeURIComponent(prompt)}`;
}

/** The words the address carries, or `null`. A client-only read. */
export function readAskParam(): string | null {
  if (typeof window === 'undefined') return null;
  const ask = new URLSearchParams(window.location.search).get(ASK_PARAM);
  return ask ? ask : null;
}

/**
 * After the box has its words: focus it with the cursor at their end, so the
 * keyboard opens on a phone, and take the words out of the address.
 * `container` holds the box's textarea. `asDraft` also stores the words as the
 * home's draft (`useComposerDraft`), so a box that mounts again before the
 * reader types still has them.
 */
export function useAskArrival(container: RefObject<HTMLElement | null>, asDraft = false): void {
  useEffect(() => {
    const ask = readAskParam();
    if (!ask) return;
    if (asDraft) saveComposerDraft(ask);
    const textarea = container.current?.querySelector('textarea');
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete(ASK_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [container, asDraft]);
}
