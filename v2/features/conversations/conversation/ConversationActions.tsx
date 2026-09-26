'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Share2, Trash2 } from 'lucide-react';

import { clearHeaderContext } from '@/v2/shell/header-context';
import {
  clearScreenContext,
  setScreenContext,
  type ScreenAction,
} from '@/v2/shell/screen-context';
import { DeleteConversationDialog } from '../DeleteConversationDialog';
import { conversationsQueries } from '../queries';
import { ConversationShare } from './ConversationShare';

const NO_ACTIONS: readonly ScreenAction[] = [];

/**
 * The open chat's own rows in the header menu ("Share chat", "Delete chat")
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
}: {
  conversationId: string;
  viewerId: number | null;
  /** The owner, on a chat that is neither confidential nor redacted. */
  canShare: boolean;
  /** The owner, on a chat the server holds (never a confidential one). */
  canDelete: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data: detail } = useQuery({
    ...conversationsQueries.detail({ conversationId, viewerId }),
    enabled: canShare,
  });

  const shareReady = canShare && detail !== undefined;
  const actions = useMemo<readonly ScreenAction[]>(() => {
    if (!shareReady && !canDelete) return NO_ACTIONS;
    const rows: ScreenAction[] = [];
    if (shareReady) {
      rows.push({
        id: 'share-chat',
        label: 'Share chat',
        icon: Share2,
        onSelect: () => setShareOpen(true),
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
  }, [shareReady, canDelete]);

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
