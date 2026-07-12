'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  BadgeCheck,
  Building2,
  Clock,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
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
import {
  useCurrentUserUuid,
  useDeleteOrganization,
  useMyOrganization,
} from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import type { Organization } from '@/types/collab';

import { OrganizationFormDialog } from './OrganizationFormDialog';
import { OrganizationMembersSheet } from './OrganizationMembersSheet';
import { RequestVerificationDialog } from './RequestVerificationDialog';

function VerificationSection({
  organization,
  canManage,
  onRequest,
}: {
  organization: Organization;
  canManage: boolean;
  onRequest: () => void;
}) {
  if (organization.is_verified) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-medium">Verified organization</p>
          <p className="text-sm text-muted-foreground">
            {organization.verified_at
              ? `Verified on ${format(new Date(organization.verified_at), 'MMM d, yyyy')}.`
              : 'This organization is verified.'}
          </p>
        </div>
      </div>
    );
  }

  // verification_requested_at is admin-only; when visible it means "pending".
  if (organization.verification_requested_at) {
    return (
      <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">Verification under review</p>
          <p className="text-sm text-muted-foreground">
            We’re reviewing your documents. This usually takes a little while.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">Get verified</p>
          <p className="text-sm text-muted-foreground">
            Submit your CAC document to earn a trusted badge.
          </p>
        </div>
      </div>
      {canManage && (
        <Button className="shrink-0" onClick={onRequest}>
          Request verification
        </Button>
      )}
    </div>
  );
}

/** Organization home (settings): create, view and manage your organization. */
export function OrganizationHome() {
  const myUuid = useCurrentUserUuid();
  const orgQuery = useMyOrganization();
  const deleteOrg = useDeleteOrganization();
  const org = orgQuery.data?.data ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const myRole = org?.members?.find((m) => m.user.uuid === myUuid)?.role;
  const isOwner = myRole === 'owner';
  const canManage = isOwner || myRole === 'admin';

  const handleDelete = async () => {
    if (!org) return;
    try {
      await deleteOrg.mutateAsync(org.uuid);
      setDeleteOpen(false);
      toast.success('Organization deleted');
    } catch (error) {
      toast.error('Could not delete organization', {
        description: extractApiError(error).message,
      });
    }
  };

  if (orgQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (orgQuery.isError) {
    return (
      <ErrorState
        title="Couldn't load your organization"
        description="Please try again."
        retry={() => orgQuery.refetch()}
      />
    );
  }

  if (!org) {
    return (
      <>
        <EmptyState
          icon={Building2}
          title="You're not in an organization"
          description="Create an organization to own shared spaces, or accept an invitation to join one."
          action={{
            label: 'Create organization',
            onClick: () => setCreateOpen(true),
          }}
        />
        {createOpen && (
          <OrganizationFormDialog open={createOpen} onOpenChange={setCreateOpen} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-muted p-3 text-muted-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold tracking-tight">
              {org.name}
            </h2>
            <Badge variant="secondary">{org.type_label}</Badge>
            {org.is_verified && (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {org.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {org.email}
              </span>
            )}
            {org.website && (
              <a
                href={org.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
              </a>
            )}
            {(org.city || org.country) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {[org.city, org.country].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
          {org.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {org.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMembersOpen(true)}
          >
            <Users className="h-4 w-4" />
            Members
          </Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Organization settings"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit organization
                </DropdownMenuItem>
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete organization
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <VerificationSection
        organization={org}
        canManage={canManage}
        onRequest={() => setVerifyOpen(true)}
      />

      <OrganizationMembersSheet
        organization={org}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
      {editOpen && (
        <OrganizationFormDialog
          organization={org}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {verifyOpen && (
        <RequestVerificationDialog
          orgUuid={org.uuid}
          orgName={org.name}
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {org.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the organization for everyone. Spaces it owns are not
              deleted, but they lose their organization. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOrg.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleteOrg.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrg.isPending && (
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
