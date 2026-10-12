'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Pencil, Share2, Trash2 } from 'lucide-react';

import { stripPastedTags } from '@/lib/utils';
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
import { conversationsQueries } from '../queries';
import { ConversationShare } from './ConversationShare';

const NO_ACTIONS: readonly ScreenAction[] = [];

/**
 * The open chat's own rows in the header menu ("Share chat", "Rename chat",
 * "Delete chat")
 * and the dialogs behind them. One publisher, because the screen context holds
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
  canShare,
  canMove,
  canShowPlace,
  canDelete,
  canRename,
  currentTitle,
  onRenamed,
}: {
  conversationId: string;
  viewerId: number | null;
  /** The owner, on a chat that is neither confidential nor redacted. */
  canShare: boolean;
  /** The owner, on a chat that may go into a space (the same rule as Share). */
  canMove: boolean;
  /** A chat the server holds (never a confidential one), whoever reads it:
   *  its record says which space it is in. */
  canShowPlace: boolean;
  /** The owner, on a chat the server holds (never a confidential one). */
  canDelete: boolean;
  /** The owner, on a chat the server holds, once its title is known. */
  canRename: boolean;
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
  const renameReady = canRename && currentTitle !== null;
  // The same entry the controller seeded the transcript from. Only the
  // owner's rows switch it on (as Share always did); for anyone else it stays
  // off and still reads that seeded record, so the place line costs no
  // request of its own.
  const { data: detail } = useQuery({
    ...conversationsQueries.detail({ conversationId, viewerId }),
    enabled: canShare || canMove,
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

  const shareReady = canShare && detail !== undefined;
  const moveReady = canMove && detail !== undefined;
  const actions = useMemo<readonly ScreenAction[]>(() => {
    if (!shareReady && !moveReady && !renameReady && !canDelete) return NO_ACTIONS;
    const rows: ScreenAction[] = [];
    if (shareReady) {
      rows.push({
        id: 'share-chat',
        label: 'Share chat',
        icon: Share2,
        onSelect: () => setShareOpen(true),
      });
    }
    if (moveReady) {
      rows.push({
        id: 'move-chat',
        label: 'Move to space',
        icon: Boxes,
        onSelect: () => setMove((previous) => ({ open: true, key: previous.key + 1 })),
      });
    }
    if (renameReady) {
      rows.push({
        id: 'rename-chat',
        label: 'Rename chat',
        icon: Pencil,
        onSelect: () => setRenameOpen(true),
      });
    }
    if (canDelete) {
      rows.push({
        id: 'delete-chat',
        label: 'Delete chat',
        icon: Trash2,
        destructive: true,
        onSelect: () => setDeleteOpen(true),
      });
    }
    return rows;
  }, [shareReady, moveReady, renameReady, canDelete]);

  useEffect(() => {
    if (actions.length === 0) {
      clearScreenContext();
      return;
    }
    setScreenContext({ pathname, back: null, actions });
  }, [pathname, actions]);
  useEffect(() => () => clearScreenContext(), []);

  return (
    <>
      {shareReady ? (
        <ConversationShare
          conversationId={conversationId}
          viewerId={viewerId}
          detail={detail}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      ) : null}
      {moveReady && detail && move.key > 0 ? (
        <MoveToSpaceDialog
          key={move.key}
          item={{
            type: 'conversation',
            id: conversationId,
            name: stripPastedTags(currentTitle ?? detail.title),
            space: detail.space,
          }}
          open={move.open}
          onOpenChange={(open) => setMove((previous) => ({ ...previous, open }))}
        />
      ) : null}
      {/* Mounted only while open, so each open starts from the current title. */}
      {renameReady && renameOpen ? (
        <RenameConversationDialog
          conversationId={conversationId}
          currentTitle={currentTitle ?? ''}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          onRenamed={onRenamed}
        />
      ) : null}
      {canDelete ? (
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
