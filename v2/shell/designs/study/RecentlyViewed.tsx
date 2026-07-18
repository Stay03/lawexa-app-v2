'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BookText,
  History,
  NotebookPen,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { recentlyViewedQueries } from '@/v2/features/recently-viewed/queries';
import type { RecentlyViewedItem } from '@/types/recently-viewed';
import {
  FOCUS_RING,
  ModuleCard,
  ModuleEmpty,
  ModuleError,
  ModuleSkeletonRows,
  formatRelativeTime,
} from './parts';

/**
 * RecentlyViewed — the Study tab's "pick up what you were reading" module
 * (backend Ask A). Reads the `recentlyViewedQueries.recentsPeek()` peek — ONE
 * merged, interleaved feed of the cases, notes, and statutes the user last
 * opened, newest first — and renders a compact strip: a per-type icon, the
 * title, and the relative view time, each row linking to the real v1 content
 * route. Slotted at the TOP of the Study rail, above Study spaces.
 *
 * Rendered by StudyHome only for signed-in users (the rail never mounts for
 * guests). Skeleton → content cross-fade, a distinct error (never
 * error-as-empty), and a quiet empty state. A sparse / short page is NORMAL:
 * statute view history only accrues from the endpoint's deploy day and deleted
 * items are skipped — so nothing here assumes a full list.
 */

const MAX_ROWS = 8;

interface ResolvedRow {
  href: string;
  Icon: LucideIcon;
  title: string;
}

/**
 * Map a feed row to its route, icon, and title by content type. Each `item` is
 * the SAME summary payload its list page consumes, so the title fields match v1
 * exactly (cases/notes/statutes name their titles differently). The switch on
 * the `type` discriminant narrows `item` to Case / Note / Statute in each arm.
 */
function resolveRow(row: RecentlyViewedItem): ResolvedRow | null {
  switch (row.type) {
    case 'case':
      return {
        href: `/cases/${row.item.slug}`,
        Icon: Scale,
        title: row.item.display_title || row.item.title,
      };
    case 'note':
      return {
        href: `/notes/${row.item.slug}`,
        Icon: NotebookPen,
        title: row.item.title,
      };
    case 'statute':
      return {
        href: `/statutes/${row.item.slug}`,
        Icon: BookText,
        title: row.item.short_title || row.item.title,
      };
    default:
      // Forward-compat: the contract is closed to three types today, but if the
      // backend ever widens types[] the unknown rows are SKIPPED, not crashed on
      // (reviewer note — the union makes this arm unreachable until then).
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
    <ModuleCard title="Recently viewed" icon={History}>
      {query.isError ? (
        <ModuleError onRetry={() => query.refetch()}>
          Couldn&apos;t load your recent activity.
        </ModuleError>
      ) : query.isPending ? (
        <ModuleSkeletonRows rows={3} />
      ) : rows.length === 0 ? (
        <ModuleEmpty>Nothing viewed yet.</ModuleEmpty>
      ) : (
        <ul className="flex flex-col px-2 pb-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {rows.map((row) => {
            const resolved = resolveRow(row);
            if (!resolved) return null;
            const { href, Icon, title } = resolved;
            return (
              <li key={`${row.type}-${row.item.id}`}>
                <Link
                  href={href}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/60',
                    FOCUS_RING,
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground transition-colors group-hover:text-primary">
                    {title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                    {formatRelativeTime(row.viewed_at, now)}
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
