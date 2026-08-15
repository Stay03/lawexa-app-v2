import {
  Bookmark,
  Boxes,
  FolderClosed,
  GraduationCap,
  Library,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  PenSquare,
  Radar,
  Scale,
  BookText,
  type LucideIcon,
} from 'lucide-react';

import type { UserRole } from '@/types/auth';
import { canAccessCollab } from '@/lib/utils/collab-audience';
import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';

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
 * `canAccessCollab`), never a role list re-declared here: each audience is
 * defined once, in its own `lib/utils/` module, and widening it later is still
 * the one-line change those modules promise. Widening Spaces at the phase-5
 * ship was exactly that: one import swapped, no role list edited.
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

/**
 * A live signal a row may carry — the unread grammar rendered on the
 * navigation itself, so the nav becomes a triage surface instead of a list of
 * doors. The config names WHICH signal; the surfaces render it through the
 * feature that owns the data (`v2/features/channels/my-channels/nav-signal`),
 * because a shell config may not hold a query. One id today; the union is the
 * point — a second signal must be declared here, never inlined in a surface,
 * or the rail and the drawer start disagreeing again.
 */
export type V2NavSignalId = 'channels';

/** A top-level nav row; `items` makes it an expandable group (e.g. Library). */
export interface V2NavItem extends V2NavLeaf {
  items?: V2NavLeaf[];
  /**
   * Optional visibility predicate over the server-verified role (`null` when
   * signed out). Omitted ⇒ visible to everyone. See the module docblock.
   */
  canAccess?: (role: UserRole | null) => boolean;
  /** Optional live unread signal on this row. See {@link V2NavSignalId}. */
  signalId?: V2NavSignalId;
}

/** The gold primary action pinned at the top of the sidebar / bottom of the drawer. */
export const v2NewChat: V2NavLeaf = {
  label: 'New chat',
  href: '/',
  icon: PenSquare,
};

/**
 * Primary navigation, in display order. It began as v1's `app-sidebar` item set
 * (Conversations, Library → Cases/Statutes/Notes/Files, Bookmarks, Spaces,
 * Quiz), minus the v1 clutter that isn't part of the v2 shell yet. Files has
 * since been removed from Library; the reason is written where the row was.
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
      { label: 'Folders', href: '/folders', icon: FolderClosed },
      // FILES IS DELIBERATELY NOT HERE. `/files` has no v2 route, so the proxy
      // fell through to v1 and the row landed the reader on v1's onboarding
      // wall, "What best describes you?", with no header and no way back into
      // v2. Measured on production, 15 August 2026, on the phone audit.
      //
      // Taken out rather than repaired on the owner's instruction the same day:
      // "Remove files, we'll work on vault and unify files and folders with new
      // features later." So the row comes back with that work, and pointing it
      // at a v1 page in the meantime would only teach people the app is broken.
    ],
  },
  { label: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
  {
    // THE CONVERSATIONS YOU ARE IN, above the places they live (redesign
    // wave, Aug 5). `/channels` was the best-built row in the collab feature —
    // the only one that previews content — and NOTHING linked to it: the list
    // of your own conversations, which is the home screen of every chat
    // product, was reachable only by typing the URL. It sits above Spaces
    // because triage comes before navigation: you open a channel far more
    // often than you go looking for the space it belongs to.
    //
    // Same audience predicate as Spaces, from the same shared helper — the two
    // collab doors can never drift apart on who may see them.
    label: 'Channels',
    href: '/channels',
    icon: MessagesSquare,
    canAccess: canAccessCollab,
    signalId: 'channels',
  },
  {
    label: 'Spaces',
    href: '/spaces',
    icon: Boxes,
    // The v1 soft-launch gate (`canAccessSpaces`: researcher/admin/superadmin)
    // came OFF here at the phase-5 ship — owner decision D1, every registered
    // account. It only ever existed because v1's `SpacesGuard` REDIRECTED
    // outsiders to home, so an ungated row would have sent most users into a
    // bounce. `/spaces` now serves the v2 tree, whose layouts answer with
    // designed panels instead (`v2/features/collab/access.tsx`).
    //
    // The predicate that stays is the v2 AUDIENCE — the same shape Quiz uses,
    // excluding only the two unregistered roles. A guest gets no row and, if
    // they type the URL, the create-account panel: registering is the door.
    canAccess: canAccessCollab,
  },
  {
    label: 'Quiz',
    href: '/quiz',
    icon: GraduationCap,
    // Quiz is open to every registered account (owner, Aug 3 2026); the shared
    // helper excludes only guests and bots, who get a register nudge at the
    // route gate instead of a dead entry point here.
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
