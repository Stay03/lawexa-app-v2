import { GraduationCap, Landmark, NotebookPen, Scale } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from './modules';
import { CHAT_QUICK_JUMP, CHAT_QUICK_JUMP_ITEM } from './home-frame';

/**
 * HomeQuickJump — the Chat tab's quiet MOBILE-ONLY quick-jump row (owner #20:
 * desktop already has the sidebar, so this is `md:hidden`). Real `<a>` links to
 * the canonical clean paths, which fall through the v2 proxy to the v1 screens —
 * deliberately full-page navigations, not client-side router links.
 *
 * EXTRACTED from `ChatHome` so the route-level fallback can reserve this row at
 * its EXACT geometry. That matters more than it looks: the pills wrap, and where
 * they wrap depends on the label text, so a hand-drawn approximation would be one
 * row tall on some viewports and two on others — a guaranteed jump at hand-off.
 * Sharing the one component makes the reserved row and the real row identical by
 * construction.
 *
 * This is STATIC CHROME — fixed labels, fixed routes, zero data. Per the v2
 * loading convention it therefore NEVER gets a skeleton: the fallback renders
 * this very component, just inert.
 *
 * Presentational and hook-free, so both the client surface and the fallback can
 * import it.
 */

const QUICK_ACTIONS = [
  { href: '/cases', label: 'Cases', Icon: Scale },
  { href: '/statutes', label: 'Statutes', Icon: Landmark },
  { href: '/notes', label: 'Notes', Icon: NotebookPen },
  { href: '/quiz', label: 'Quiz', Icon: GraduationCap },
] as const;

export function HomeQuickJump() {
  return (
    <nav aria-label="Quick links" className={CHAT_QUICK_JUMP}>
      {QUICK_ACTIONS.map(({ href, label, Icon }) => (
        <a
          key={href}
          href={href}
          className={cn(
            'v2-interactive',
            CHAT_QUICK_JUMP_ITEM,
            'hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {label}
        </a>
      ))}
    </nav>
  );
}
