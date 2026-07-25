'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bookmark as BookmarkIcon,
  FileText,
  FolderOpen,
  Landmark,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import { bookmarksQueries } from '@/v2/features/bookmarks/queries';
import type {
  Bookmark,
  BookmarkCaseContent,
  BookmarkFolderContent,
  BookmarkNoteContent,
  BookmarkStatuteContent,
} from '@/types/bookmark';
import {
  Module,
  ModuleEmpty,
  ModuleError,
  ModuleList,
  ModuleRow,
  ModuleSkeleton,
  RowIconTile,
} from '../modules';

/**
 * RecentBookmarks — the Study tab's "your saved content" module (owner #34).
 * Reads the `bookmarksQueries.recents()` peek and renders a compact strip: a
 * per-content-type icon tile, the title, and a quiet subline, each row linking to
 * the real v1 content route. The folder's CUSTOM icon/colour lives behind the
 * boundary-blocked `components/folders`, so folders use a generic lucide
 * FolderOpen here (a per-type icon, just not the folder's bespoke art).
 *
 * ROW HIERARCHY: the same anatomy as every other list — icon tile, title, and one
 * secondary line carrying the type-specific context (a case citation, a statute
 * year, a note preview, a folder's item count).
 *
 * Rendered by StudyHome only for signed-in users.
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
    <Module
      title="Bookmarks"
      icon={BookmarkIcon}
      action={{ href: '/bookmarks', label: 'All' }}
    >
      {bookmarksQuery.isError ? (
        <ModuleError
          message="Couldn't load your bookmarks"
          onRetry={() => bookmarksQuery.refetch()}
        />
      ) : bookmarksQuery.isPending ? (
        // Shared median reservation — see `ModuleSkeleton`.
        <ModuleSkeleton />
      ) : bookmarks.length === 0 ? (
        <ModuleEmpty icon={BookmarkIcon} title="Nothing saved yet" />
      ) : (
        <ModuleList>
          {bookmarks.map((bookmark) => {
            const { href, Icon, title, subtitle } = resolveBookmark(bookmark);
            return (
              <ModuleRow
                key={`${bookmark.type}-${bookmark.id}`}
                href={href}
                leading={<RowIconTile icon={Icon} />}
                title={title}
                secondary={subtitle}
              />
            );
          })}
        </ModuleList>
      )}
    </Module>
  );
}
