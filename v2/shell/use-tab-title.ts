'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { heldTitle, restoredTitle, tabTitleText } from './tab-title';

/**
 * Names the browser tab "{name} | Lawexa" while this screen is up, once its
 * name has loaded, and again when the name changes (a rename). On leaving it
 * puts back the title it found.
 *
 * NEXT WRITES ITS OWN TITLE AFTER THE SCREEN MOUNTS: on a full load the
 * metadata title streams in late, on an in-app move it arrives as a new
 * <title>. Either would replace this one, so a watch on <head> holds the
 * screen's title while the screen is up. It holds it only on this screen's
 * address: an in-app move away changes the address first, and the next page's
 * title is then left to stand. The comparison inside `heldTitle` keeps the
 * watch and app-badge's "(n) " prefix from writing in a loop.
 *
 * THE ADDRESS CAN MOVE UNDER A MOUNTED SCREEN: a new note's first save swaps
 * /notes/create for /notes/{slug}/edit with history.replaceState, and no
 * route changes. Next's pathname follows that swap, so the hold restarts on
 * the new address.
 */
export function useTabTitle(name: string | null | undefined): void {
  const text = tabTitleText(name);
  const routePath = usePathname();

  useEffect(() => {
    if (!text) return;
    const path = window.location.pathname;
    const previous = document.title;
    const hold = () => {
      if (window.location.pathname !== path) return;
      const next = heldTitle(document.title, text);
      if (document.title !== next) document.title = next;
    };
    hold();
    const observer = new MutationObserver(hold);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (window.location.pathname !== path) return;
      const next = restoredTitle(document.title, text, previous);
      if (document.title !== next) document.title = next;
    };
  }, [text, routePath]);
}
