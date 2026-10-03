'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Share2, Trash2 } from 'lucide-react';

import { clearHeaderContext } from '@/v2/shell/header-context';
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
 */
export function ConversationActions({
  conversationId,
  viewerId,
  canShare,
  canDelete,
  canRename,
  currentTitle,
  onRenamed,
}: {
  conversationId: string;
  viewerId: number | null;
  /** The owner, on a chat that is neither confidential nor redacted. */
  canShare: boolean;
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
  const renameReady = canRename && currentTitle !== null;
  const { data: detail } = useQuery({
    ...conversationsQueries.detail({ conversationId, viewerId }),
    enabled: canShare,
  });

  const shareReady = canShare && detail !== undefined;
  const actions = useMemo<readonly ScreenAction[]>(() => {
    if (!shareReady && !renameReady && !canDelete) return NO_ACTIONS;
    const rows: ScreenAction[] = [];
    if (shareReady) {
      rows.push({
        id: 'share-chat',
        label: 'Share chat',
        icon: Share2,
        onSelect: () => setShareOpen(true),
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
  }, [shareReady, renameReady, canDelete]);

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
