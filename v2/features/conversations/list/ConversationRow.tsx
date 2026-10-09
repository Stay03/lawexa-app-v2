'use client';

import { MoveFirstLink } from '@/v2/shell/move-first';
import {
  ChevronRight,
  MessageSquare,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ConversationListItem } from '@/types/chat';
import {
  FOCUS_RING,
  REVEAL,
  RowIconTile,
  formatRelativeTime,
} from '@/v2/shell/designs/modules';

/**
 * ConversationRow — one row of the `/conversations` list, built on the shared
 * home-module ROW ANATOMY (leading identity tile → title → trailing metadata,
 * calm hover-tint lift, ≥44px target, tabular time) so it reads as the same
 * system as the Work/Study strips, while carrying the three things a full list
 * row needs that a home strip doesn't:
 *
 *  - CONFIDENTIAL IDENTITY (§E redesign): a confidential conversation gets the
 *    emerald ShieldCheck tile — the same emerald language the conversation
 *    surface + header badge use — so v2's honesty about confidential chats is
 *    visible here, where v1 hid it. Everything else gets the neutral message
 *    tile (`RowIconTile`).
 *  - ARCHIVED badge (v1 parity): archived conversations are shown INLINE (this
 *    page is the only place they're reachable), marked with a quiet badge.
 *  - CHEVRON affordance (§E keep): a quiet trailing chevron that nudges on hover.
 *
 * The whole row is one `Link` to `/c/{id}` (proxied to the v2 conversation
 * screen). `now` is threaded in from the list's lazy `useState` initializer so
 * NO clock read runs in render (React Compiler purity) — the same lint-clean
 * pattern the module strips use. The staggered entrance uses the module `REVEAL`
 * token, which is `motion-safe`-gated (v1's stagger was not — a standing-rule
 * violation §E flags); `style.animationDelay` supplies the per-row stagger and
 * the animation only plays on MOUNT, so persisting rows never re-animate on a
 * search change.
 *
 * DELETE sits in a trailing actions menu OUTSIDE the link (the `RadarRow` /
 * `FolderRow` anatomy: a real sibling control, never a click the link has to
 * swallow). The list owns the confirm dialog; the row only asks for it. A
 * confidential row gets no menu, because its only copy is on the device and
 * the open chat's banner owns that delete; a same-size spacer keeps its time
 * and chevron in the column the other rows use.
 *
 * THE EXIT is the bookmarks list's grid collapse (`useExitingRows`): the list
 * holds a deleted row for `ROW_EXIT_MS` with `exiting` set, and the row folds
 * instead of vanishing between frames.
 */
export function ConversationRow({
  conversation,
  now,
  index,
  exiting,
  reveal = true,
  onDelete,
}: {
  conversation: ConversationListItem;
  now: number;
  index: number;
  /** `true` while the row plays its exit after a delete. */
  exiting: boolean;
  /**
   * Play the staggered entrance. The list passes `false` when it mounts with
   * its rows already loaded (coming back to it): replaying the stagger from
   * opacity 0 on every return read as the list loading again (frame strip,
   * 8 October 2026).
   */
  reveal?: boolean;
  /** Opens the list's delete confirm for this row. */
  onDelete: () => void;
}) {
  const { id, title, status, updated_at, is_confidential } = conversation;
  const cleanTitle = stripPastedTags(title);
  const isArchived = status === 'archived';

  return (
    <li
      // The entrance class is dropped while exiting: its `fill-mode-both` would
      // keep asserting `opacity: 1` over the collapse (see `BookmarkRow`).
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none',
        exiting ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        !exiting && reveal && cn(REVEAL, 'duration-300'),
      )}
      // Cap the stagger at 14 rows (v1 parity) so a long list never waits on a
      // growing delay; motion-reduce drops the animation (token is motion-safe).
      // `duration-*` class + inline `animationDelay` is the module strips' idiom.
      style={exiting || !reveal ? undefined : { animationDelay: `${Math.min(index, 14) * 30}ms` }}
    >
      {/* `min-w-0` lets the grid track resolve to the column's width, so the
          title truncates instead of widening the row (the `BookmarkRow` fix). */}
      <div
        className={cn(
          'flex min-w-0 items-center gap-1',
          exiting && 'overflow-hidden',
        )}
      >
        {/* MoveFirstLink: the conversation's frame paints in the frame of the
            tap, before any route work (v2/shell/move-first.tsx). */}
        <MoveFirstLink
          href={`/c/${id}`}
          kind="conversation"
          title={cleanTitle}
          header={{ title: cleanTitle, confidential: Boolean(is_confidential) }}
          headerOwner={id}
          aria-label={`${cleanTitle}${is_confidential ? ' (confidential)' : ''}${isArchived ? ' (archived)' : ''}`}
          className={cn(
            'group v2-interactive flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60',
            FOCUS_RING,
          )}
        >
          {is_confidential ? (
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 transition-colors dark:text-emerald-400"
            >
              <ShieldCheck className="size-[18px]" />
            </span>
          ) : (
            <RowIconTile icon={MessageSquare} />
          )}

          <span className="flex min-w-0 flex-1 flex-col">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {cleanTitle}
            </span>
            {is_confidential ? (
              <span className="truncate text-xs text-emerald-700 dark:text-emerald-400">
                Confidential
              </span>
            ) : null}
          </span>

          <span className="flex shrink-0 items-center gap-2">
            {isArchived ? (
              <Badge variant="secondary" className="text-[11px]">
                Archived
              </Badge>
            ) : null}
            <span className="text-xs tabular-nums text-muted-foreground/80">
              {formatRelativeTime(updated_at, now)}
            </span>
            <ChevronRight
              aria-hidden
              className="size-4 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground motion-reduce:transition-none"
            />
          </span>
        </MoveFirstLink>

        {is_confidential ? (
          <span aria-hidden className="size-9 shrink-0" />
        ) : (
          <ConversationRowMenu title={cleanTitle} onDelete={onDelete} />
        )}
      </div>
    </li>
  );
}

/** The row's actions menu. The trigger is `FolderActionsMenu`'s, so every v2
 *  list row's menu looks and behaves the same. */
function ConversationRowMenu({
  title,
  onDelete,
}: {
  title: string;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground',
          FOCUS_RING,
        )}
        // The title is in the name, so a column of triggers is not a run of
        // identical announcements.
        aria-label={`Actions for ${title}`}
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete chat
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
