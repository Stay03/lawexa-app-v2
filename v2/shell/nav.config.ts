import {
  Bookmark,
  Boxes,
  FileText,
  GraduationCap,
  Library,
  MessageSquare,
  NotebookPen,
  PenSquare,
  Radar,
  Scale,
  BookText,
  type LucideIcon,
} from 'lucide-react';

import type { UserRole } from '@/types/auth';
import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import { canAccessSpaces } from '@/lib/utils/spaces-access';

/**
 * v2 shell navigation — the SINGLE source of truth for both the desktop sidebar
 * (`V2Sidebar`) and the mobile drawer (`V2Drawer`). Overhaul-plan §1: the shell
 * reads ONE config so the two surfaces can never drift.
 *
 * Hrefs point at their canonical CLEAN paths; unmigrated routes fall through the
 * proxy to the v1 page — the intended strangler experience.
 *
 * ── ROLE GATING LIVES HERE, NOT IN THE SURFACES ─────────────────────────────
 * An item may declare {@link V2NavItem.canAccess}, a predicate over the
 * SERVER-VERIFIED role. Both nav surfaces filter through {@link visibleNavItems}
 * with the role the v2 layout already resolved, so a gated row can never appear
 * in one surface and not the other — the exact drift `nav.config.ts` exists to
 * prevent. An item with no predicate is visible to everyone, so adding a row
 * stays a one-line change.
 *
 * A predicate is always a REUSED pure helper (`canAccessQuizPlayer`,
 * `canAccessSpaces`), never a role list re-declared here: each audience is
 * defined once, in its `lib/utils/*-access.ts` module, and widening it later is
 * still the one-line change those modules promise.
 *
 * NOT A SECURITY BOUNDARY. Hiding a link hides an entry point; the route's own
 * gate (`v2/features/quiz/access.tsx`) and the backend decide access. A user who
 * types the URL meets a designed panel, not a broken page.
 */

/** A terminal nav destination (leaf row or a Library child). */
export interface V2NavLeaf {
  label: string;
  /**
   * Canonical CLEAN path (never a /v2-prefixed one). Unmigrated routes fall
   * through the proxy to the v1 page — the intended strangler experience: v2
   * shell, v1 content, until each route joins routes.manifest.ts.
   */
  href: string;
  icon?: LucideIcon;
}

/** A top-level nav row; `items` makes it an expandable group (e.g. Library). */
export interface V2NavItem extends V2NavLeaf {
  items?: V2NavLeaf[];
  /**
   * Optional visibility predicate over the server-verified role (`null` when
   * signed out). Omitted ⇒ visible to everyone. See the module docblock.
   */
  canAccess?: (role: UserRole | null) => boolean;
}

/** The gold primary action pinned at the top of the sidebar / bottom of the drawer. */
export const v2NewChat: V2NavLeaf = {
  label: 'New chat',
  href: '/',
  icon: PenSquare,
};

/**
 * Primary navigation, in display order. Mirrors v1's `app-sidebar` item set
 * (Conversations, Library → Cases/Statutes/Notes/Files, Bookmarks, Spaces,
 * Quiz), minus the v1 clutter that isn't part of the v2 shell yet.
 */
export const v2NavItems: V2NavItem[] = [
  { label: 'Conversations', href: '/conversations', icon: MessageSquare },
  { label: 'Radar', href: '/radars', icon: Radar },
  {
    label: 'Library',
    href: '/cases',
    icon: Library,
    items: [
      { label: 'Cases', href: '/cases', icon: Scale },
      { label: 'Statutes', href: '/statutes', icon: BookText },
      { label: 'Notes', href: '/notes', icon: NotebookPen },
      { label: 'Files', href: '/files', icon: FileText },
    ],
  },
  { label: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
  {
    label: 'Spaces',
    href: '/spaces',
    icon: Boxes,
    // Spaces still lives in v1 behind its own soft-launch gate, and that gate
    // REDIRECTS outsiders to home. With the v2 preview open to every registered
    // account (Aug 3, 2026), an ungated row would send most users into that
    // bounce — so the row shares the feature's audience helper until the
    // phase-5 rebuild replaces the redirect with a designed state.
    canAccess: canAccessSpaces,
  },
  {
    label: 'Quiz',
    href: '/quiz',
    icon: GraduationCap,
    // Quiz is in soft launch for research accounts (docs/quiz/main-plan.md §2),
    // so everyone else gets no entry point — the same "no trace" rule v1's
    // sidebar applies, expressed through the shared audience helper.
    canAccess: canAccessQuizPlayer,
  },
];

/**
 * The nav rows THIS viewer may see. Both surfaces call it with the role the v2
 * layout resolved, so the desktop rail and the mobile drawer always agree.
 */
export function visibleNavItems(role: UserRole | null): V2NavItem[] {
  return v2NavItems.filter((item) => item.canAccess?.(role) ?? true);
}
