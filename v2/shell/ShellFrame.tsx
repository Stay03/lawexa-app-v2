'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { isTopLevelRoute } from './top-level-route';

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
 * ── WHY IT IS A CLASS ON THE ROOT AND NOT AN ATTRIBUTE WRITTEN LATER ───────
 * `route-motion.tsx` writes its attribute onto the content region from an
 * effect, which is right for a per-navigation animation and wrong for this: a
 * class applied one paint late would show the reader the opaque bar, then the
 * see-through one, with the whole page jumping up by the bar's height in
 * between. The answer comes from the address (`top-level-route.ts`), so it is
 * available in RENDER — the same value on the server render, the first client
 * paint and every paint after it.
 */
export function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  return (
    <div className={cn('v2-shell', isTopLevelRoute(pathname) && 'v2-shell--open')}>
      {children}
    </div>
  );
}
