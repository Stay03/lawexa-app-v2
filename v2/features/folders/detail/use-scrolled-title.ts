'use client';

import { useCallback, useEffect, useState } from 'react';

import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { V2_SHELL_CONTENT_ID } from '@/v2/shell/shell-content';

/** Who publishes the folder's bar title, for an owned `clearHeaderContext`. */
export const FOLDER_TITLE_PUBLISHER = 'folder-screen';

/**
 * The folder's name in the phone bar ONLY once the page's heading has scrolled
 * away (Arthur, 17 October 2026, item 7; the bar's `scrolled` title kind in
 * `pushed-route.ts`). While the heading is on screen the bar stays empty, so
 * the name is never printed twice; scrolled past it, the bar says which folder
 * this is, as a Space's bar does.
 *
 * Returns the ref the heading takes. A callback ref, because the heading
 * mounts only once the folder has loaded, after this hook's first render. It
 * starts "on screen": the heading opens at the top of the pane, so the bar is
 * empty from the first frame and the observer only ever turns it on by
 * scrolling.
 */
export function useScrolledTitle(title: string | null): (node: HTMLElement | null) => (() => void) | undefined {
  const [onScreen, setOnScreen] = useState(true);

  const headingRef = useCallback((node: HTMLElement | null) => {
    if (node === null) return undefined;
    // The shell's content region is the folder page's scroller.
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      root: document.getElementById(V2_SHELL_CONTENT_ID),
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      setOnScreen(true);
    };
  }, []);

  useEffect(() => {
    if (title !== null && !onScreen) setHeaderContext({ title, confidential: false }, FOLDER_TITLE_PUBLISHER);
    else clearHeaderContext(FOLDER_TITLE_PUBLISHER);
  }, [title, onScreen]);
  useEffect(() => () => clearHeaderContext(FOLDER_TITLE_PUBLISHER), []);

  return headingRef;
}
