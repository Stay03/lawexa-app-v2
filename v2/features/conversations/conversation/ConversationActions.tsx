'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Blocks, FolderOutput, Pencil, Share2, Trash2, Users } from 'lucide-react';

import { stripPastedTags } from '@/lib/utils';
import { RemoveFromSpaceDialog } from '@/v2/features/spaces/detail/content/RemoveFromSpaceDialog';
import { MoveToSpaceDialog } from '@/v2/features/spaces/move/MoveToSpaceDialog';
import { clearHeaderContext } from '@/v2/shell/header-context';
import { clearHeaderPlace, setHeaderPlace } from '@/v2/shell/header-place';
import {
  clearScreenContext,
  setScreenContext,
  type ScreenAction,
} from '@/v2/shell/screen-context';
import { DeleteConversationDialog } from '../DeleteConversationDialog';
import { RenameConversationDialog } from '../RenameConversationDialog';
import {
  CONVERSATION_MENU_LABELS,
  SPACE_CHAT_SHARE_NOTE,
  conversationMenuItems,
  conversationRemoveRoute,
  showsSpaceShareNote,
  type ConversationMenuItem,
} from '../list/conversation-menu';
import { conversationsQueries } from '../queries';
import { ConversationShare } from './ConversationShare';

const NO_ACTIONS: readonly ScreenAction[] = [];

/** The informing row a Space chat's menu shows where Share was; it can't be chosen. */
const SPACE_SHARE_NOTE_ROW: ScreenAction = {
  id: 'space-share-note',
  label: SPACE_CHAT_SHARE_NOTE,
  icon: Users,
  onSelect: () => {},
  disabled: true,
};

/**
 * The open chat's own rows in the header menu and the dialogs behind them.
 * Since Arthur's menu (15 October 2026) they are the rows' own: the items the
 * chat's `can` allows, in his order and words (`conversation-menu.ts`), so the
 * header, the conversations list and a space's tab offer the same things.
 * Remove joins them inside a space, by the route ownership picks. One publisher, because the screen context holds
 * ONE action list per screen: two components each publishing would overwrite
 * each other.
 *
 * DELETE LEAVES THE ROUTE. On success the header title is dropped and the
 * user goes home with `router.replace`, so Back cannot return to a chat that
 * no longer exists. The dialog is not closed by hand: the route change
 * unmounts it. Closing it would re-render this component after the delete has
 * removed the chat's detail entry, and the detail query below would fetch the
 * deleted chat again.
 *
 * ── THE SPACE (Spaces F3, 12 October 2026) ─────────────────────────────────
 * "Move to space" joins the menu for the owner of a chat that may go into one
 * (never confidential, never redacted: the server answers 422). It waits for
 * the chat's record, as Share does, because the dialog needs to know whether
 * the chat is in a space now. The same record names the space the chat is in,
 * and this publishes it as the header's place line (`header-place.ts`), a
 * link to the space under the chat's title, for anyone reading the chat.
 */
export function ConversationActions({
  conversationId,
  viewerId,
  canShowPlace,
  currentTitle,
  onRenamed,
}: {
  conversationId: string;
  viewerId: number | null;
  /** A chat the server holds (never a confidential one), whoever reads it:
   *  its record says which space it is in, and what this reader may do. */
  canShowPlace: boolean;
  /** The chat's title as it shows now, which the rename field opens on. */
  currentTitle: string | null;
  /** The server stored a new title: re-read it so the header shows it. */
  onRenamed: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  // Held after closing so the dialog's exit plays; each open bumps the key,
  // so it starts clean.
  const [move, setMove] = useState({ open: false, key: 0 });
  const [remove, setRemove] = useState({ open: false, key: 0 });
  // The same entry the controller seeded the transcript from: its `can` is
  // what this reader may do, and it names the space the chat is in.
  const { data: detail } = useQuery({
    ...conversationsQueries.detail({ conversationId, viewerId }),
    enabled: canShowPlace,
  });

  // The place line: the space's name under the title, linking to it. Read as
  // two strings so the effect re-runs only when the place really changes.
  const placeUuid = canShowPlace ? (detail?.space?.uuid ?? null) : null;
  const placeName = canShowPlace ? (detail?.space?.name ?? null) : null;
  useEffect(() => {
    if (placeUuid === null || placeName === null) {
      clearHeaderPlace(conversationId);
      return;
    }
    setHeaderPlace({ label: placeName, href: `/spaces/${placeUuid}` }, conversationId);
  }, [placeUuid, placeName, conversationId]);
  useEffect(() => () => clearHeaderPlace(conversationId), [conversationId]);

  // What this reader may do, in Arthur's order. Rename also waits for the
  // title, which its field opens on.
  const items = useMemo<readonly ConversationMenuItem[]>(
    () =>
      canShowPlace && detail
        ? conversationMenuItems(detail.can, detail.space != null).filter(
            (item) => item !== 'rename' || currentTitle !== null,
          )
        : [],
    [canShowPlace, detail, currentTitle],
  );
  // A Space chat can't be shared outside the Space: its menu says so where Share was.
  const spaceShareNote = canShowPlace && detail ? showsSpaceShareNote(detail.can, detail.space != null) : false;
  const actions = useMemo<readonly ScreenAction[]>(() => {
    if (items.length === 0) return NO_ACTIONS;
    const rows = items.map((item): ScreenAction => {
      const label = CONVERSATION_MENU_LABELS[item];
      switch (item) {
        case 'rename':
          return { id: 'rename-chat', label, icon: Pencil, onSelect: () => setRenameOpen(true) };
        case 'move_to_space':
        case 'move':
          return {
            id: 'move-chat',
            label,
            icon: Blocks,
            onSelect: () => setMove((previous) => ({ open: true, key: previous.key + 1 })),
          };
        case 'remove':
          return {
            id: 'remove-chat',
            label,
            icon: FolderOutput,
            onSelect: () => setRemove((previous) => ({ open: true, key: previous.key + 1 })),
          };
        case 'share':
          return { id: 'share-chat', label, icon: Share2, onSelect: () => setShareOpen(true) };
        case 'delete':
          return {
            id: 'delete-chat',
            label,
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleteOpen(true),
          };
      }
    });
    if (!spaceShareNote) return rows;
    const deleteAt = rows.findIndex((row) => row.destructive);
    const at = deleteAt === -1 ? rows.length : deleteAt;
    return [...rows.slice(0, at), SPACE_SHARE_NOTE_ROW, ...rows.slice(at)];
  }, [items, spaceShareNote]);

  useEffect(() => {
    if (actions.length === 0) {
      clearScreenContext();
      return;
    }
    setScreenContext({ pathname, back: null, actions });
  }, [pathname, actions]);
  useEffect(() => () => clearScreenContext(), []);

  const name = stripPastedTags(currentTitle ?? detail?.title ?? '');
  const space = detail?.space ?? null;

  return (
    <>
      {detail && items.includes('share') ? (
        <ConversationShare
          conversationId={conversationId}
          viewerId={viewerId}
          detail={detail}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      ) : null}
      {detail && move.key > 0 ? (
        <MoveToSpaceDialog
          key={move.key}
          item={{ type: 'conversation', id: conversationId, name, space }}
          open={move.open}
          onOpenChange={(open) => setMove((previous) => ({ ...previous, open }))}
        />
      ) : null}
      {detail && space && remove.key > 0 ? (
        <RemoveFromSpaceDialog
          key={remove.key}
          spaceUuid={space.uuid}
          spaceName={space.name}
          item={{ type: 'conversation', id: conversationId, name, space }}
          route={conversationRemoveRoute(detail.user_id, viewerId)}
          open={remove.open}
          onOpenChange={(open) => setRemove((previous) => ({ ...previous, open }))}
        />
      ) : null}
      {/* Mounted only while open, so each open starts from the current title. */}
      {renameOpen && currentTitle !== null ? (
        <RenameConversationDialog
          conversationId={conversationId}
          currentTitle={currentTitle}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          onRenamed={onRenamed}
        />
      ) : null}
      {items.includes('delete') ? (
        <DeleteConversationDialog
          conversationId={conversationId}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => {
            clearHeaderContext();
            router.replace('/');
          }}
        />
      ) : null}
    </>
  );
}
