'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Hash,
  Loader2,
  Lock,
  LogIn,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  useChannel,
  useChannelMessages,
  useDeleteChannel,
  useJoinChannel,
} from '@/lib/hooks/useCollab';
import { useChannelRealtime } from '@/lib/hooks/useChannelRealtime';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { extractApiError } from '@/lib/utils/api-error';

import { ChannelConversation } from './ChannelConversation';
import { EnableChannelPushNudge } from './EnableChannelPushNudge';
import { ChannelFormDialog } from './ChannelFormDialog';
import { ChannelMembersSheet } from './ChannelMembersSheet';
import { ChannelViewSkeleton } from './skeletons';

interface ChannelViewProps {
  channelUuid: string;
}

/** The channel reader: header + scrollable message history (Phase 1: read-only). */
export function ChannelView({ channelUuid }: ChannelViewProps) {
  const { data, isLoading, isError, error, refetch } = useChannel(channelUuid);
  const channel = data?.data;

  // Messages load in parallel with the channel detail. Subscribe here (React
  // Query shares the cache with ChannelConversation, so no extra request) to
  // hold one skeleton until both are ready instead of showing a second
  // message-area skeleton after the page skeleton.
  const messagesQuery = useChannelMessages(channelUuid);

  const realtime = useChannelRealtime(channelUuid, {
    enabled: !!channel?.is_member,
  });

  const router = useRouter();
  const [membersOpen, setMembersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const joinChannel = useJoinChannel(channelUuid);
  const deleteChannel = useDeleteChannel(channelUuid);

  const handleJoin = async () => {
    try {
      await joinChannel.mutateAsync();
      toast.success('Joined channel');
    } catch (err) {
      toast.error('Could not join channel', {
        description: extractApiError(err).message,
      });
    }
  };

  const handleDelete = async () => {
    const spaceUuid = channel?.space.uuid;
    try {
      await deleteChannel.mutateAsync();
      setDeleteOpen(false);
      router.push(spaceUuid ? `/spaces/${spaceUuid}` : '/spaces');
    } catch (err) {
      toast.error('Could not delete channel', {
        description: extractApiError(err).message,
      });
    }
  };

  const setOverride = useBreadcrumbStore((s) => s.setOverride);
  const clearOverride = useBreadcrumbStore((s) => s.clearOverride);

  useEffect(() => {
    if (channel?.name) setOverride(channelUuid, `#${channel.name}`);
    return () => clearOverride(channelUuid);
  }, [channelUuid, channel?.name, setOverride, clearOverride]);

  if (isLoading) {
    return <ChannelViewSkeleton />;
  }

  if (isError || !channel) {
    const status = isError ? extractApiError(error).status : 0;
    if (status === 403) {
      return (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={Lock}
            title="You don't have access to this channel"
            description="This channel is private. Ask a member to invite you, or pick another channel from your spaces."
          />
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorState
          title="Couldn't load this channel"
          description="We couldn't load this channel. Please try again."
          retry={() => refetch()}
        />
      </div>
    );
  }

  // Members' history loads in parallel — keep the one skeleton until it lands so
  // the reader doesn't flash a second message-area skeleton. Non-members skip
  // this (their messages request 403s) and fall through to the conversation.
  if (channel.is_member && messagesQuery.isLoading) {
    return <ChannelViewSkeleton />;
  }

  const Icon = channel.visibility === 'private' ? Lock : Hash;
  const canManage =
    channel.my_role === 'owner' || channel.my_role === 'admin';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b px-4 pb-3 pt-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h1 className="truncate text-lg font-semibold">{channel.name}</h1>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <Link
                  href={`/spaces/${channel.space.uuid}`}
                  className="hover:text-foreground hover:underline"
                >
                  {channel.space.name}
                </Link>
                <span aria-hidden>·</span>
                {channel.is_member ? (
                  <button
                    type="button"
                    onClick={() => setMembersOpen(true)}
                    className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground hover:underline"
                  >
                    <Users className="h-3.5 w-3.5" />
                    {channel.active_members_count}{' '}
                    {channel.active_members_count === 1 ? 'member' : 'members'}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {channel.active_members_count}{' '}
                    {channel.active_members_count === 1 ? 'member' : 'members'}
                  </span>
                )}
                {realtime.onlineCount > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {realtime.onlineCount} online
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!channel.is_member && channel.visibility === 'space_public' && (
                <Button
                  size="sm"
                  onClick={handleJoin}
                  disabled={joinChannel.isPending}
                >
                  {joinChannel.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  Join
                </Button>
              )}
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Channel settings"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditOpen(true)}>
                      <Pencil className="h-4 w-4" />
                      Edit channel
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete channel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          {channel.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {channel.description}
            </p>
          )}
        </div>
      </header>

      {channel.is_member && <EnableChannelPushNudge />}

      <ChannelConversation
        channel={channel}
        realtime={realtime}
        className="min-h-0 flex-1"
      />

      <ChannelMembersSheet
        channel={channel}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
      {editOpen && (
        <ChannelFormDialog
          spaceUuid={channel.space.uuid}
          channel={channel}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete #{channel.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the channel and its messages for everyone. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteChannel.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleteChannel.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteChannel.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
