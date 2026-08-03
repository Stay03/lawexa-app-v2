'use client';

import { GraduationCap, Landmark, NotebookPen, Scale } from 'lucide-react';

import { cn } from '@/lib/utils';
import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import type { UserRole } from '@/types/auth';
import { useV2Session } from '@/v2/runtime/session-context';
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
 * ── WHY IT READS THE SESSION ITSELF (it used to be hook-free) ───────────────
 * Quiz is in soft launch for research accounts, so its pill must not appear for
 * anyone else — the same "no trace" rule the sidebar and drawer apply through
 * `visibleNavItems`. The obvious implementation, a `role` PROP, would have
 * broken the geometry contract above: `ChatHome` has a role to pass but
 * `HomeFallback` has none (it is drawn while the session is still resolving), so
 * the reserved row and the real row would disagree by one pill — exactly the
 * one-vs-two-line wrap this component exists to prevent.
 *
 * Reading `useV2Session()` removes the divergence at the source: the snapshot is
 * published by `app/v2/layout.tsx`, which sits ABOVE both the page and its
 * `loading.tsx`, and it is already resolved on the server before either renders.
 * So the fallback and the surface ask the same question and get the same answer,
 * on the first frame, in both directions — no prop threading, no drift, no
 * flash. (This is also why the component may now be `'use client'`: its only two
 * consumers, `ChatHome` and `HomeFallback`, already are.)
 *
 * NOT A SECURITY BOUNDARY — it hides an entry point. The route's own gate
 * (`v2/features/quiz/access.tsx`) and the backend decide access.
 */

interface QuickAction {
  href: string;
  label: string;
  Icon: typeof Scale;
  /** Omitted ⇒ visible to everyone (the same contract as `nav.config.ts`). */
  canAccess?: (role: UserRole | null) => boolean;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { href: '/cases', label: 'Cases', Icon: Scale },
  { href: '/statutes', label: 'Statutes', Icon: Landmark },
  { href: '/notes', label: 'Notes', Icon: NotebookPen },
  { href: '/quiz', label: 'Quiz', Icon: GraduationCap, canAccess: canAccessQuizPlayer },
];

export function HomeQuickJump() {
  const { role } = useV2Session();
  const actions = QUICK_ACTIONS.filter(
    (action) => action.canAccess?.(role) ?? true,
  );

  return (
    <nav aria-label="Quick links" className={CHAT_QUICK_JUMP}>
      {actions.map(({ href, label, Icon }) => (
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
