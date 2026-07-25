'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookText,
  History,
  NotebookPen,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import { recentlyViewedQueries } from '@/v2/features/recently-viewed/queries';
import type { RecentlyViewedItem } from '@/types/recently-viewed';
import {
  Module,
  ModuleEmpty,
  ModuleError,
  ModuleList,
  ModuleRow,
  ModuleSkeleton,
  RowIconTile,
  formatRelativeTime,
} from '../modules';

/**
 * RecentlyViewed — the Study tab's "pick up what you were reading" module
 * (backend Ask A). Reads the `recentlyViewedQueries.recentsPeek()` peek — ONE
 * merged, interleaved feed of the cases, notes, and statutes the user last
 * opened, newest first — and renders a compact strip: a per-type icon tile, the
 * title, its type label, and the relative view time, each row linking to the real
 * v1 content route. Slotted at the TOP of the Study rail.
 *
 * ROW HIERARCHY: the secondary line now carries the content TYPE ("Case" / "Note"
 * / "Statute") so a mixed feed is scannable at a glance — the leading tile and the
 * label agree, the title stays the primary line, the view time trails.
 *
 * Rendered by StudyHome only for signed-in users. A sparse / short page is NORMAL:
 * statute view history only accrues from the endpoint's deploy day and deleted
 * items are skipped — so nothing here assumes a full list.
 */

const MAX_ROWS = 8;

interface ResolvedRow {
  href: string;
  Icon: LucideIcon;
  title: string;
  label: string;
}

/**
 * Map a feed row to its route, icon, title, and type label by content type. Each
 * `item` is the SAME summary payload its list page consumes, so the title fields
 * match v1 exactly. The switch on the `type` discriminant narrows `item` to Case
 * / Note / Statute in each arm.
 */
function resolveRow(row: RecentlyViewedItem): ResolvedRow | null {
  switch (row.type) {
    case 'case':
      return {
        href: `/cases/${row.item.slug}`,
        Icon: Scale,
        title: row.item.display_title || row.item.title,
        label: 'Case',
      };
    case 'note':
      return {
        href: `/notes/${row.item.slug}`,
        Icon: NotebookPen,
        title: row.item.title,
        label: 'Note',
      };
    case 'statute':
      return {
        href: `/statutes/${row.item.slug}`,
        Icon: BookText,
        title: row.item.short_title || row.item.title,
        label: 'Statute',
      };
    default:
      // Forward-compat: the contract is closed to three types today, but if the
      // backend ever widens types[] the unknown rows are SKIPPED, not crashed on.
      return null;
  }
}

export function RecentlyViewed() {
  // `now` captured ONCE via a lazy initializer so no clock read runs in render
  // (React Compiler lint); view times are computed against this fixed anchor.
  const [now] = useState(() => Date.now());
  const query = useQuery(recentlyViewedQueries.recentsPeek());
  const rows = (query.data?.data ?? []).slice(0, MAX_ROWS);

  return (
    <Module title="Recently viewed" icon={History}>
      {query.isError ? (
        <ModuleError
          message="Couldn't load your recent activity"
          onRetry={() => query.refetch()}
        />
      ) : query.isPending ? (
        // Shared median reservation (see `ModuleSkeleton`). Emphatically NOT
        // MAX_ROWS here: a sparse page is normal for this feed (see above), so a
        // cap-sized skeleton would collapse the hardest of any module.
        <ModuleSkeleton />
      ) : rows.length === 0 ? (
        <ModuleEmpty icon={History} title="Nothing viewed yet" />
      ) : (
        <ModuleList>
          {rows.map((row) => {
            const resolved = resolveRow(row);
            if (!resolved) return null;
            const { href, Icon, title, label } = resolved;
            return (
              <ModuleRow
                key={`${row.type}-${row.item.id}`}
                href={href}
                leading={<RowIconTile icon={Icon} />}
                title={title}
                secondary={label}
                meta={formatRelativeTime(row.viewed_at, now)}
              />
            );
          })}
        </ModuleList>
      )}
    </Module>
  );
}
