'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { useShownPathname } from './move-first';
import { hasOpenBar, isChatRoute } from './top-level-route';

/**
 * ShellFrame — the shell's grid root, and the ONE element that says whether
 * this screen's bar is see-through.
 *
 * ── WHY THIS IS A CLIENT COMPONENT AND `AppShell` IS NOT ────────────────────
 * The shell is composed by `app/v2/layout.tsx`, which is a server component and
 * — by design — does not re-render on a soft navigation. It therefore cannot
 * know which route is on screen. Something in the shell has to read the
 * pathname, and this is the smallest thing that can: it renders one `div`, has
 * no state and no effects, and its `children` are handed straight through, so
 * every server-rendered thing inside it stays server-rendered.
 *
 * ── WHY IT IS RENDERED ON THE ROOT AND NOT WRITTEN LATER ───────────────────
 * `route-motion.tsx` writes its attribute onto the content region from an
 * effect, which is right for a per-navigation animation and wrong for this: a
 * flag applied one paint late would show the reader the opaque bar, then the
 * see-through one, with the whole page jumping up by the bar's height in
 * between. The answer comes from the address (`top-level-route.ts`), so it is
 * available in RENDER — the same value on the server render, the first client
 * paint and every paint after it.
 *
 * ── DATA ATTRIBUTES, NEVER A CHANGING CLASS (16 October 2026) ───────────────
 * The two flags were classes, `.v2-shell--open` and `.v2-shell--chat`, so
 * opening a chat from the list changed this root's `class` attribute. The
 * typography plugin's prose rules exclude `not-prose` with selectors of the
 * form `:not(:where([class~=not-prose], [class~=not-prose] *))`, and against
 * those Chrome cannot tell which descendants a class change on an ancestor
 * affects, so it restyled the whole page: 860 elements, about 200 ms on a
 * phone at 4x CPU, forced at once by the transcript's land-at-the-bottom read
 * (trace with style invalidation tracking, chat reopen fix). A data attribute
 * restyles only the elements its own rules name. So this root's `class` never
 * changes after the first render, and the flags are `data-v2-open-bar` and
 * `data-v2-chat`, present or absent.
 */
export function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  // The bar's see-through ground follows the same path the bar draws for
  // (`useShownPathname`), so the two never disagree during a move-first tap.
  // The chat flag stays on the committed path: it moves the scroller, and the
  // screen under the tap's frame is still the old one.
  const shown = useShownPathname();
  return (
    <div
      className="v2-shell"
      data-v2-open-bar={hasOpenBar(shown) ? '' : undefined}
      // A conversation scrolls in its own transcript, not in the content
      // region, so the bar's room moves into that scroller (shell.css).
      data-v2-chat={isChatRoute(pathname) ? '' : undefined}
    >
      {children}
    </div>
  );
}
