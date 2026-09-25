'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Lock, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { conversationSharingApi } from '@/lib/api/conversationSharing';
import type { ConversationData } from '@/types/chat';
import { ShareButton } from '@/v2/features/sharing/ShareButton';
import { VisibilityOption } from '@/v2/features/sharing/VisibilityOption';
import {
  clearScreenContext,
  setScreenContext,
  type ScreenAction,
} from '@/v2/shell/screen-context';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { conversationsQueries } from '../queries';

/**
 * Share a whole chat. Arthur's ambassador feedback (25 September 2026): "there
 * is no way to share conversation". v1 had it and v2 did not; the owner said
 * go.
 *
 * ── WHAT "SHARED" MEANS ────────────────────────────────────────────────────
 * The chat's own address, `/c/{id}`, readable by anyone once the owner makes it
 * public (`POST /conversations/{id}/publish`), exactly as v1 shares. A visitor
 * gets the transcript read-only: the conversation screen already shows a
 * non-owner the "View only" pill instead of the composer. Making it private
 * again (`/unpublish`) closes the link.
 *
 * ── NEVER FOR A CONFIDENTIAL OR REDACTED CHAT ──────────────────────────────
 * The caller passes `enabled` false for both, so the menu row never appears.
 * The server already refuses to publish a confidential chat (422). For a
 * redacted chat this row being absent is the guard until the server refuses
 * too (backend's 12523d9, held for the owner's go).
 *
 * ── WHERE IT LIVES ─────────────────────────────────────────────────────────
 * A "Share chat" row in the header's menu, the slot every v2 screen uses for
 * its own actions (`screen-context.ts`). The dialog reads the SAME detail query
 * the screen already holds, so opening it costs no request, and a change writes
 * `is_private` back into that cache so the screen never refetches.
 */
export function ConversationShare({
  conversationId,
  viewerId,
  enabled,
}: {
  conversationId: string;
  viewerId: number | null;
  /** The owner, on a chat that is neither confidential nor redacted. */
  enabled: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const detailOptions = conversationsQueries.detail({ conversationId, viewerId });
  const { data: detail } = useQuery({ ...detailOptions, enabled });

  const writePrivacy = (isPrivate: boolean) => {
    queryClient.setQueryData<ConversationData>(detailOptions.queryKey, (old) =>
      old ? { ...old, is_private: isPrivate } : old,
    );
  };

  const publish = useMutation({
    mutationFn: () => conversationSharingApi.publish(conversationId),
    meta: { silentError: true },
    onSuccess: (response) => writePrivacy(response.data.is_private),
    onError: () => toast.error("Couldn't make this chat shareable. Try again."),
  });
  const unpublish = useMutation({
    mutationFn: () => conversationSharingApi.unpublish(conversationId),
    meta: { silentError: true },
    onSuccess: (response) => writePrivacy(response.data.is_private),
    onError: () => toast.error("Couldn't make this chat private. Try again."),
  });

  const ready = enabled && detail !== undefined;
  const actions = useMemo<readonly ScreenAction[]>(
    () =>
      ready
        ? [{ id: 'share-chat', label: 'Share chat', icon: Share2, onSelect: () => setOpen(true) }]
        : [],
    [ready],
  );

  useEffect(() => {
    if (actions.length === 0) {
      clearScreenContext();
      return;
    }
    setScreenContext({ pathname, back: null, actions });
  }, [pathname, actions]);
  useEffect(() => () => clearScreenContext(), []);

  if (!ready) return null;

  const isPrivate = detail.is_private;
  const busy = publish.isPending || unpublish.isPending;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={setOpen}
      title="Share chat"
      description="Anyone with the link can read this chat: your questions and the answers. They cannot reply, and they cannot see your other chats."
      size="content"
    >
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex flex-col gap-2" role="group" aria-label="Who can read this chat">
          <VisibilityOption
            icon={Lock}
            title="Private"
            description="Only you can read it"
            selected={isPrivate}
            busy={busy && !isPrivate}
            onSelect={() => {
              if (!isPrivate) unpublish.mutate();
            }}
          />
          <VisibilityOption
            icon={Globe}
            title="Anyone with the link"
            description="Read only, and only this chat"
            selected={!isPrivate}
            busy={busy && isPrivate}
            onSelect={() => {
              if (isPrivate) publish.mutate();
            }}
          />
        </div>

        {!isPrivate ? (
          <div className="flex justify-end motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <ShareButton
              path={`/c/${conversationId}`}
              title={detail.title}
              label="Share the link to this chat"
            />
          </div>
        ) : null}
      </div>
    </ResponsiveOverlay>
  );
}
