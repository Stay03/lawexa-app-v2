'use client';

import { useCallback, useState } from 'react';

/**
 * Whether a preview's text runs past `lines` lines at the width it has now.
 *
 * The API caps a preview at 140 characters, which is two lines in the page
 * column on a desktop and three on a 390px phone (measured 2026-10-05), so the
 * same row is cut on one screen and whole on the other. Only a measurement can
 * say which, and a row that is not cut must not offer to expand.
 *
 * The element is measured against its own line height, not its box, so the
 * answer holds while the row is open (the box is then as tall as the text).
 * A ResizeObserver re-measures on every width change (rotation, a sidebar
 * folding); a row's preview text never changes, so width is the only input.
 * The first answer arrives after mount, so the server render and the first
 * client render agree on "not cut" and nothing mismatches on hydration.
 *
 * A CALLBACK REF, not an effect over a ref object. The answer can change the
 * row's element (a read row with nothing to do is a `<div>`; once its preview
 * is cut it becomes a `<button>`), which mounts a NEW preview element. An
 * effect would keep observing the old one, whose removal reports a zero box
 * and flips the answer back. The callback ref observes whichever element is
 * mounted, and a box with no width (detached, hidden) is not a measurement.
 */
export function usePreviewCut<T extends HTMLElement>(lines: number, enabled: boolean) {
  const [cut, setCut] = useState(false);

  const ref = useCallback(
    (element: T | null) => {
      if (!enabled || !element) return;
      const observer = new ResizeObserver(() => {
        if (element.clientWidth === 0) return;
        const style = getComputedStyle(element);
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
        // One pixel of slack for sub-pixel line boxes.
        setCut(element.scrollHeight > lineHeight * lines + 1);
      });
      observer.observe(element);
      return () => observer.disconnect();
    },
    [enabled, lines],
  );

  return { ref, cut: enabled && cut };
}
