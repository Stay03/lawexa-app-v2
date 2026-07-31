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

/**
 * v2 shell navigation — the SINGLE source of truth for both the desktop sidebar
 * (`V2Sidebar`) and the mobile drawer (`V2Drawer`). Overhaul-plan §1: the shell
 * reads ONE config so the two surfaces can never drift.
 *
 * This wave is UI-only: static config, no role gating (every item is shown to
 * everyone). Role-aware filtering (v1's `canAccessQuiz` / `canAccessSpaces` /
 * lawyer-verification) lands with the phase-3 data wiring. Hrefs point at their
 * canonical future `/v2/*` paths; those feature routes are built in later phases,
 * so following them 404s until then — expected for a shell-only wave.
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
  { label: 'Spaces', href: '/spaces', icon: Boxes },
  { label: 'Quiz', href: '/quiz', icon: GraduationCap },
];
