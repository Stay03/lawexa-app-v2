'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark as BookmarkIcon,
  FileText,
  FolderOpen,
  Landmark,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { bookmarksQueries } from '@/v2/features/bookmarks/queries';
import type {
  Bookmark,
  BookmarkCaseContent,
  BookmarkFolderContent,
  BookmarkNoteContent,
  BookmarkStatuteContent,
} from '@/types/bookmark';
import {
  FOCUS_RING,
  ModuleCard,
  ModuleEmpty,
  ModuleError,
  ModuleSkeletonRows,
} from './parts';

/**
 * RecentBookmarks — the Study tab's "your saved content" module (owner #34).
 * Reads the `bookmarksQueries.recents()` peek and renders a compact strip: a
 * per-content-type icon, the title, and a quiet subline, each row linking to the
 * real v1 content route. The folder's CUSTOM icon/colour lives behind the
 * boundary-blocked `components/folders`, so folders use a generic lucide
 * FolderOpen here (a per-type icon, just not the folder's bespoke art).
 *
 * Rendered by StudyHome only for signed-in users. Skeleton → content cross-fade,
 * a distinct error (never error-as-empty), and a designed empty state.
 */

const MAX_ROWS = 5;

interface ResolvedBookmark {
  href: string;
  Icon: LucideIcon;
  title: string;
  subtitle: string | null;
}

/** Map a bookmark to its route, icon, title, and subline by content type. */
function resolveBookmark(bookmark: Bookmark): ResolvedBookmark {
  const { type, content } = bookmark;
  switch (type) {
    case 'case': {
      const c = content as BookmarkCaseContent;
      return {
        href: `/cases/${c.slug}`,
        Icon: Scale,
        title: c.display_title || c.title,
        subtitle: c.citation ?? null,
      };
    }
    case 'statute': {
      const c = content as BookmarkStatuteContent;
      return {
        href: `/statutes/${c.slug}`,
        Icon: Landmark,
        title: c.short_title || c.title,
        subtitle: c.year ? String(c.year) : null,
      };
    }
    case 'note': {
      const c = content as BookmarkNoteContent;
      return {
        href: `/notes/${c.slug}`,
        Icon: FileText,
        title: c.title,
        subtitle: c.content_preview || null,
      };
    }
    case 'folder': {
      const c = content as BookmarkFolderContent;
      return {
        href: `/folders/${c.uuid}`,
        Icon: FolderOpen,
        title: c.name,
        subtitle: `${c.items_count} ${c.items_count === 1 ? 'item' : 'items'}`,
      };
    }
  }
}

export function RecentBookmarks() {
  const bookmarksQuery = useQuery(bookmarksQueries.recents());
  const bookmarks = (bookmarksQuery.data?.data ?? []).slice(0, MAX_ROWS);

  return (
    <ModuleCard title="Bookmarks" icon={BookmarkIcon} action={{ label: 'All', href: '/bookmarks' }}>
      {bookmarksQuery.isError ? (
        <ModuleError onRetry={() => bookmarksQuery.refetch()}>
          Couldn&apos;t load your bookmarks.
        </ModuleError>
      ) : bookmarksQuery.isPending ? (
        <ModuleSkeletonRows rows={3} />
      ) : bookmarks.length === 0 ? (
        <ModuleEmpty>Nothing saved yet.</ModuleEmpty>
      ) : (
        <ul className="flex flex-col px-2 pb-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {bookmarks.map((bookmark) => {
            const { href, Icon, title, subtitle } = resolveBookmark(bookmark);
            return (
              <li key={`${bookmark.type}-${bookmark.id}`}>
                <Link
                  href={href}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/60',
                    FOCUS_RING,
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground transition-colors group-hover:text-primary">
                      {title}
                    </span>
                    {subtitle ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {subtitle}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ModuleCard>
  );
}
