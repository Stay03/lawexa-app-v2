'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { stripPastedTags } from '@/lib/utils';
import type { ConversationListItem } from '@/types/chat';
import type { SpaceItemTarget } from '@/v2/features/spaces/content-model';
import { RemoveFromSpaceDialog } from '@/v2/features/spaces/detail/content/RemoveFromSpaceDialog';
import { MoveToSpaceDialog } from '@/v2/features/spaces/move/MoveToSpaceDialog';
import { ConversationShare } from '../conversation/ConversationShare';
import { DeleteConversationDialog } from '../DeleteConversationDialog';
import { conversationsQueries } from '../queries';
import { RenameConversationDialog } from '../RenameConversationDialog';
import { conversationMenuItems, conversationRemoveRoute } from './conversation-menu';
import type { ConversationMenuAction } from './ConversationRow';

/**
 * useConversationMenu — the "…" menu beside each conversation in a list, and
 * the dialogs behind its items (Arthur, 15 October 2026). The conversations
 * list and a space's Conversations tab both use it, so the same chat offers
 * the same items, in the same order, with the same confirms, in both.
 *
 * `actionsFor(row)` is the row's menu: the items its `can` allows
 * (`conversation-menu.ts`), each wired to its dialog. `dialogs` is rendered
 * once by the host. Each dialog stays mounted after it closes so its exit
 * plays, and each open bumps its key so it starts clean.
 *
 * `place` is the space the host is showing (a space's tab), for a row whose
 * payload does not name one; in the reader's own list the row names its own.
 */
export function useConversationMenu({
  viewerId,
  place = null,
  onDeleted,
}: {
  viewerId: number | null;
  place?: { uuid: string; name: string } | null;
  /** Runs once the server confirms a delete, before the caches drop the chat
   *  (the list's exit collapse). */
  onDeleted?: (conversationId: string) => void;
}) {
  const [rename, setRename] = useState<Opened<{ id: string; title: string }>>(null);
  const [share, setShare] = useState<Opened<{ id: string }>>(null);
  const [move, setMove] = useState<Opened<{ item: SpaceItemTarget }>>(null);
  const [remove, setRemove] = useState<
    Opened<{ item: SpaceItemTarget; space: { uuid: string; name: string }; route: 'detach' | 'space-item' }>
  >(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const actionsFor = useCallback(
    (conversation: ConversationListItem): ConversationMenuAction[] => {
      const space = conversation.space ?? place;
      const title = stripPastedTags(conversation.title);
      const item: SpaceItemTarget = { type: 'conversation', id: conversation.id, name: title, space };
      return conversationMenuItems(conversation.can, space !== null).map((id) => ({
        id,
        onSelect: () => {
          switch (id) {
            case 'rename':
              setRename((previous) => opened(previous, { id: conversation.id, title }));
              return;
            case 'move_to_space':
            case 'move':
              setMove((previous) => opened(previous, { item }));
              return;
            case 'remove':
              if (space === null) return;
              setRemove((previous) =>
                opened(previous, {
                  item,
                  space,
                  route: conversationRemoveRoute(conversation.user_id, viewerId),
                }),
              );
              return;
            case 'share':
              setShare((previous) => opened(previous, { id: conversation.id }));
              return;
            case 'delete':
              setDeleteId(conversation.id);
              return;
          }
        },
      }));
    },
    [place, viewerId],
  );

  const dialogs: ReactNode = (
    <>
      {rename ? (
        <RenameConversationDialog
          key={`rename-${rename.key}`}
          conversationId={rename.value.id}
          currentTitle={rename.value.title}
          open={rename.open}
          onOpenChange={(open) => setRename((previous) => closed(previous, open))}
          // The rename writes the new title into every cached list itself.
          onRenamed={() => {}}
        />
      ) : null}
      {share ? (
        <RowShare
          key={`share-${share.key}`}
          conversationId={share.value.id}
          viewerId={viewerId}
          open={share.open}
          onOpenChange={(open) => setShare((previous) => closed(previous, open))}
        />
      ) : null}
      {move ? (
        <MoveToSpaceDialog
          key={`move-${move.key}`}
          item={move.value.item}
          open={move.open}
          onOpenChange={(open) => setMove((previous) => closed(previous, open))}
        />
      ) : null}
      {remove ? (
        <RemoveFromSpaceDialog
          key={`remove-${remove.key}`}
          spaceUuid={remove.value.space.uuid}
          spaceName={remove.value.space.name}
          item={remove.value.item}
          route={remove.value.route}
          open={remove.open}
          onOpenChange={(open) => setRemove((previous) => closed(previous, open))}
        />
      ) : null}
      <DeleteConversationDialog
        conversationId={deleteId}
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onDeleted={(id) => {
          onDeleted?.(id);
          setDeleteId(null);
        }}
      />
    </>
  );

  return { actionsFor, dialogs };
}

/** A dialog's target, whether it is open, and the key of this opening. */
type Opened<Value> = { value: Value; open: boolean; key: number } | null;

function opened<Value>(previous: Opened<Value>, value: Value): Opened<Value> {
  return { value, open: true, key: (previous?.key ?? 0) + 1 };
}

function closed<Value>(previous: Opened<Value>, open: boolean): Opened<Value> {
  return previous ? { ...previous, open } : previous;
}

/**
 * Share from a row. The share dialog needs the chat's full record (whether it
 * is public, its link), which a list row does not carry, so it is read here
 * and the dialog opens once it has arrived; a record already cached opens at
 * once.
 */
function RowShare({
  conversationId,
  viewerId,
  open,
  onOpenChange,
}: {
  conversationId: string;
  viewerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: detail } = useQuery(conversationsQueries.detail({ conversationId, viewerId }));
  if (!detail) return null;
  return (
    <ConversationShare
      conversationId={conversationId}
      viewerId={viewerId}
      detail={detail}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
