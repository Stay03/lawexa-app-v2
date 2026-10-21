'use client';

import { Fragment } from 'react';

import { MoveFirstLink } from '@/v2/shell/move-first';
import {
  Boxes,
  ChevronRight,
  FolderOutput,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Share2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ConversationListItem } from '@/types/chat';
import { lastActivityAt } from '../activity';
import { CONVERSATION_MENU_LABELS, type ConversationMenuItem } from './conversation-menu';
import { conversationOrigin, fullTime } from './conversation-origin';
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
 *
 * ── THE SAME ROW IN A SPACE (Spaces F2, 11 October 2026) ───────────────────
 * A space's Chats tab lists chats that are often SOMEONE ELSE'S, so it passes
 * a `byline` (whose chat it is) and no `onDelete`: deleting is the chat
 * owner's alone, from their own list. With no actions there is no menu and no
 * spacer, because no row in that column has a menu to line up with.
 *
 * ── MOVING AND TAKING OUT (Spaces F3, 12 October 2026) ─────────────────────
 * Two more rows join the menu, each only when its host passes it: "Move to
 * space" (`onMove`, the chat's owner: their own list, and their own rows in a
 * space's tab) and "Remove from space" (`onRemoveFromSpace`, the space's
 * Owner, in its tab). A confidential chat never gets either: it cannot go
 * into a space (the server answers 422), so its row keeps the spacer.
 *
 * ── THE MENU IS THE SERVER'S ANSWER (Arthur, 15 October 2026) ──────────────
 * The host hands over `actions`, already the items this reader may use, in
 * Arthur's order (`conversation-menu.ts`, from the row's `can`), each with its
 * handler. The row only draws them: Rename, Move to Space or Move, Remove,
 * Share, and Delete under a rule. `menuColumn` says whether any row in the
 * list has a menu, so a row with none keeps a same-size spacer and its time
 * stays in the column.
 *
 * `showSpace` puts the space the chat is in under its title, in the reader's
 * own list. It is text inside the row's link, not a second link: a link
 * inside a link is invalid and would split the row's one target in two. The
 * open chat's header carries the same name as a link to the space.
 */
export function ConversationRow({
  conversation,
  now,
  index,
  exiting,
  reveal = true,
  byline = null,
  showSpace = false,
  actions = NO_ACTIONS,
  menuColumn = false,
  select,
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
  /** A quiet second line naming whose chat this is (a space's list). */
  byline?: string | null;
  /** Name the space the chat is in under its title (the reader's own list). */
  showSpace?: boolean;
  /** The menu's items for this reader, in order, each with its handler. */
  actions?: readonly ConversationMenuAction[];
  /** Whether the list draws a menu column at all (see the docblock). */
  menuColumn?: boolean;
  /**
   * The list is being ticked (bulk select): the row is its tick box, a tap
   * ticks it instead of opening the chat, and the menu steps aside for the
   * bar's actions. `disabled` is a row no bulk action can reach (a
   * confidential chat): its box shows, off.
   */
  select?: { checked: boolean; onToggle: () => void; disabled?: boolean };
}) {
  const { id, title, status, is_confidential } = conversation;
  const cleanTitle = stripPastedTags(title);
  const isArchived = status === 'archived';
  const spaceName = showSpace && !is_confidential ? (conversation.space?.name ?? null) : null;
  // What the chat was started from, so two chats of the same name differ
  // (finding 4). Only where nothing else fills the second line.
  const origin = is_confidential ? null : conversationOrigin(conversation.references);
  const hasMenu = actions.length > 0 && !is_confidential;
  const rowClass =
    'group v2-interactive flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60';

  const content = (
    <>
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
        ) : byline ? (
          <span className="truncate text-xs text-muted-foreground">
            {byline}
          </span>
        ) : spaceName ? (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <Boxes aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{spaceName}</span>
          </span>
        ) : origin ? (
          <span className="truncate text-xs text-muted-foreground">{origin}</span>
        ) : null}
      </span>

      <span className="flex shrink-0 items-center gap-2">
        {isArchived ? (
          <Badge variant="secondary" className="text-[11px]">
            Archived
          </Badge>
        ) : null}
        <span
          className="text-xs tabular-nums text-muted-foreground/80"
          title={fullTime(lastActivityAt(conversation))}
        >
          {formatRelativeTime(lastActivityAt(conversation), now)}
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground motion-reduce:transition-none"
        />
      </span>
    </>
  );

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
        {select ? (
          <label
            className={cn(
              rowClass,
              select.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              select.checked && 'bg-secondary/60',
            )}
          >
            <Checkbox
              checked={select.checked}
              onCheckedChange={select.onToggle}
              disabled={select.disabled}
              aria-label={select.disabled ? `${cleanTitle} can't be selected: it is confidential` : `Select ${cleanTitle}`}
              className="shrink-0"
            />
            {content}
          </label>
        ) : (
          /* MoveFirstLink: the conversation's frame paints in the frame of the
             tap, before any route work (v2/shell/move-first.tsx). */
          <MoveFirstLink
            href={`/c/${id}`}
            kind="conversation"
            title={cleanTitle}
            header={{ title: cleanTitle, confidential: Boolean(is_confidential) }}
            headerOwner={id}
            aria-label={`${cleanTitle}${is_confidential ? ' (confidential)' : ''}${isArchived ? ' (archived)' : ''}${byline && !is_confidential ? `, ${byline}` : ''}${spaceName ? `, in ${spaceName}` : ''}${!byline && !spaceName && origin ? `, about ${origin}` : ''}`}
            className={cn(rowClass, FOCUS_RING)}
          >
            {content}
          </MoveFirstLink>
        )}

        {select ? (
          <span aria-hidden className="size-9 shrink-0" />
        ) : hasMenu ? (
          <ConversationRowMenu title={cleanTitle} actions={actions} />
        ) : menuColumn ? (
          <span aria-hidden className="size-9 shrink-0" />
        ) : null}
      </div>
    </li>
  );
}

/** One item of the row's menu: which, and what it opens. */
export interface ConversationMenuAction {
  id: ConversationMenuItem;
  onSelect: () => void;
}

/** Stable empty menu, so a row without one never mints a new array. */
const NO_ACTIONS: readonly ConversationMenuAction[] = [];

const MENU_ICONS: Readonly<Record<ConversationMenuItem, typeof Trash2>> = {
  rename: Pencil,
  move_to_space: Boxes,
  move: Boxes,
  remove: FolderOutput,
  share: Share2,
  delete: Trash2,
};

/** The row's actions menu. The trigger is `FolderActionsMenu`'s, so every v2
 *  list row's menu looks and behaves the same. Delete is last, below a rule. */
function ConversationRowMenu({
  title,
  actions,
}: {
  title: string;
  actions: readonly ConversationMenuAction[];
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
        {actions.map((action, index) => {
          const Icon = MENU_ICONS[action.id];
          const destructive = action.id === 'delete';
          return (
            <Fragment key={action.id}>
              {destructive && index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant={destructive ? 'destructive' : 'default'}
                onSelect={action.onSelect}
              >
                <Icon />
                {CONVERSATION_MENU_LABELS[action.id]}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
