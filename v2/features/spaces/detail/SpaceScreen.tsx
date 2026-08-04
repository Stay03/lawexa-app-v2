'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  GraduationCap,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

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
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { useAuthStore } from '@/lib/stores/authStore';
import { collabAccessState } from '@/v2/features/collab/model';
import { channelsQueries } from '@/v2/features/channels/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { ChannelFormDialog } from '../dialogs/ChannelFormDialog';
import { SpaceFormDialog } from '../dialogs/SpaceFormDialog';
import {
  canManageSpace,
  isSpaceOwner,
  memberCountLabel,
  roleInRoster,
  spaceOwnerLabel,
} from '../model';
import { useDeleteSpace } from '../mutations';
import { spacesQueries } from '../queries';
import { useDialog } from '../use-dialog';
import { SpaceChannelRow } from './SpaceChannelRow';
import { SpaceMembersSheet } from './SpaceMembersSheet';
import {
  ChannelListSkeleton,
  ChannelsEmptyState,
  ChannelsErrorState,
  SpaceAccessDeniedState,
  SpaceErrorState,
  SpaceScreenFrame,
} from './states';

/**
 * SpaceScreen — the `/spaces/[spaceId]` client root: the identity header in
 * the v2 header grammar, the channel list on the LIVE unread model, and the
 * space's own governance actions. Study A2 (KEEP the model, REDESIGN);
 * phase-5 W4, 2026-08-04.
 *
 * ── THE HEADER GRAMMAR (the cases-page pattern) ────────────────────────────
 * kicker → name → description → actions → hairline. The kicker carries the
 * three facts that place a space: what KIND it is, WHO owns it (an
 * organization, or "Personal"), and HOW MANY people are in it — the last of
 * which is a BUTTON, because "4 members" is the most natural door to the
 * roster and a separate "Members" button beside it would be the same door
 * twice.
 *
 * ── TWO QUERIES, TWO INDEPENDENT REGIONS ───────────────────────────────────
 * The space and its channels resolve separately, so a channel-list failure
 * leaves the identity header standing (and vice versa). Each region owns its
 * own three states.
 *
 * ── PERMISSIONS ARE READ FROM EVERY SOURCE, ON PURPOSE ─────────────────────
 * `my_role` is stamped on list rows but `GET /spaces/{uuid}` MAY omit it, so
 * governance falls back to the caller's row in the roster — the fetched member
 * list when it has landed, otherwise the roster the DETAIL response already
 * carries. That second roster is what keeps the answer inside the first
 * response: waiting for the members request left a space's creator looking at
 * the "an owner or admin has to create one" empty state, with no button, in
 * the seconds after they created it. No source alone is reliable; together
 * they are, and a missing answer degrades to "no manage actions" rather than
 * to a button that 403s.
 */
export function SpaceScreen({ spaceUuid }: { spaceUuid: string }) {
  const session = useV2Session();
  const viewerId = session.userId;
  // The uuid identity for roster self-checks — the sanctioned auth bridge,
  // read through a primitive selector (stable snapshot).
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const eligible = collabAccessState(session) === 'eligible';

  // Frozen at mount for the relative channel ages: the lists refetch on every
  // visit (`REFETCH_ON_VISIT`), so the clock and the data move together, and
  // no `Date.now()` runs in render (React Compiler lint).
  const [now] = useState(() => Date.now());

  const [membersOpen, setMembersOpen] = useState(false);
  // Form dialogs stay MOUNTED so their closing transition plays, and remount on
  // each opening so their fields are re-derived from the current space (see
  // `useDialog`). The confirm `AlertDialog`s below are already unconditional.
  const createChannelDialog = useDialog();
  const editDialog = useDialog();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const router = useRouter();
  const deleteSpace = useDeleteSpace(spaceUuid);

  const spaceQuery = useQuery({
    ...spacesQueries.detail(spaceUuid, { viewerId }),
    enabled: eligible,
  });
  const channelsQuery = useQuery({
    ...channelsQueries.bySpace({ spaceUuid, viewerId, per_page: 50 }),
    enabled: eligible && spaceQuery.isSuccess,
  });
  // Mounted alongside the screen (not only with the sheet) because it is the
  // fallback source of the caller's role — and it warms the sheet, so opening
  // it paints a roster instead of a skeleton (the feel directive).
  const membersQuery = useQuery({
    ...spacesQueries.members(spaceUuid, { viewerId }),
    enabled: eligible && spaceQuery.isSuccess,
  });

  const space = spaceQuery.data?.data;

  // Publish the space name into the shell header's centre slot.
  const spaceName = space?.name ?? null;
  useEffect(() => {
    if (spaceName) setHeaderContext({ title: spaceName, confidential: false });
    return () => clearHeaderContext();
  }, [spaceName]);

  if (spaceQuery.isPending) {
    return <SpaceScreenFrame />;
  }

  if (spaceQuery.isError || !space) {
    const apiError = spaceQuery.error ? extractApiError(spaceQuery.error) : null;
    const status = apiError?.status ?? 0;
    return (
      <div className={LIST_COLUMN}>
        {status === 403 || status === 404 ? (
          <SpaceAccessDeniedState />
        ) : (
          <SpaceErrorState
            message={
              status >= 400 && status < 500 ? apiError?.message : undefined
            }
            onRetry={() => void spaceQuery.refetch()}
          />
        )}
      </div>
    );
  }

  // The freshest roster available, then the row's own stamp: the fetched member
  // list wins once it lands, and the roster the DETAIL response already carries
  // covers the window before it — which is what stops a space's creator seeing
  // the non-creator empty state seconds after creating it. Same one-liner as
  // `OrganizationScreen`, deliberately.
  const rosterRole = roleInRoster(
    membersQuery.data?.data ?? space.members ?? [],
    viewerUuid,
  );
  const effective = { my_role: space.my_role ?? rosterRole };
  const canManage = canManageSpace(effective);
  const isOwner = isSpaceOwner(effective);

  const TypeIcon = space.type === 'study' ? GraduationCap : Briefcase;
  const channels = channelsQuery.data?.data ?? [];

  const handleDelete = () => {
    setDeleteError(null);
    deleteSpace.mutate(undefined, {
      onSuccess: () => {
        setDeleteOpen(false);
        router.push('/spaces');
      },
      onError: (error) => setDeleteError(extractApiError(error).message),
    });
  };

  return (
    <div className={LIST_COLUMN}>
      {/* ── Identity header ──────────────────────────────────────────────── */}
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
        >
          <TypeIcon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{space.type_label}</span>
            <Dot />
            <span className="truncate">{spaceOwnerLabel(space)}</span>
            <Dot />
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className={cn(
                'v2-interactive inline-flex items-center gap-1 rounded transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
                FOCUS_RING,
              )}
            >
              <Users aria-hidden className="size-3.5" />
              {memberCountLabel(space.active_members_count)}
            </button>
          </p>

          <h1 className="mt-1 flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <span className="min-w-0 truncate">{space.name}</span>
            {space.is_private ? (
              <Lock
                aria-label="Private space"
                className="size-4 shrink-0 text-muted-foreground"
              />
            ) : null}
          </h1>

          {space.description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {space.description}
            </p>
          ) : null}
        </div>

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="v2-interactive size-8 shrink-0"
                aria-label="Space settings"
              >
                <MoreHorizontal aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={editDialog.show}>
                <Pencil aria-hidden className="size-4" />
                Edit space
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 aria-hidden className="size-4" />
                    Delete space
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {/* ── Channels ─────────────────────────────────────────────────────── */}
      <section className="mt-5 border-t pt-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Channels
            {channels.length > 0 && (
              <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">
                {channels.length}
              </span>
            )}
          </h2>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              className="v2-interactive"
              onClick={createChannelDialog.show}
            >
              <Plus aria-hidden className="size-4" />
              New channel
            </Button>
          )}
        </div>

        <span role="status" aria-live="polite" className="sr-only">
          {channelsQuery.isPending ? 'Loading channels' : ''}
        </span>

        {channelsQuery.isPending ? (
          <ChannelListSkeleton />
        ) : channelsQuery.isError && channels.length === 0 ? (
          <ChannelsErrorState onRetry={() => void channelsQuery.refetch()} />
        ) : channels.length === 0 ? (
          <ChannelsEmptyState
            canCreate={canManage}
            onCreate={createChannelDialog.show}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {channels.map((channel, index) => (
              <SpaceChannelRow
                key={channel.uuid}
                channel={channel}
                now={now}
                index={index}
              />
            ))}
          </ul>
        )}
      </section>

      <SpaceMembersSheet
        space={space}
        viewerId={viewerId}
        viewerUuid={viewerUuid}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />

      <ChannelFormDialog
        key={`channel-${createChannelDialog.openKey}`}
        open={createChannelDialog.open}
        onOpenChange={createChannelDialog.setOpen}
        spaceUuid={space.uuid}
      />

      <SpaceFormDialog
        key={`space-${editDialog.openKey}`}
        open={editDialog.open}
        onOpenChange={editDialog.setOpen}
        space={space}
        viewerId={viewerId}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          setDeleteOpen(next);
          if (!next) setDeleteError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {space.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the space and every channel in it, for everyone. It
              can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
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
                <Loader2 aria-hidden className="size-4 animate-spin" />
              )}
              Delete space
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The kicker's separator — decorative, so it never reaches a screen reader. */
function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  );
}
