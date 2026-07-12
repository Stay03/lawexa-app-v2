'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  GraduationCap,
  Hash,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer } from '@/components/layout';
import {
  useCurrentUserUuid,
  useDeleteSpace,
  useSpace,
  useSpaceChannels,
  useSpaceMembers,
} from '@/lib/hooks/useCollab';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { extractApiError } from '@/lib/utils/api-error';

import { ChannelFormDialog } from './ChannelFormDialog';
import { ChannelRow } from './ChannelRow';
import { SpaceFormDialog } from './SpaceFormDialog';
import { SpaceMembersSheet } from './SpaceMembersSheet';
import { ChannelListSkeleton } from './skeletons';

interface SpaceDetailViewProps {
  spaceUuid: string;
}

/** A space overview: identity header + its channels (Phase 1: read-only). */
export function SpaceDetailView({ spaceUuid }: SpaceDetailViewProps) {
  const router = useRouter();
  const spaceQuery = useSpace(spaceUuid);
  const channelsQuery = useSpaceChannels(spaceUuid);
  const membersQuery = useSpaceMembers(spaceUuid);
  const myUuid = useCurrentUserUuid();
  const deleteSpace = useDeleteSpace();
  const space = spaceQuery.data?.data;

  const [membersOpen, setMembersOpen] = useState(false);
  const [channelFormOpen, setChannelFormOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const myRole = membersQuery.data?.data.find(
    (m) => m.user.uuid === myUuid
  )?.role;
  const isOwner = myRole === 'owner';
  const canManage = isOwner || myRole === 'admin';

  const handleDelete = async () => {
    try {
      await deleteSpace.mutateAsync(spaceUuid);
      setDeleteOpen(false);
      router.push('/spaces');
    } catch (error) {
      toast.error('Could not delete space', {
        description: extractApiError(error).message,
      });
    }
  };

  const setOverride = useBreadcrumbStore((s) => s.setOverride);
  const clearOverride = useBreadcrumbStore((s) => s.clearOverride);

  useEffect(() => {
    if (space?.name) setOverride(spaceUuid, space.name);
    return () => clearOverride(spaceUuid);
  }, [spaceUuid, space?.name, setOverride, clearOverride]);

  if (spaceQuery.isLoading) {
    return (
      <PageContainer>
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <ChannelListSkeleton />
      </PageContainer>
    );
  }

  if (spaceQuery.isError || !space) {
    const status = spaceQuery.isError
      ? extractApiError(spaceQuery.error).status
      : 0;
    return (
      <PageContainer>
        {status === 403 ? (
          <EmptyState
            icon={Lock}
            title="You're not a member of this space"
            description="Ask a space owner or admin to invite you to see its channels."
          />
        ) : (
          <ErrorState
            title="Couldn't load this space"
            description="We couldn't load this space. Please try again."
            retry={() => spaceQuery.refetch()}
          />
        )}
      </PageContainer>
    );
  }

  const TypeIcon = space.type === 'study' ? GraduationCap : Briefcase;
  const channels = channelsQuery.data?.data ?? [];

  const renderChannels = () => {
    if (channelsQuery.isLoading) return <ChannelListSkeleton />;
    if (channelsQuery.isError) {
      return (
        <ErrorState
          title="Couldn't load channels"
          description="We couldn't load this space's channels. Please try again."
          retry={() => channelsQuery.refetch()}
        />
      );
    }
    if (channels.length === 0) {
      return (
        <EmptyState
          icon={Hash}
          title="No channels yet"
          description={
            canManage
              ? 'Create the first channel to start the conversation.'
              : 'Channels in this space will show up here.'
          }
          action={
            canManage
              ? {
                  label: 'Create channel',
                  onClick: () => setChannelFormOpen(true),
                }
              : undefined
          }
        />
      );
    }
    return (
      <div className="space-y-2">
        {channels.map((channel) => (
          <ChannelRow key={channel.uuid} channel={channel} />
        ))}
      </div>
    );
  };

  return (
    <PageContainer>
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-muted p-3 text-muted-foreground">
          <TypeIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {space.name}
            </h1>
            {space.is_private && (
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Badge variant="secondary">{space.type_label}</Badge>
            <span>{space.organization ? space.organization.name : 'Personal'}</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground hover:underline"
            >
              <Users className="h-3.5 w-3.5" />
              {space.active_members_count}{' '}
              {space.active_members_count === 1 ? 'member' : 'members'}
            </button>
          </div>
          {space.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {space.description}
            </p>
          )}
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Space settings"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit space
                </DropdownMenuItem>
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete space
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">
            Channels
            {!channelsQuery.isLoading && channels.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                {channels.length}
              </span>
            )}
          </h2>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChannelFormOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New channel
            </Button>
          )}
        </div>
        {renderChannels()}
      </div>

      <SpaceMembersSheet
        space={space}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
      {channelFormOpen && (
        <ChannelFormDialog
          spaceUuid={space.uuid}
          open={channelFormOpen}
          onOpenChange={setChannelFormOpen}
        />
      )}
      {editOpen && (
        <SpaceFormDialog
          space={space}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {space.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the space and all of its channels for everyone. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSpace.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleteSpace.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSpace.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
